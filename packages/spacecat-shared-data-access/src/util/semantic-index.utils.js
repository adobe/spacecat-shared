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
 * Shared writer + reader for the "semantic index" tables:
 *   - `opportunity_semantic_embedding` — one embedding per opportunity SOURCE text (a topic title
 *     now, a claim later; keyed by `source_type`), searched by nearest-neighbour.
 *   - `semantic_query_embedding` — a global text -> vector cache for the read path.
 *
 * Mirrors `url-index.utils.js`, swapping the canonical URL for an embedding vector. Vectors are
 * produced by the writer (the audit-worker) with the shared model; this layer owns storage, dedup,
 * and the (RPC-backed) ANN read. Text normalization + hashing live here so a value written always
 * matches a later read/re-sync. Requires the `postgrest_writer` role for writes.
 */

/** The ANN-indexed entity table(s) the sync/copy helpers may touch. */
export const SEMANTIC_INDEX_TABLES = Object.freeze(['opportunity_semantic_embedding']);
/** The global query-embedding cache table. */
export const QUERY_EMBEDDING_TABLE = 'semantic_query_embedding';
/** The Postgres RPC that runs the ANN search (read RPC -> reader fleet). */
export const SEMANTIC_SEARCH_RPC = 'rpc_opportunity_semantic_search';
/** The write RPC (-> writer fleet) that copies an opportunity's vectors to another id. */
export const COPY_VECTORS_RPC = 'wrpc_copy_opportunity_semantic_vectors';

/**
 * Chunk multi-row ops so neither the query string (`in(...)`, HTTP 414) nor the request body
 * (upserts, HTTP 413 against the ~1MB ALB limit) exceeds its limit. Vectors are large, so this is
 * smaller than the URL index's chunk.
 */
export const SEMANTIC_CHUNK_SIZE = 20;

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

/** `dims` is part of the cache key; unchecked it corrupts it (silent miss / null-dims row). */
function assertDims(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError('dims must be a positive integer');
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

/** Lowercase + collapse-whitespace + trim, so trivial text variants share a row/hash. */
export function normalizeText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

/** Stable content hash of the normalized text (dedup/cache key). */
export function hashText(normalized) {
  return createHash('sha256').update(normalized).digest('hex');
}

/** pgvector wire format: a JSON-ish `[v1,v2,...]` string PostgREST casts to `vector`. */
export function serializeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0
    || !vector.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new ValidationError('vector must be a non-empty array of finite numbers');
  }
  return `[${vector.join(',')}]`;
}

/** Parse a pgvector `[v1,v2,...]` string (as PostgREST returns it) back to a number[]. */
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
  // A non-numeric segment (corrupt row) yields NaN; return null (cache-miss semantics) rather
  // than surface a NaN vector far downstream where serializeVector rejects it misleadingly.
  return nums.some(Number.isNaN) ? null : nums;
}

/**
 * Build the canonical row set for an entity's sources of one `source_type`: normalize + hash the
 * text, serialize the vector, drop invalids, de-duplicate on hash (first-seen).
 */
function toRows({
  siteId, entityId, entityType, sourceType, sources,
}) {
  const list = Array.isArray(sources) ? sources : [];
  const seen = new Set();
  const rows = [];
  for (const src of list) {
    const { text, vector, sourceId } = src ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const normalized = normalizeText(text);
    const sourceHash = hashText(normalized);
    if (seen.has(sourceHash)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    seen.add(sourceHash);
    rows.push({
      site_id: siteId,
      entity_id: entityId,
      entity_type: entityType,
      source_type: sourceType,
      source_id: sourceId ?? null,
      source_hash: sourceHash,
      source_text: text,
      embedding: serializeVector(vector),
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

/** Read the stored source_hashes for one (entity, source_type), paginated. */
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

/** Delete the given source_hashes for one (entity, source_type), chunked. */
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
 * Full-replace the semantic vectors for ONE opportunity, scoped to a single `sourceType`, so
 * re-syncing an entity's topics never disturbs its claims. Upsert-then-prune, mirroring
 * `syncUrlIndex`. Empty `sources` clears the (entity, sourceType) slice; a non-empty input that
 * yields no valid rows throws. Requires the `postgrest_writer` role.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId
 * @param {string} params.entityId - the opportunity id
 * @param {string} params.entityType - the opportunity type stored on each row
 * @param {string} params.sourceType - `topic` | `claim` | …
 * @param {Array<{text: string, vector: number[], model: string, dims: number, sourceId?: string}>}
 *   params.sources - one entry per source text; text is normalized + hashed here.
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
 * Copy every semantic vector row from one opportunity id to another within a site (used when an
 * offsite refresh preserves the previous evergreen content as a new history snapshot: the content —
 * hence the vectors — is identical, so we re-point rather than re-embed). Runs entirely server-side
 * via the `wrpc_copy_opportunity_semantic_vectors` write RPC (`INSERT … SELECT`), so no rows are
 * materialized in the caller. Idempotent (the RPC's `ON CONFLICT DO NOTHING`). Requires the
 * `postgrest_writer` role.
 *
 * @param {object} postgrestClient
 * @param {object} params
 * @param {string} params.siteId
 * @param {string} params.fromEntityId - source opportunity id (still holding the old vectors)
 * @param {string} params.toEntityId - destination (the new snapshot) opportunity id
 * @returns {Promise<number>} number of rows inserted (a re-copy of already-present rows returns 0)
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
 * Nearest-neighbour search for opportunities related to a query vector, within a site and
 * `sourceType`. Backed by the `rpc_opportunity_semantic_search` read RPC (the `<=>` ANN ordering
 * cannot be expressed through the PostgREST query builder). The RPC dedupes to distinct
 * opportunities keeping the best cosine similarity, applies the score floor, and limits to `k`.
 *
 * @param {object} postgrestClient
 * @param {object} params
 * @param {string} params.siteId
 * @param {string} params.sourceType - `topic` | `claim` | …
 * @param {number[]} params.vector - the query embedding (same model/dims as the index)
 * @param {number} [params.k=10] - max opportunities to return
 * @param {number} [params.minScore=0] - cosine-similarity floor; matches below are dropped
 * @returns {Promise<Array<{entityId: string, entityType: string, score: number}>>}
 *   ranked best-first
 */
export async function lookupOpportunitiesByVector(postgrestClient, {
  siteId, sourceType, vector, k = 10, minScore = 0,
} = {}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertId(sourceType, 'sourceType');
  const queryVector = serializeVector(vector);

  const { data, error } = await postgrestClient.rpc(SEMANTIC_SEARCH_RPC, {
    p_site_id: siteId,
    p_source_type: sourceType,
    p_query_embedding: queryVector,
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
 * Point-read the cached embedding for a query string (keyed by normalized text + model + dims).
 * @returns {Promise<{vector: number[], textHash: string}|null>} the cached vector, or null on miss
 */
export async function getQueryEmbedding(postgrestClient, { text, model, dims } = {}) {
  assertClient(postgrestClient);
  assertId(model, 'model');
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
  // A corrupt cached vector parses to null; treat it as a miss so the caller re-embeds.
  if (vector === null) {
    return null;
  }
  return { vector, textHash };
}

/**
 * Upsert a query-text embedding into the cache (idempotent on text_hash+model+dims) and stamp
 * `last_access_at`. Requires the `postgrest_writer` role for the update-on-conflict.
 * @returns {Promise<string>} the text_hash
 */
export async function upsertQueryEmbedding(postgrestClient, {
  text, model, dims, vector,
} = {}) {
  assertClient(postgrestClient);
  assertId(model, 'model');
  assertDims(dims);
  const normalized = normalizeText(text);
  if (normalized === '') {
    throw new ValidationError('text is required');
  }
  const textHash = hashText(normalized);
  const row = {
    text_hash: textHash,
    model,
    dims,
    normalized_text: normalized,
    embedding: serializeVector(vector),
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
 * Coarsely bump `last_access_at` on a cache hit (housekeeping input). Best-effort at the call site.
 * @returns {Promise<void>}
 */
export async function touchQueryEmbedding(postgrestClient, { text, model, dims } = {}) {
  assertClient(postgrestClient);
  assertId(model, 'model');
  assertDims(dims);
  const normalized = normalizeText(text);
  if (normalized === '') {
    throw new ValidationError('text is required');
  }
  const textHash = hashText(normalized);
  const { error } = await postgrestClient
    .from(QUERY_EMBEDDING_TABLE)
    .update({ last_access_at: new Date().toISOString() })
    .eq('text_hash', textHash)
    .eq('model', model)
    .eq('dims', dims);
  if (error) {
    throw new DataAccessError('Failed to touch semantic_query_embedding', { model, dims }, error);
  }
}
