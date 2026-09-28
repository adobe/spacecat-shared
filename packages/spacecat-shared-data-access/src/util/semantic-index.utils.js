/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createHash } from 'crypto';

import { DataAccessError, ValidationError } from '../errors/index.js';
import { DEFAULT_PAGE_SIZE } from './postgrest.utils.js';

/**
 * Shared writer + reader for the "semantic index" tables: `opportunity_semantic_embedding` (one
 * embedding per opportunity source text, keyed by `source_type`) and `semantic_query_embedding`
 * (a global query-text -> vector cache).
 *
 * Writer and reader share `normalizeText`/`hashText`, so the normalized form is a PERSISTED
 * format: changing it desyncs stored rows from new lookups.
 */

/** Tables the sync/copy helpers are allowed to touch. */
export const SEMANTIC_INDEX_TABLES = Object.freeze(['opportunity_semantic_embedding']);
export const QUERY_EMBEDDING_TABLE = 'semantic_query_embedding';
export const SEMANTIC_SEARCH_RPC = 'rpc_opportunity_semantic_search';
export const COPY_VECTORS_RPC = 'wrpc_copy_opportunity_semantic_vectors';

/** Multi-row op chunk size; smaller than the URL index's because vectors inflate the payload. */
export const SEMANTIC_CHUNK_SIZE = 20;

/** Hashes per `.in()` filter (64 hex chars each), kept well under the request URI limit. */
export const QUERY_HASH_CHUNK_SIZE = 50;

/** Max topic/query text length; matches the `source_text` DB CHECK. */
export const MAX_SOURCE_TEXT_LENGTH = 2048;

function assertClient(postgrestClient) {
  if (!postgrestClient || typeof postgrestClient.from !== 'function') {
    throw new ValidationError('postgrestClient is required');
  }
}

function assertId(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${name} is required`);
  }
}

function assertDims(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError('dims must be a positive integer');
  }
}

export const MAX_MODEL_LENGTH = 128;

function assertModel(value) {
  assertId(value, 'model');
  if (value.length > MAX_MODEL_LENGTH) {
    throw new ValidationError(`model must be at most ${MAX_MODEL_LENGTH} characters`);
  }
}

/** Only an empty/omitted `sources` clears; a non-empty input reduced to nothing throws. */
function assertClearable(sources, entityId, sourceType) {
  const explicitClear = sources === undefined || sources === null
    || (Array.isArray(sources) && sources.length === 0);
  if (!explicitClear) {
    throw new ValidationError(`sources contained no valid entries; pass [] to clear ${sourceType} vectors for entity ${entityId}`);
  }
}

/** Lowercase, collapse whitespace, and trim, so trivial variants share a hash. */
export function normalizeText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

export function hashText(normalized) {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Per-topic hygiene shared by writer and reader, so both reject the same input and dedup on the
 * same key. Returns the trimmed `text` to embed and its normalized `key`, or `null` if unusable.
 *
 * @param {unknown} title - a raw topic title or query string
 * @param {{ maxLength?: number }} [opts] - max trimmed length (default `MAX_SOURCE_TEXT_LENGTH`)
 * @returns {{ text: string, key: string } | null}
 */
export function cleanTopicText(title, { maxLength = MAX_SOURCE_TEXT_LENGTH } = {}) {
  if (typeof title !== 'string') {
    return null;
  }
  const text = title.trim();
  if (text.length === 0 || text.length > maxLength) {
    return null;
  }
  return { text, key: normalizeText(text) };
}

/** Serialize to the pgvector `[v1,v2,...]` wire format. */
export function serializeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0
    || !vector.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new ValidationError('vector must be a non-empty array of finite numbers');
  }
  return `[${vector.join(',')}]`;
}

/** Parse a pgvector `[v1,v2,...]` string; `null` if malformed. */
export function parseVector(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length < 2) {
    return null;
  }
  const inner = value.slice(1, -1).trim();
  if (inner === '') {
    return [];
  }
  const nums = inner.split(',').map(Number);
  return nums.some(Number.isNaN) ? null : nums;
}

function serializeDimsVector(vector, dims) {
  const serialized = serializeVector(vector);
  if (vector.length !== dims) {
    throw new ValidationError(`vector length ${vector.length} does not match dims ${dims}`);
  }
  return serialized;
}

function hashQueryText(text) {
  const normalized = normalizeText(text);
  if (normalized === '') {
    throw new ValidationError('text is required');
  }
  return { normalized, textHash: hashText(normalized) };
}

/** Clean + hash the text, validate the vector, drop invalid text, dedup on hash (first-seen). */
function toRows({
  siteId, entityId, entityType, sourceType, sources,
}) {
  const list = Array.isArray(sources) ? sources : [];
  const seen = new Set();
  const rows = [];
  for (const src of list) {
    const cleaned = cleanTopicText(src?.text);
    if (cleaned === null) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const { text, key } = cleaned;
    const sourceHash = hashText(key);
    if (seen.has(sourceHash)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    seen.add(sourceHash);
    // Bad text is dropped, but a bad vector contract throws: it would persist as wrong neighbours.
    assertModel(src.model);
    assertDims(src.dims);
    const embedding = serializeVector(src.vector);
    if (src.vector.length !== src.dims) {
      throw new ValidationError(`vector length ${src.vector.length} does not match dims ${src.dims}`);
    }
    rows.push({
      site_id: siteId,
      entity_id: entityId,
      entity_type: entityType,
      source_type: sourceType,
      source_id: src.sourceId ?? null,
      source_hash: sourceHash,
      source_text: text,
      embedding,
      model: src.model,
      dims: src.dims,
    });
  }
  return rows;
}

async function upsertRows(postgrestClient, table, rows, onConflict, entityId) {
  for (let i = 0; i < rows.length; i += SEMANTIC_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + SEMANTIC_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new DataAccessError(`Failed to sync ${table} for entity ${entityId}`, { table, entityId }, error);
    }
  }
}

/** Read the stored hashes for one (entity, source_type), paginated so `max-rows` can't truncate. */
async function fetchHashes(postgrestClient, table, siteId, entityId, sourceType) {
  const hashes = [];
  let offset = 0;
  let keepGoing = true;
  while (keepGoing) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(table)
      .select('source_hash')
      .eq('site_id', siteId)
      .eq('entity_id', entityId)
      .eq('source_type', sourceType)
      .order('source_hash', { ascending: true })
      .range(offset, offset + DEFAULT_PAGE_SIZE - 1);
    if (error) {
      throw new DataAccessError(`Failed to read ${table} for entity ${entityId}`, { table, entityId }, error);
    }
    if (!data || data.length === 0) {
      keepGoing = false;
    } else {
      hashes.push(...data.map((row) => row.source_hash));
      offset += DEFAULT_PAGE_SIZE;
      keepGoing = data.length >= DEFAULT_PAGE_SIZE;
    }
  }
  return hashes;
}

/** Delete the given hashes for one (entity, source_type), chunked (URI limit). */
async function deleteHashes(postgrestClient, table, siteId, entityId, sourceType, hashes) {
  for (let i = 0; i < hashes.length; i += SEMANTIC_CHUNK_SIZE) {
    const chunk = hashes.slice(i, i + SEMANTIC_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .delete()
      .eq('site_id', siteId)
      .eq('entity_id', entityId)
      .eq('source_type', sourceType)
      .in('source_hash', chunk);
    if (error) {
      throw new DataAccessError(`Failed to prune ${table} for entity ${entityId}`, { table, entityId }, error);
    }
  }
}

async function clearEntitySource(postgrestClient, table, siteId, entityId, sourceType) {
  const { error } = await postgrestClient
    .from(table)
    .delete()
    .eq('site_id', siteId)
    .eq('entity_id', entityId)
    .eq('source_type', sourceType);
  if (error) {
    throw new DataAccessError(`Failed to clear ${table} for entity ${entityId}`, { table, entityId }, error);
  }
}

/**
 * Full-replace one opportunity's vectors for a single `sourceType`; an empty `sources` clears it
 * (a non-empty input that yields no valid rows throws instead of clearing).
 *
 * Same upsert -> prune ordering and single-writer caveat as `syncUrlIndex`. Requires the
 * `postgrest_writer` role.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId - the site the opportunity belongs to
 * @param {string} params.entityId - the opportunity id
 * @param {string} params.entityType - the opportunity type stored on each row
 * @param {string} params.sourceType - the source kind, e.g. `topic`
 * @param {Array<{text: string, vector: number[], model: string, dims: number, sourceId?: string}>}
 *   params.sources - one entry per source text (normalized + hashed here)
 * @returns {Promise<number>} size of the stored set for this (entity, sourceType) after sync
 */
export async function syncOpportunitySemantic(postgrestClient, {
  siteId, entityId, entityType, sourceType, sources,
} = {}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertId(entityId, 'entityId');
  assertId(entityType, 'entityType');
  assertId(sourceType, 'sourceType');

  const table = 'opportunity_semantic_embedding';
  const rows = toRows({
    siteId, entityId, entityType, sourceType, sources,
  });

  if (rows.length === 0) {
    assertClearable(sources, entityId, sourceType);
    await clearEntitySource(postgrestClient, table, siteId, entityId, sourceType);
    return 0;
  }

  await upsertRows(postgrestClient, table, rows, 'entity_id,source_type,source_hash', entityId);

  const keep = new Set(rows.map((r) => r.source_hash));
  const existing = await fetchHashes(postgrestClient, table, siteId, entityId, sourceType);
  const stale = existing.filter((h) => !keep.has(h));
  if (stale.length > 0) {
    await deleteHashes(postgrestClient, table, siteId, entityId, sourceType, stale);
  }

  return rows.length;
}

/**
 * Copy all vector rows from one opportunity to another within a site, server-side via the copy
 * RPC, so identical content is re-pointed rather than re-embedded. Idempotent. Requires the
 * `postgrest_writer` role.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId - the site both opportunities belong to
 * @param {string} params.fromEntityId - source opportunity id
 * @param {string} params.toEntityId - destination opportunity id
 * @returns {Promise<number>} rows inserted (0 when already copied)
 */
export async function copyEntityVectors(postgrestClient, {
  siteId, fromEntityId, toEntityId,
} = {}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertId(fromEntityId, 'fromEntityId');
  assertId(toEntityId, 'toEntityId');

  const { data, error } = await postgrestClient.rpc(COPY_VECTORS_RPC, {
    p_site_id: siteId,
    p_from_entity_id: fromEntityId,
    p_to_entity_id: toEntityId,
  });
  if (error) {
    throw new DataAccessError(`Failed to copy semantic vectors for entity ${fromEntityId}`, { fromEntityId, toEntityId }, error);
  }
  return data ?? 0;
}

/**
 * Site-scoped nearest-neighbour search for many query vectors: for each one, the opportunities
 * whose vectors best match it, one row per opportunity (best score). Via RPC because PostgREST
 * can't express `<=>` ordering. `model` + `dims` restrict the search to vectors embedded by the
 * same model as the queries.
 *
 * Vectors go in groups of up to `SEMANTIC_CHUNK_SIZE`, fewer when `k` is large, so a call's
 * `group × k` rows stay within PostgREST's max-rows cap.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId - the site to scope the search to
 * @param {string} params.sourceType - the source kind, e.g. `topic`
 * @param {number[][]} params.vectors - the query embeddings
 * @param {string} params.model - the model the queries were embedded with
 * @param {number} params.dims - the query embedding dimension
 * @param {number} [params.k=10] - max opportunities per query
 * @param {number} [params.minScore=0] - cosine-similarity floor
 * @returns {Promise<Array<Array<{entityId: string, entityType: string, score: number}>>>} one
 *   best-first list per input vector, in input order
 */
export async function lookupOpportunitiesByVectors(postgrestClient, {
  siteId, sourceType, vectors, model, dims, k = 10, minScore = 0,
} = {}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertId(sourceType, 'sourceType');
  assertModel(model);
  assertDims(dims);
  if (!Array.isArray(vectors)) {
    throw new ValidationError('vectors must be an array');
  }
  if (!Number.isInteger(k) || k < 1 || k > DEFAULT_PAGE_SIZE) {
    throw new ValidationError(`k must be an integer between 1 and ${DEFAULT_PAGE_SIZE}`);
  }
  if (typeof minScore !== 'number' || !Number.isFinite(minScore)) {
    throw new ValidationError('minScore must be a finite number');
  }
  const serialized = vectors.map((vector) => serializeDimsVector(vector, dims));

  const results = vectors.map(() => []);
  const groupSize = Math.min(SEMANTIC_CHUNK_SIZE, Math.floor(DEFAULT_PAGE_SIZE / k));
  for (let offset = 0; offset < serialized.length; offset += groupSize) {
    const group = serialized.slice(offset, offset + groupSize);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient.rpc(SEMANTIC_SEARCH_RPC, {
      p_site_id: siteId,
      p_source_type: sourceType,
      p_query_embeddings: group,
      p_model: model,
      p_dims: dims,
      p_limit: k,
      p_min_score: minScore,
    });
    if (error) {
      throw new DataAccessError(`Failed semantic search for site ${siteId}`, { siteId, sourceType }, error);
    }
    for (const row of data ?? []) {
      // Checked against this group, not all results, so a bad index can't land in another group.
      const { query_index: queryIndex } = row;
      if (!Number.isInteger(queryIndex) || queryIndex < 0 || queryIndex >= group.length) {
        throw new DataAccessError(
          `Unexpected query_index ${queryIndex} from ${SEMANTIC_SEARCH_RPC}`,
          { siteId, sourceType },
        );
      }
      results[offset + queryIndex].push({
        entityId: row.entity_id,
        entityType: row.entity_type,
        score: row.score,
      });
    }
  }
  return results;
}

/**
 * Read the cached embeddings for many query strings (keyed by normalized text + model + dims),
 * in groups of `QUERY_HASH_CHUNK_SIZE` hashes.
 * @returns {Promise<Array<{vector: number[], textHash: string}|null>>} one entry per input text,
 *   in input order; null on a miss
 */
export async function getQueryEmbeddings(postgrestClient, { texts, model, dims } = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  if (!Array.isArray(texts)) {
    throw new ValidationError('texts must be an array');
  }
  const hashes = texts.map((text) => hashQueryText(text).textHash);
  const distinct = [...new Set(hashes)];

  const vectorByHash = new Map();
  for (let i = 0; i < distinct.length; i += QUERY_HASH_CHUNK_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .select('text_hash, embedding')
      .eq('model', model)
      .eq('dims', dims)
      .in('text_hash', distinct.slice(i, i + QUERY_HASH_CHUNK_SIZE));
    if (error) {
      throw new DataAccessError('Failed to read semantic_query_embedding', { model, dims }, error);
    }
    for (const row of data ?? []) {
      const vector = parseVector(row.embedding);
      // Corrupt row: treat as a miss so the caller re-embeds.
      if (vector !== null) {
        vectorByHash.set(row.text_hash, vector);
      }
    }
  }
  return hashes.map((textHash) => (vectorByHash.has(textHash)
    ? { vector: vectorByHash.get(textHash), textHash }
    : null));
}

/**
 * Upsert many query embeddings into the cache and stamp `last_access_at`, in groups of
 * `SEMANTIC_CHUNK_SIZE`. Entries whose text normalizes to the same hash are written once (first
 * wins). Groups are not atomic: a failure can leave earlier groups written, and retrying is safe
 * (idempotent upsert). Requires the `postgrest_writer` role.
 * @param {object} params
 * @param {Array<{text: string, vector: number[]}>} params.entries
 * @returns {Promise<string[]>} each entry's text hash, in input order
 */
export async function upsertQueryEmbeddings(postgrestClient, { entries, model, dims } = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  if (!Array.isArray(entries)) {
    throw new ValidationError('entries must be an array');
  }
  const lastAccessAt = new Date().toISOString();
  const seen = new Set();
  const rows = [];
  const hashes = entries.map((entry) => {
    const { normalized, textHash } = hashQueryText(entry?.text);
    const embedding = serializeDimsVector(entry?.vector, dims);
    if (!seen.has(textHash)) {
      seen.add(textHash);
      rows.push({
        text_hash: textHash,
        model,
        dims,
        normalized_text: normalized,
        embedding,
        last_access_at: lastAccessAt,
      });
    }
    return textHash;
  });

  // Rows carry full vectors, hence SEMANTIC_CHUNK_SIZE rather than QUERY_HASH_CHUNK_SIZE.
  for (let i = 0; i < rows.length; i += SEMANTIC_CHUNK_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .upsert(rows.slice(i, i + SEMANTIC_CHUNK_SIZE), { onConflict: 'text_hash,model,dims' });
    if (error) {
      throw new DataAccessError('Failed to upsert semantic_query_embedding', { model, dims }, error);
    }
  }
  return hashes;
}

/**
 * Bump `last_access_at` on cache hits, one update per group of `QUERY_HASH_CHUNK_SIZE` hashes.
 * Pass the `textHash`es returned by `getQueryEmbeddings`.
 * @returns {Promise<void>}
 */
export async function touchQueryEmbeddings(postgrestClient, { textHashes, model, dims } = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  if (!Array.isArray(textHashes)) {
    throw new ValidationError('textHashes must be an array');
  }
  textHashes.forEach((hash) => assertId(hash, 'textHash'));
  const distinct = [...new Set(textHashes)];
  const lastAccessAt = new Date().toISOString();

  for (let i = 0; i < distinct.length; i += QUERY_HASH_CHUNK_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .update({ last_access_at: lastAccessAt })
      .eq('model', model)
      .eq('dims', dims)
      .in('text_hash', distinct.slice(i, i + QUERY_HASH_CHUNK_SIZE));
    if (error) {
      throw new DataAccessError('Failed to touch semantic_query_embedding', { model, dims }, error);
    }
  }
}
