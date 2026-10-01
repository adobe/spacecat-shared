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
import Opportunity from '../models/opportunity/opportunity.model.js';
import Suggestion from '../models/suggestion/suggestion.model.js';
import { DEFAULT_PAGE_SIZE, rpcError } from './postgrest.utils.js';

/**
 * Shared writer + reader for the semantic index: `opportunity_semantic_embedding` /
 * `suggestion_semantic_embedding` (one embedding per indexed text of an entity, keyed by
 * `match_type` + `match_field_type`) and `semantic_query_embedding` (a global text -> vector
 * cache).
 *
 * Both sides embed the NORMALIZED text (`normalizeText`), so a `text_hash` always maps to one
 * vector. The normalized form is a persisted format: changing it desyncs stored rows from new
 * lookups.
 */

// Which lookup an indexed row serves. Set by the dimension functions below, never by callers.
const SEMANTIC_MATCH_TYPES = Object.freeze({
  TOPIC: 'topic',
  CLAIM: 'claim',
});

/** Entity kinds with a semantic index. Each maps to its table and search RPC. */
export const SEMANTIC_TARGETS = Object.freeze({
  OPPORTUNITY: 'opportunity',
  SUGGESTION: 'suggestion',
});

const TARGET_CONFIG = Object.freeze({
  [SEMANTIC_TARGETS.OPPORTUNITY]: Object.freeze({
    table: 'opportunity_semantic_embedding',
    searchRpc: 'rpc_opportunity_semantic_search',
  }),
  [SEMANTIC_TARGETS.SUGGESTION]: Object.freeze({
    table: 'suggestion_semantic_embedding',
    searchRpc: 'rpc_suggestion_semantic_search',
  }),
});

export const SEMANTIC_INDEX_TABLES = Object.freeze(
  Object.values(TARGET_CONFIG).map((config) => config.table),
);
export const SEMANTIC_SEARCH_RPCS = Object.freeze(
  Object.fromEntries(Object.entries(TARGET_CONFIG).map(([t, config]) => [t, config.searchRpc])),
);
export const QUERY_EMBEDDING_TABLE = 'semantic_query_embedding';

/** Multi-row op chunk size; smaller than the URL index's because vectors inflate the payload. */
export const SEMANTIC_CHUNK_SIZE = 20;

/** Hashes / ids per `.in()` filter, kept well under the request URI limit. */
export const QUERY_HASH_CHUNK_SIZE = 50;

/** Texts per `createEmbeddings` call (Azure accepts up to 2048 inputs per request). */
export const EMBEDDING_BATCH_SIZE = 256;

/** Max text length; matches the `text` DB CHECKs. */
export const MAX_SOURCE_TEXT_LENGTH = 2048;
export const MAX_MATCH_FIELD_TYPE_LENGTH = 64;
export const MAX_ENTITY_TYPE_LENGTH = 255;
/** Max values per type filter; matches the search RPCs' guard. */
export const MAX_TYPE_FILTER_ITEMS = 100;

/** Default budget for the read-side embed call (a synchronous API route). */
export const EMBEDDING_TIMEOUT_MS = 10_000;

/**
 * Shared semantic-matching settings. `embedding` is the generation every semantic writer and
 * reader uses: stored on each row and part of the query-cache key. `embedding.dims` must match
 * the data-service `vector(1536)` columns and CHECKs. A code constant, not env config: writer and
 * reader agree as long as both run the same data-access version.
 */
export const SEMANTIC_MATCHING_CONFIG = Object.freeze({
  embedding: Object.freeze({
    model: 'azure/text-embedding-3-small',
    dims: 1536,
  }),
});

/** The embedding call failed, timed out, or returned malformed vectors. */
export class EmbeddingUnavailableError extends DataAccessError {
  constructor(message, { misses } = {}, cause = null) {
    super(message, { misses }, cause);
    this.misses = misses;
  }
}

export const MAX_MODEL_LENGTH = 128;
const MAX_ECHOED_VALUE_LENGTH = 200;

function assertClient(postgrestClient) {
  if (!postgrestClient || typeof postgrestClient.from !== 'function') {
    throw new ValidationError('postgrestClient is required');
  }
}

function assertEmbeddingClient(embeddingClient) {
  if (!embeddingClient || typeof embeddingClient.createEmbeddings !== 'function') {
    throw new ValidationError('embeddingClient with createEmbeddings() is required');
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

function assertModel(value) {
  assertId(value, 'model');
  if (value.length > MAX_MODEL_LENGTH) {
    throw new ValidationError(`model must be at most ${MAX_MODEL_LENGTH} characters`);
  }
}

function stringifyValue(value) {
  try {
    const json = JSON.stringify(value);
    if (json !== undefined) {
      return json;
    }
  } catch {
    // BigInt, circular, or a throwing toJSON: fall back to String().
  }
  try {
    return String(value);
  } catch {
    return '[unprintable]';
  }
}

// Never throws; printable ASCII only (sanitized before truncating, so no split surrogate pair),
// so the message is safe to copy into an HTTP header such as `x-error`.
function describeValue(value) {
  const text = Array.isArray(value)
    ? `[${value.map(stringifyValue).join(',')}]`
    : stringifyValue(value);
  const safe = text.replace(/[^\x20-\x7E]/g, '?');
  return safe.length > MAX_ECHOED_VALUE_LENGTH ? `${safe.slice(0, MAX_ECHOED_VALUE_LENGTH)}...` : safe;
}

function assertBoundedString(value, name, maxLength) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new ValidationError(
      `${name} must be a non-empty string of at most ${maxLength} characters (got ${describeValue(value)})`,
    );
  }
}

function resolveTarget(target) {
  if (typeof target !== 'string' || !Object.hasOwn(TARGET_CONFIG, target)) {
    throw new ValidationError(
      `target must be one of: ${Object.values(SEMANTIC_TARGETS).join(', ')} (got ${describeValue(target)})`,
    );
  }
  return TARGET_CONFIG[target];
}

/** Free-form filter list: shape-checked and deduped; omitted or empty means no filter (null). */
function toFilterList(values, name, maxLength) {
  if (values === undefined || values === null || (Array.isArray(values) && values.length === 0)) {
    return null;
  }
  if (!Array.isArray(values)) {
    throw new ValidationError(`${name} must be an array`);
  }
  values.forEach((value) => assertBoundedString(value, `each ${name} value`, maxLength));
  const distinct = [...new Set(values)];
  if (distinct.length > MAX_TYPE_FILTER_ITEMS) {
    throw new ValidationError(`${name} must have at most ${MAX_TYPE_FILTER_ITEMS} values (got ${distinct.length})`);
  }
  return distinct;
}

/** Status filter list: values must belong to the model's status enum. */
function toStatusList(values, name, statuses) {
  if (values === undefined || values === null || (Array.isArray(values) && values.length === 0)) {
    return null;
  }
  if (!Array.isArray(values)) {
    throw new ValidationError(`${name} must be an array`);
  }
  const allowed = Object.values(statuses);
  const rejected = values.filter((value) => !allowed.includes(value));
  if (rejected.length > 0) {
    throw new ValidationError(`${name} must only contain: ${allowed.join(', ')} (got ${describeValue(rejected)})`);
  }
  return [...new Set(values)];
}

/** Lowercase, collapse whitespace, and trim, so trivial variants share a hash and a vector. */
export function normalizeText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().toLowerCase() : '';
}

export function hashText(normalized) {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Per-text hygiene shared by writer and reader, so both reject the same input and dedup on the
 * same key. Returns the trimmed `text` and its normalized `key` (what gets embedded and stored),
 * or `null` if unusable.
 *
 * @param {unknown} title - a raw indexed text or query string
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

function chunk(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

async function upsertRows(postgrestClient, table, rows, details) {
  for (const group of chunk(rows, SEMANTIC_CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .upsert(group, { onConflict: 'entity_id,match_type,match_field_type,text_hash' });
    if (error) {
      throw new DataAccessError(`Failed to write ${table}`, details, error);
    }
  }
}

async function deleteRowsById(postgrestClient, table, siteId, ids, details) {
  for (const group of chunk(ids, QUERY_HASH_CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .delete()
      .eq('site_id', siteId)
      .in('id', group);
    if (error) {
      throw new DataAccessError(`Failed to prune ${table}`, details, error);
    }
  }
}

/**
 * Stored rows for many entities, paginated per id chunk so `max-rows` can't truncate.
 * @returns {Promise<Array<{id: string, entity_id: string, match_type: string,
 *   match_field_type: string, text_hash: string}>>}
 */
async function fetchStoredRows(postgrestClient, table, siteId, entityIds, details) {
  const rows = [];
  for (const group of chunk(entityIds, QUERY_HASH_CHUNK_SIZE)) {
    let offset = 0;
    let keepGoing = true;
    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await postgrestClient
        .from(table)
        .select('id, entity_id, match_type, match_field_type, text_hash')
        .eq('site_id', siteId)
        .in('entity_id', group)
        .order('id', { ascending: true })
        .range(offset, offset + DEFAULT_PAGE_SIZE - 1);
      if (error) {
        throw new DataAccessError(`Failed to read ${table}`, details, error);
      }
      rows.push(...(data ?? []));
      offset += DEFAULT_PAGE_SIZE;
      keepGoing = (data?.length ?? 0) >= DEFAULT_PAGE_SIZE;
    }
  }
  return rows;
}

const groupKey = (entityId, matchType, matchFieldType) => `${entityId}\u0000${matchType}\u0000${matchFieldType}`;

/** Validates one indexing group and returns its distinct normalized texts. */
function toGroup({
  entityId, entityType, matchType, matchFieldType, texts,
}) {
  assertId(entityId, 'entityId');
  assertBoundedString(matchFieldType, 'matchFieldType', MAX_MATCH_FIELD_TYPE_LENGTH);
  if (texts !== undefined && texts !== null && !Array.isArray(texts)) {
    throw new ValidationError(`texts must be an array (entity ${entityId}, field ${matchFieldType})`);
  }
  const input = texts ?? [];
  const keys = [...new Set(input
    .map((text) => cleanTopicText(text)?.key)
    .filter((key) => typeof key === 'string'))];
  // A non-empty input reduced to nothing is a caller bug, not a request to clear.
  if (input.length > 0 && keys.length === 0) {
    throw new ValidationError(
      `texts contained no valid entries; pass [] to clear field ${matchFieldType} for entity ${entityId}`,
    );
  }
  if (keys.length > 0) {
    assertBoundedString(entityType, 'entityType', MAX_ENTITY_TYPE_LENGTH);
  }
  return {
    entityId, entityType, matchType, matchFieldType, submitted: input.length, keys,
  };
}

function assertVectors(vectors, count, dims, misses) {
  if (!Array.isArray(vectors) || vectors.length !== count) {
    throw new EmbeddingUnavailableError(
      `Embedding response length mismatch: expected ${count}, got ${vectors?.length}`,
      { misses },
    );
  }
  const bad = vectors.findIndex((v) => !Array.isArray(v) || v.length !== dims);
  if (bad !== -1) {
    throw new EmbeddingUnavailableError(
      `Embedding dimension mismatch: expected ${dims}, got ${vectors[bad]?.length} (check AZURE_EMBEDDING_DEPLOYMENT)`,
      { misses },
    );
  }
}

async function embedInBatches(embeddingClient, texts, dims) {
  const vectors = [];
  for (const group of chunk(texts, EMBEDDING_BATCH_SIZE)) {
    let embedded;
    try {
      // eslint-disable-next-line no-await-in-loop
      embedded = await embeddingClient.createEmbeddings(group);
    } catch (e) {
      throw new EmbeddingUnavailableError(`Embedding call failed: ${e.message}`, { misses: texts.length }, e);
    }
    assertVectors(embedded, group.length, dims, texts.length);
    vectors.push(...embedded);
  }
  return vectors;
}

/**
 * Read the cached embeddings for many texts (keyed by normalized text + model + dims), in groups
 * of `QUERY_HASH_CHUNK_SIZE` hashes.
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
  for (const group of chunk(distinct, QUERY_HASH_CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .select('text_hash, embedding')
      .eq('model', model)
      .eq('dims', dims)
      .in('text_hash', group);
    if (error) {
      throw new DataAccessError(`Failed to read ${QUERY_EMBEDDING_TABLE}`, { model, dims }, error);
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
 * Upsert many embeddings into the cache and stamp `last_access_at`, in groups of
 * `SEMANTIC_CHUNK_SIZE`. Entries whose text normalizes to the same hash are written once (first
 * wins); the stored `text` is the normalized form. Groups are not atomic: a failure can leave
 * earlier groups written, and retrying is safe (idempotent upsert). Requires the
 * `postgrest_writer` role.
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
        text: normalized,
        text_hash: textHash,
        embedding,
        model,
        dims,
        last_access_at: lastAccessAt,
      });
    }
    return textHash;
  });

  for (const group of chunk(rows, SEMANTIC_CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .upsert(group, { onConflict: 'text_hash,model,dims' });
    if (error) {
      throw new DataAccessError(`Failed to upsert ${QUERY_EMBEDDING_TABLE}`, { model, dims }, error);
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

  for (const group of chunk(distinct, QUERY_HASH_CHUNK_SIZE)) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(QUERY_EMBEDDING_TABLE)
      .update({ last_access_at: lastAccessAt })
      .eq('model', model)
      .eq('dims', dims)
      .in('text_hash', group);
    if (error) {
      throw new DataAccessError(`Failed to touch ${QUERY_EMBEDDING_TABLE}`, { model, dims }, error);
    }
  }
}

async function indexSemanticMatches(postgrestClient, embeddingClient, matchType, {
  target, siteId, entities,
} = {}) {
  assertClient(postgrestClient);
  assertEmbeddingClient(embeddingClient);
  const { table } = resolveTarget(target);
  assertId(siteId, 'siteId');
  if (!Array.isArray(entities)) {
    throw new ValidationError('entities must be an array');
  }
  const { model, dims } = SEMANTIC_MATCHING_CONFIG.embedding;

  const groups = [];
  const seenGroups = new Set();
  for (const entity of entities) {
    if (!Array.isArray(entity?.fields)) {
      throw new ValidationError(`fields must be an array (entity ${describeValue(entity?.entityId)})`);
    }
    for (const field of entity.fields) {
      const group = toGroup({
        ...field, matchType, entityId: entity.entityId, entityType: entity.entityType,
      });
      const key = groupKey(group.entityId, matchType, group.matchFieldType);
      if (seenGroups.has(key)) {
        throw new ValidationError(
          `duplicate matchFieldType ${group.matchFieldType} for entity ${group.entityId}`,
        );
      }
      seenGroups.add(key);
      groups.push(group);
    }
  }
  const result = { entities: [], embedded: 0, cacheHits: 0 };
  if (groups.length === 0) {
    return result;
  }
  const details = { table, siteId };

  // Stored rows of the submitted groups only: other match and field types stay as they are.
  const entityIds = [...new Set(groups.map((g) => g.entityId))];
  const storedByGroup = new Map();
  for (const row of await fetchStoredRows(postgrestClient, table, siteId, entityIds, details)) {
    const key = groupKey(row.entity_id, row.match_type, row.match_field_type);
    if (seenGroups.has(key)) {
      if (!storedByGroup.has(key)) {
        storedByGroup.set(key, new Map());
      }
      storedByGroup.get(key).set(row.text_hash, row.id);
    }
  }

  const plans = groups.map((group) => {
    const key = groupKey(group.entityId, group.matchType, group.matchFieldType);
    const stored = storedByGroup.get(key) ?? new Map();
    const hashes = group.keys.map(hashText);
    const keep = new Set(hashes);
    return {
      group,
      toInsert: group.keys.filter((_, i) => !stored.has(hashes[i])),
      staleIds: [...stored.entries()].filter(([hash]) => !keep.has(hash)).map(([, id]) => id),
      unchanged: hashes.filter((hash) => stored.has(hash)).length,
    };
  });

  // New texts: reuse cached vectors (read-only), embed the rest in shared batches.
  const needed = [...new Set(plans.flatMap((plan) => plan.toInsert))];
  const vectorByText = new Map();
  if (needed.length > 0) {
    try {
      const cached = await getQueryEmbeddings(postgrestClient, { texts: needed, model, dims });
      cached.forEach((hit, i) => {
        if (hit?.vector?.length === dims) {
          vectorByText.set(needed[i], hit.vector);
        }
      });
      result.cacheHits = vectorByText.size;
    } catch (e) {
      // A cache read failure only costs extra embeddings.
      result.cacheError = e;
    }
    const misses = needed.filter((text) => !vectorByText.has(text));
    if (misses.length > 0) {
      const vectors = await embedInBatches(embeddingClient, misses, dims);
      misses.forEach((text, i) => vectorByText.set(text, vectors[i]));
      result.embedded = misses.length;
    }
  }

  const rows = plans.flatMap(({ group, toInsert }) => toInsert.map((text) => ({
    site_id: siteId,
    entity_id: group.entityId,
    entity_type: group.entityType,
    match_type: group.matchType,
    match_field_type: group.matchFieldType,
    text,
    text_hash: hashText(text),
    embedding: serializeDimsVector(vectorByText.get(text), dims),
    model,
    dims,
  })));
  await upsertRows(postgrestClient, table, rows, details);
  const allStaleIds = plans.flatMap((plan) => plan.staleIds);
  await deleteRowsById(postgrestClient, table, siteId, allStaleIds, details);

  const byEntity = new Map();
  for (const {
    group, toInsert, staleIds, unchanged,
  } of plans) {
    if (!byEntity.has(group.entityId)) {
      byEntity.set(group.entityId, []);
    }
    byEntity.get(group.entityId).push({
      matchFieldType: group.matchFieldType,
      submitted: group.submitted,
      inserted: toInsert.length,
      deleted: staleIds.length,
      unchanged,
    });
  }
  result.entities = [...byEntity.entries()].map(([entityId, fields]) => ({ entityId, fields }));
  return result;
}

/**
 * Batched topic writer: full-replaces many entities' topic texts in one pass, embedding only what
 * is new. Per (entity, matchFieldType): texts already stored keep their row and vector, new texts
 * are reused from `semantic_query_embedding` when cached (read-only) and otherwise embedded in
 * batched calls shared by all entities, and rows no longer submitted are deleted. An empty `texts`
 * clears that field; fields not submitted, and other match types, are left untouched.
 *
 * Every input is validated and every vector resolved before the first write, so a validation or
 * embedding failure writes nothing. Writes are not atomic across chunks; a retry is safe. Same
 * single-writer caveat as the URL index. Requires the `postgrest_writer` role.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {{createEmbeddings: (texts: string[]) => Promise<number[][]>}} embeddingClient
 * @param {object} params
 * @param {string} params.target - `SEMANTIC_TARGETS` value (`opportunity` | `suggestion`)
 * @param {string} params.siteId - the site every entity belongs to
 * @param {Array<{entityId: string, entityType: string, fields: Array<{matchFieldType: string,
 *   texts: string[]}>}>} params.entities - `entityType` is free-form (e.g. the opportunity type);
 *   `matchFieldType` is a free-form identifier of the field the texts came from (e.g. `topic`)
 * @returns {Promise<{entities: Array<{entityId: string, fields: Array<{matchFieldType: string,
 *   submitted: number, inserted: number, deleted: number, unchanged: number}>}>,
 *   embedded: number, cacheHits: number, cacheError?: Error}>} `cacheError` is set when the
 *   query-cache read failed and every new text was embedded instead
 */
export function indexSemanticTopics(postgrestClient, embeddingClient, params) {
  return indexSemanticMatches(postgrestClient, embeddingClient, SEMANTIC_MATCH_TYPES.TOPIC, params);
}

async function embedWithinBudget(embeddingClient, texts, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([embeddingClient.createEmbeddings(texts), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read side: one vector per query text (embedded in normalized form). One batched cache read, then
 * one embed call for the misses within `timeoutMs`. The cache writes (access bump for hits,
 * populate for misses) are best-effort and come back as a promise the caller awaits alongside the
 * search; they never fail the lookup.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {{createEmbeddings: (texts: string[]) => Promise<number[][]>}} embeddingClient
 * @param {string[]} texts - query texts; each must normalize to a non-empty string
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=EMBEDDING_TIMEOUT_MS] - budget for the embed call
 * @param {object} [opts.log] - logger for non-fatal cache write failures
 * @returns {Promise<{vectors: number[][], cacheWrites: Promise<unknown>, hits: number,
 *   misses: number}>} vectors in `texts` order
 * @throws {EmbeddingUnavailableError} when the embed call fails, times out, or is malformed
 */
export async function embedQueries(postgrestClient, embeddingClient, texts, {
  timeoutMs = EMBEDDING_TIMEOUT_MS, log,
} = {}) {
  assertClient(postgrestClient);
  assertEmbeddingClient(embeddingClient);
  if (!Array.isArray(texts)) {
    throw new ValidationError('texts must be an array');
  }
  const { model, dims } = SEMANTIC_MATCHING_CONFIG.embedding;
  const cacheKey = { model, dims };
  const normalized = texts.map((text) => hashQueryText(text).normalized);

  const cached = await getQueryEmbeddings(postgrestClient, { texts: normalized, ...cacheKey });
  const vectors = cached.map((hit) => (hit?.vector?.length === dims ? hit.vector : null));
  const missIndexes = [];
  vectors.forEach((vector, i) => {
    if (!vector) {
      missIndexes.push(i);
    }
  });
  const misses = missIndexes.map((i) => normalized[i]);

  if (misses.length > 0) {
    let embedded;
    try {
      embedded = await embedWithinBudget(embeddingClient, misses, timeoutMs);
    } catch (e) {
      throw new EmbeddingUnavailableError(`Embedding call failed: ${e.message}`, { misses: misses.length }, e);
    }
    assertVectors(embedded, misses.length, dims, misses.length);
    missIndexes.forEach((idx, j) => {
      vectors[idx] = embedded[j];
    });
  }

  // warn, not debug: a persistently failing upsert turns every repeat query into an embed call.
  const swallow = (label) => (e) => {
    log?.warn?.(`[semantic-index] ${label} failed (non-fatal): ${e.message}`);
  };
  const missSet = new Set(missIndexes);
  const hitHashes = cached
    .filter((hit, i) => hit && !missSet.has(i))
    .map((hit) => hit.textHash);
  const cacheWrites = Promise.all([
    touchQueryEmbeddings(postgrestClient, { textHashes: hitHashes, ...cacheKey })
      .catch(swallow('touchQueryEmbeddings')),
    upsertQueryEmbeddings(postgrestClient, {
      entries: missIndexes.map((idx) => ({ text: normalized[idx], vector: vectors[idx] })),
      ...cacheKey,
    }).catch(swallow('upsertQueryEmbeddings')),
  ]);

  return {
    vectors, cacheWrites, hits: texts.length - misses.length, misses: misses.length,
  };
}

/**
 * Site-scoped nearest-neighbour search for many query vectors against one target's index: for
 * each query, the entities whose vectors best match it, one row per entity (best score). Vectors
 * go in groups of up to `SEMANTIC_CHUNK_SIZE`, fewer when `k` is large, so a call's `group x k`
 * rows stay within PostgREST's max-rows cap.
 */
async function searchByVectors(postgrestClient, target, {
  siteId, matchType, matchFieldTypes, entityTypes, vectors, model, dims, k, minScore, statusParams,
}) {
  const { searchRpc } = resolveTarget(target);
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

  const details = {
    siteId, matchType, matchFieldTypes, entityTypes,
  };
  const results = vectors.map(() => []);
  const groupSize = Math.min(SEMANTIC_CHUNK_SIZE, Math.floor(DEFAULT_PAGE_SIZE / k));
  for (let offset = 0; offset < serialized.length; offset += groupSize) {
    const group = serialized.slice(offset, offset + groupSize);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient.rpc(searchRpc, {
      p_site_id: siteId,
      p_match_type: matchType,
      p_match_field_types: matchFieldTypes,
      p_entity_types: entityTypes,
      p_query_embeddings: group,
      p_model: model,
      p_dims: dims,
      p_limit: k,
      p_min_score: minScore,
      ...statusParams,
    });
    if (error) {
      throw rpcError(`Failed ${target} semantic search for site ${siteId}`, searchRpc, details, error);
    }
    for (const row of data ?? []) {
      // Checked against this group, not all results, so a bad index can't land in another group.
      const { query_index: queryIndex } = row;
      if (!Number.isInteger(queryIndex) || queryIndex < 0 || queryIndex >= group.length) {
        throw new DataAccessError(`Unexpected query_index ${queryIndex} from ${searchRpc}`, details);
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

function searchCommon(postgrestClient, {
  siteId, matchFieldTypes, entityTypes, model, dims,
}) {
  assertClient(postgrestClient);
  assertId(siteId, 'siteId');
  assertModel(model);
  assertDims(dims);
  return {
    matchFieldTypes: toFilterList(matchFieldTypes, 'matchFieldTypes', MAX_MATCH_FIELD_TYPE_LENGTH),
    entityTypes: toFilterList(entityTypes, 'entityTypes', MAX_ENTITY_TYPE_LENGTH),
  };
}

/**
 * Nearest-neighbour topic search of the opportunity index for many query vectors.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.siteId - the site to scope the search to
 * @param {string[]} [params.matchFieldTypes] - field types to narrow to; omitted or empty = all
 * @param {string[]} [params.entityTypes] - opportunity types to narrow to; omitted or empty = all
 * @param {string[]} [params.statuses] - opportunity statuses (`Opportunity.STATUSES` values) to
 *   narrow to, applied before `k`; omitted or empty = all
 * @param {number[][]} params.vectors - the query embeddings
 * @param {string} params.model - the model the queries were embedded with
 * @param {number} params.dims - the query embedding dimension
 * @param {number} [params.k=10] - max opportunities per query
 * @param {number} [params.minScore=0] - cosine-similarity floor
 * @returns {Promise<Array<Array<{entityId: string, entityType: string, score: number}>>>} one
 *   best-first list per input vector, in input order
 */
export async function lookupOpportunitiesByTopic(postgrestClient, {
  siteId, matchFieldTypes, entityTypes, statuses, vectors, model, dims, k = 10, minScore = 0,
} = {}) {
  const lists = searchCommon(postgrestClient, {
    siteId, matchFieldTypes, entityTypes, model, dims,
  });
  return searchByVectors(postgrestClient, SEMANTIC_TARGETS.OPPORTUNITY, {
    siteId,
    matchType: SEMANTIC_MATCH_TYPES.TOPIC,
    ...lists,
    vectors,
    model,
    dims,
    k,
    minScore,
    statusParams: { p_statuses: toStatusList(statuses, 'statuses', Opportunity.STATUSES) },
  });
}

/**
 * Nearest-neighbour topic search of the suggestion index for many query vectors. Same contract as
 * `lookupOpportunitiesByTopic`; `entityTypes` are parent opportunity types, `statuses` are
 * `Suggestion.STATUSES` values and `opportunityStatuses` are the parent opportunity's
 * (`Opportunity.STATUSES`), both applied before `k`.
 *
 * @returns {Promise<Array<Array<{entityId: string, entityType: string, score: number}>>>}
 */
export async function lookupSuggestionsByTopic(postgrestClient, {
  siteId, matchFieldTypes, entityTypes, statuses, opportunityStatuses, vectors, model, dims,
  k = 10, minScore = 0,
} = {}) {
  const lists = searchCommon(postgrestClient, {
    siteId, matchFieldTypes, entityTypes, model, dims,
  });
  return searchByVectors(postgrestClient, SEMANTIC_TARGETS.SUGGESTION, {
    siteId,
    matchType: SEMANTIC_MATCH_TYPES.TOPIC,
    ...lists,
    vectors,
    model,
    dims,
    k,
    minScore,
    statusParams: {
      p_statuses: toStatusList(statuses, 'statuses', Suggestion.STATUSES),
      p_opportunity_statuses: toStatusList(
        opportunityStatuses,
        'opportunityStatuses',
        Opportunity.STATUSES,
      ),
    },
  });
}
