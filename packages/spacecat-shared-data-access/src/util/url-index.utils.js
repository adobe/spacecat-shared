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

/** Chunk `in(...)` reads/deletes to keep the query string under the URI limit (HTTP 414). */
const URL_CHUNK_SIZE = 50;

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
    // Only an explicit empty/omitted `urls` clears; a non-empty input reduced to nothing is a
    // caller bug, not an intent to wipe the index.
    const explicitClear = urls === undefined || urls === null
      || (Array.isArray(urls) && urls.length === 0);
    if (!explicitClear) {
      throw new ValidationError(`urls contained no valid entries; pass [] to clear ${table} for entity ${entityId}`);
    }
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

  const { error: upsertError } = await postgrestClient
    .from(table)
    .upsert(rows, { onConflict: 'entity_id,url' });
  if (upsertError) {
    throw new DataAccessError(`Failed to sync ${table} for entity ${entityId}`, { table, entityId }, upsertError);
  }

  const keep = new Set(canonicalUrls);
  const existing = await fetchIndexedUrls(postgrestClient, table, siteId, entityId);
  const staleUrls = existing.filter((url) => !keep.has(url));
  if (staleUrls.length > 0) {
    await deleteUrls(postgrestClient, table, siteId, entityId, staleUrls);
  }

  return rows.length;
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
  for (let i = 0; i < canonicalUrls.length; i += URL_CHUNK_SIZE) {
    const chunk = canonicalUrls.slice(i, i + URL_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(table)
      .select('entity_id, entity_type, url')
      .eq('site_id', siteId)
      .in('url', chunk);
    if (error) {
      throw new DataAccessError(`Failed to look up ${table} for site ${siteId}`, { table, siteId }, error);
    }
    if (Array.isArray(data)) {
      results.push(...data);
    }
  }
  return results;
}
