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
 * Site-scoped nearest-neighbour search: opportunities whose vectors best match a query vector,
 * one row per opportunity (best score). Via RPC because PostgREST can't express `<=>` ordering.
 * `model` + `dims` restrict the search to vectors embedded by the same model as the query.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId - the site to scope the search to
 * @param {string} params.sourceType - the source kind, e.g. `topic`
 * @param {number[]} params.vector - the query embedding
 * @param {string} params.model - the model the query was embedded with
 * @param {number} params.dims - the query embedding dimension
 * @param {number} [params.k=10] - max opportunities to return
 * @param {number} [params.minScore=0] - cosine-similarity floor
 * @returns {Promise<Array<{entityId: string, entityType: string, score: number}>>} best-first
 */
export async function lookupOpportunitiesByVector(postgrestClient, {
  siteId, sourceType, vector, model, dims, k = 10, minScore = 0,
} = {}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertId(sourceType, 'sourceType');
  assertModel(model);
  assertDims(dims);
  const queryVector = serializeVector(vector);

  const { data, error } = await postgrestClient.rpc(SEMANTIC_SEARCH_RPC, {
    p_site_id: siteId,
    p_source_type: sourceType,
    p_query_embedding: queryVector,
    p_model: model,
    p_dims: dims,
    p_limit: k,
    p_min_score: minScore,
  });
  if (error) {
    throw new DataAccessError(`Failed semantic search for site ${siteId}`, { siteId, sourceType }, error);
  }

  return (data ?? []).map((row) => ({
    entityId: row.entity_id,
    entityType: row.entity_type,
    score: row.score,
  }));
}

/**
 * Read the cached embedding for a query string (keyed by normalized text + model + dims).
 * @returns {Promise<{vector: number[], textHash: string}|null>} null on miss
 */
export async function getQueryEmbedding(postgrestClient, { text, model, dims } = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  const normalized = normalizeText(text);
  if (normalized === '') {
    throw new ValidationError('text is required');
  }
  const textHash = hashText(normalized);

  const { data, error } = await postgrestClient
    .from(QUERY_EMBEDDING_TABLE)
    .select('embedding')
    .eq('text_hash', textHash)
    .eq('model', model)
    .eq('dims', dims)
    .limit(1);
  if (error) {
    throw new DataAccessError('Failed to read semantic_query_embedding', { model, dims }, error);
  }
  if (!data || data.length === 0) {
    return null;
  }
  const vector = parseVector(data[0].embedding);
  // Corrupt row: treat as a miss so the caller re-embeds.
  if (vector === null) {
    return null;
  }
  return { vector, textHash };
}

/**
 * Upsert a query embedding into the cache and stamp `last_access_at`. Requires the
 * `postgrest_writer` role.
 * @returns {Promise<string>} the text hash
 */
export async function upsertQueryEmbedding(postgrestClient, {
  text, model, dims, vector,
} = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  const normalized = normalizeText(text);
  if (normalized === '') {
    throw new ValidationError('text is required');
  }
  const textHash = hashText(normalized);
  const embedding = serializeVector(vector);
  if (vector.length !== dims) {
    throw new ValidationError(`vector length ${vector.length} does not match dims ${dims}`);
  }
  const row = {
    text_hash: textHash,
    model,
    dims,
    normalized_text: normalized,
    embedding,
    last_access_at: new Date().toISOString(),
  };
  const { error } = await postgrestClient
    .from(QUERY_EMBEDDING_TABLE)
    .upsert(row, { onConflict: 'text_hash,model,dims' });
  if (error) {
    throw new DataAccessError('Failed to upsert semantic_query_embedding', { model, dims }, error);
  }
  return textHash;
}

/**
 * Bump `last_access_at` on a cache hit. Pass the `textHash` from `getQueryEmbedding` to skip
 * re-hashing; `text` is used only when it's absent.
 * @returns {Promise<void>}
 */
export async function touchQueryEmbedding(postgrestClient, {
  text, model, dims, textHash,
} = {}) {
  assertClient(postgrestClient);
  assertModel(model);
  assertDims(dims);
  let hash = textHash;
  if (typeof hash !== 'string' || hash.length === 0) {
    const normalized = normalizeText(text);
    if (normalized === '') {
      throw new ValidationError('text or textHash is required');
    }
    hash = hashText(normalized);
  }
  const { error } = await postgrestClient
    .from(QUERY_EMBEDDING_TABLE)
    .update({ last_access_at: new Date().toISOString() })
    .eq('text_hash', hash)
    .eq('model', model)
    .eq('dims', dims);
  if (error) {
    throw new DataAccessError('Failed to touch semantic_query_embedding', { model, dims }, error);
  }
}
