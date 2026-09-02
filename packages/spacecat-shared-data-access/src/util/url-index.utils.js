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

import { canonicalizeUrl } from '@adobe/spacecat-shared-utils';

import { DataAccessError, ValidationError } from '../errors/index.js';
import { DEFAULT_PAGE_SIZE } from './postgrest.utils.js';

/**
 * Shared writer + reader for the "source-URL index" tables (`opportunity_urls`,
 * `suggestion_urls`), which map a canonical source URL to the opportunity/suggestion it backs.
 *
 * Writer and reader share `canonicalizeUrl`, so the canonical form is a PERSISTED format:
 * changing it desyncs stored rows from new lookups and requires re-syncing every row.
 */

/** Tables this helper is allowed to touch. */
export const URL_INDEX_TABLES = Object.freeze(['opportunity_urls', 'suggestion_urls']);

/**
 * Chunk every multi-row op so neither the query string (`in(...)` reads/deletes, HTTP 414) nor
 * the request body (upserts, HTTP 413 against the ~1MB ALB limit) exceeds its limit. Exported so
 * consumers doing their own batching align with the helpers instead of hardcoding the size.
 */
export const URL_CHUNK_SIZE = 50;

function assertClient(postgrestClient) {
  if (!postgrestClient || typeof postgrestClient.from !== 'function') {
    throw new ValidationError('postgrestClient is required');
  }
}

function assertTable(table) {
  if (!URL_INDEX_TABLES.includes(table)) {
    throw new ValidationError(`Invalid url-index table: ${table}`);
  }
}

function assertId(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${name} is required`);
  }
}

/** Only an empty/omitted `urls` clears; a non-empty input reduced to nothing throws. */
function assertClearable(urls, table, entityId) {
  const explicitClear = urls === undefined || urls === null
    || (Array.isArray(urls) && urls.length === 0);
  if (!explicitClear) {
    throw new ValidationError(`urls contained no valid entries; pass [] to clear ${table} for entity ${entityId}`);
  }
}

/** Canonicalize, drop non-strings/empties, and de-duplicate (first-seen order). */
function toCanonicalSet(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') {
      // eslint-disable-next-line no-continue
      continue;
    }
    const canonical = canonicalizeUrl(raw);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

/** Read all indexed URLs for one entity, paginated so a `max-rows` cap can't truncate the set. */
async function fetchIndexedUrls(postgrestClient, table, siteId, entityId) {
  const urls = [];
  let offset = 0;
  let keepGoing = true;
  while (keepGoing) {
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(table)
      .select('url')
      .eq('site_id', siteId)
      .eq('entity_id', entityId)
      .order('url', { ascending: true }) // stable page boundary
      .range(offset, offset + DEFAULT_PAGE_SIZE - 1);
    if (error) {
      throw new DataAccessError(`Failed to read ${table} for entity ${entityId}`, { table, entityId }, error);
    }
    if (!data || data.length === 0) {
      keepGoing = false;
    } else {
      urls.push(...data.map((row) => row.url));
      offset += DEFAULT_PAGE_SIZE;
      keepGoing = data.length >= DEFAULT_PAGE_SIZE;
    }
  }
  return urls;
}

/**
 * Delete the given URLs for one entity, chunked (URI limit). Uses positive `.in(...)` so
 * postgrest-js escapes values — canonical URLs can contain commas a `not.in` string would split.
 */
async function deleteUrls(postgrestClient, table, siteId, entityId, urlsToDelete) {
  for (let i = 0; i < urlsToDelete.length; i += URL_CHUNK_SIZE) {
    const chunk = urlsToDelete.slice(i, i + URL_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .delete()
      .eq('site_id', siteId)
      .eq('entity_id', entityId)
      .in('url', chunk);
    if (error) {
      throw new DataAccessError(`Failed to prune ${table} for entity ${entityId}`, { table, entityId }, error);
    }
  }
}

/**
 * Upsert rows into one table, chunked so the POST body stays under the payload limit. The rows may
 * span many entities; pass `{ entityId }` on the single-entity path so a failure names the entity.
 */
async function upsertRows(postgrestClient, table, rows, { entityId } = {}) {
  for (let i = 0; i < rows.length; i += URL_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + URL_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .upsert(chunk, { onConflict: 'entity_id,url' });
    if (error) {
      const scope = entityId ? ` for entity ${entityId}` : '';
      const details = entityId ? { table, entityId } : { table };
      throw new DataAccessError(`Failed to sync ${table}${scope}`, details, error);
    }
  }
}

/**
 * Read the indexed URLs for many entities at once, grouped by entity. Chunked by entity id (URI
 * limit) and range-paginated within a chunk (max-rows), so neither cap can truncate the set.
 */
async function fetchIndexedUrlsForEntities(postgrestClient, table, siteId, entityIds) {
  const byEntity = new Map(entityIds.map((id) => [id, []]));
  for (let i = 0; i < entityIds.length; i += URL_CHUNK_SIZE) {
    const idChunk = entityIds.slice(i, i + URL_CHUNK_SIZE);
    let offset = 0;
    let keepGoing = true;
    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await postgrestClient
        .from(table)
        .select('entity_id, url')
        .eq('site_id', siteId)
        .in('entity_id', idChunk)
        .order('entity_id', { ascending: true })
        .order('url', { ascending: true }) // stable page boundary
        .range(offset, offset + DEFAULT_PAGE_SIZE - 1);
      if (error) {
        throw new DataAccessError(`Failed to read ${table} for site ${siteId}`, { table, siteId }, error);
      }
      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        for (const row of data) {
          byEntity.get(row.entity_id).push(row.url);
        }
        offset += DEFAULT_PAGE_SIZE;
        keepGoing = data.length >= DEFAULT_PAGE_SIZE;
      }
    }
  }
  return byEntity;
}

/** Clear all rows for many entities in one table, chunked (URI limit on the entity-id `.in`). */
async function clearEntities(postgrestClient, table, siteId, entityIds) {
  for (let i = 0; i < entityIds.length; i += URL_CHUNK_SIZE) {
    const idChunk = entityIds.slice(i, i + URL_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { error } = await postgrestClient
      .from(table)
      .delete()
      .eq('site_id', siteId)
      .in('entity_id', idChunk);
    if (error) {
      throw new DataAccessError(`Failed to clear ${table}`, { table, siteId }, error);
    }
  }
}

/**
 * Full-replace the source URLs indexed for one entity; an empty `urls` clears it (a non-empty
 * input that canonicalizes to nothing throws instead of clearing).
 *
 * Ordered upsert -> prune (read-back, then delete stale) so a mid-run crash leaves the index
 * over-inclusive, not empty. Assumes a SINGLE WRITER per `entityId` — concurrent syncs can
 * race. Requires the `postgrest_writer` role. See CLAUDE.md for the `site_id` scoping caveat.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.table - `opportunity_urls` | `suggestion_urls`
 * @param {string} params.siteId - the site the entity belongs to
 * @param {string} params.entityId - the opportunity/suggestion id
 * @param {string} params.entityType - the opportunity/suggestion type stored on each row
 * @param {string[]} params.urls - raw source URLs (canonicalized here)
 * @returns {Promise<number>} size of the indexed set after sync
 */
export async function syncUrlIndex(postgrestClient, {
  table, siteId, entityId, entityType, urls,
} = {}) {
  assertClient(postgrestClient);
  assertTable(table);
  assertId(siteId, 'siteId');
  assertId(entityId, 'entityId');
  assertId(entityType, 'entityType');

  const canonicalUrls = toCanonicalSet(urls);

  if (canonicalUrls.length === 0) {
    assertClearable(urls, table, entityId);
    const { error: clearError } = await postgrestClient
      .from(table)
      .delete()
      .eq('site_id', siteId)
      .eq('entity_id', entityId);
    if (clearError) {
      throw new DataAccessError(`Failed to clear ${table} for entity ${entityId}`, { table, entityId }, clearError);
    }
    return 0;
  }

  const rows = canonicalUrls.map((url) => ({
    site_id: siteId,
    entity_id: entityId,
    entity_type: entityType,
    url,
  }));

  await upsertRows(postgrestClient, table, rows, { entityId });

  const keep = new Set(canonicalUrls);
  const existing = await fetchIndexedUrls(postgrestClient, table, siteId, entityId);
  const staleUrls = existing.filter((url) => !keep.has(url));
  if (staleUrls.length > 0) {
    await deleteUrls(postgrestClient, table, siteId, entityId, staleUrls);
  }

  return rows.length;
}

/**
 * Batched `syncUrlIndex` for many entities in ONE table: collapses the per-entity fan-out into a
 * single bulk upsert, one batched read-back, and per-entity stale prune (plus a batched clear for
 * empty entries). Same upsert-then-prune and explicit-clear semantics as `syncUrlIndex`, applied
 * per entry. All entries share `siteId` and `entityType`. The single-writer and `postgrest_writer`
 * caveats are identical to `syncUrlIndex`.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.table - `opportunity_urls` | `suggestion_urls`
 * @param {string} params.siteId - the site all entries belong to
 * @param {string} params.entityType - the type stamped on every row
 * @param {Array<{entityId: string, urls: string[]}>} params.entries
 * @returns {Promise<Map<string, number>>} entityId -> size of its indexed set after sync
 */
export async function syncUrlIndexMany(postgrestClient, {
  table, siteId, entityType, entries,
} = {}) {
  assertClient(postgrestClient);
  assertTable(table);
  assertId(siteId, 'siteId');
  assertId(entityType, 'entityType');
  if (!Array.isArray(entries)) {
    throw new ValidationError('entries must be an array');
  }

  const counts = new Map();
  if (entries.length === 0) {
    return counts;
  }

  const toUpsert = [];
  const toClear = [];
  const seen = new Set();
  for (const entry of entries) {
    const { entityId, urls } = entry ?? {};
    assertId(entityId, 'entityId');
    if (seen.has(entityId)) {
      throw new ValidationError(`Duplicate entityId in entries: ${entityId}`);
    }
    seen.add(entityId);

    const canonical = toCanonicalSet(urls);
    if (canonical.length === 0) {
      assertClearable(urls, table, entityId);
      toClear.push(entityId);
      counts.set(entityId, 0);
    } else {
      toUpsert.push({ entityId, canonical });
      counts.set(entityId, canonical.length);
    }
  }

  if (toUpsert.length > 0) {
    const rows = toUpsert.flatMap(
      ({ entityId, canonical }) => canonical.map((url) => ({
        site_id: siteId,
        entity_id: entityId,
        entity_type: entityType,
        url,
      })),
    );
    await upsertRows(postgrestClient, table, rows);

    // Upsert-then-prune, batched: one read-back for all upserted entities, then delete each
    // entity's stale rows (rare in steady state, since a stable url set has none).
    const existingByEntity = await fetchIndexedUrlsForEntities(
      postgrestClient,
      table,
      siteId,
      toUpsert.map((e) => e.entityId),
    );
    for (const { entityId, canonical } of toUpsert) {
      const keep = new Set(canonical);
      const stale = existingByEntity.get(entityId).filter((url) => !keep.has(url));
      if (stale.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await deleteUrls(postgrestClient, table, siteId, entityId, stale);
      }
    }
  }

  if (toClear.length > 0) {
    await clearEntities(postgrestClient, table, siteId, toClear);
  }

  return counts;
}

/**
 * Site-scoped reverse lookup: index rows whose canonical URL matches any given URL. Callers
 * pass raw URLs (canonicalized here, chunked over `.in()`).
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.table - `opportunity_urls` | `suggestion_urls`
 * @param {string} params.siteId - the site to scope the lookup to
 * @param {string[]} params.urls - raw URLs to match (canonicalized here)
 * @returns {Promise<Array<{entity_id: string, entity_type: string, url: string}>>} matched rows
 */
export async function lookupEntityIdsByUrl(postgrestClient, { table, siteId, urls } = {}) {
  assertClient(postgrestClient);
  assertTable(table);
  assertId(siteId, 'siteId');

  const canonicalUrls = toCanonicalSet(urls);
  if (canonicalUrls.length === 0) {
    return [];
  }

  const results = [];
  // Chunked by URL count (URI limit) AND range-paginated within each chunk (max-rows), so neither
  // cap can silently truncate the matches — a hot URL backing many entities is still fully fetched.
  for (let i = 0; i < canonicalUrls.length; i += URL_CHUNK_SIZE) {
    const chunk = canonicalUrls.slice(i, i + URL_CHUNK_SIZE);
    let offset = 0;
    let keepGoing = true;
    while (keepGoing) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await postgrestClient
        .from(table)
        .select('entity_id, entity_type, url')
        .eq('site_id', siteId)
        .in('url', chunk)
        .order('url', { ascending: true })
        .order('entity_id', { ascending: true }) // (url, entity_id) is unique -> stable page boundary
        .range(offset, offset + DEFAULT_PAGE_SIZE - 1);
      if (error) {
        throw new DataAccessError(`Failed to look up ${table} for site ${siteId}`, { table, siteId }, error);
      }
      if (!data || data.length === 0) {
        keepGoing = false;
      } else {
        results.push(...data);
        offset += DEFAULT_PAGE_SIZE;
        keepGoing = data.length >= DEFAULT_PAGE_SIZE;
      }
    }
  }
  return results;
}
