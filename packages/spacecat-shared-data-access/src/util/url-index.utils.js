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

/**
 * Shared writer + reader for the offsite "source-URL index" tables
 * (`opportunity_urls`, `suggestion_urls`). These are pure pointer tables mapping a
 * canonical source URL to the opportunity/suggestion it backs; see the
 * `mysticat-data-service` migrations for the schema.
 *
 * Both the writer and the reader canonicalize URLs with the SAME function
 * (`canonicalizeUrl` from `@adobe/spacecat-shared-utils`), so a value written by
 * `syncUrlIndex` always matches a query normalized by `lookupEntityIdsByUrl`.
 */

/** Tables this helper is allowed to touch (guards against accidental misuse). */
export const URL_INDEX_TABLES = Object.freeze(['opportunity_urls', 'suggestion_urls']);

/**
 * PostgREST `in(...)` filters travel in the query string, so a large list can exceed the
 * URI length limit (HTTP 414). Chunk reads to stay well under it (mirrors
 * `BaseCollection.batchGetByKeys`).
 */
const LOOKUP_CHUNK_SIZE = 50;

function assertClient(postgrestClient) {
  if (!postgrestClient || typeof postgrestClient.from !== 'function') {
    throw new Error('postgrestClient is required');
  }
}

function assertTable(table) {
  if (!URL_INDEX_TABLES.includes(table)) {
    throw new Error(`Invalid url-index table: ${table}`);
  }
}

function assertId(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required`);
  }
}

/**
 * Canonicalize, drop empties, and de-duplicate a list of raw URLs.
 * @param {string[]} urls
 * @returns {string[]} distinct canonical URLs, in first-seen order
 */
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

/**
 * Replace the set of source URLs indexed for a single entity (opportunity or suggestion);
 * an empty `urls` array clears the entity. Ordered upsert-then-prune so a mid-way crash
 * leaves the index over-inclusive rather than empty.
 *
 * The supplied client MUST hold the `postgrest_writer` role (the tables grant DELETE/UPDATE
 * to writer only) — i.e. `dataAccess.services.postgrestClient` in a service configured with
 * `POSTGREST_API_KEY`.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.table - `opportunity_urls` | `suggestion_urls`
 * @param {string} params.siteId - the site the entity belongs to
 * @param {string} params.entityId - the opportunity/suggestion id
 * @param {string} params.entityType - the opportunity type (e.g. `wikipedia-analysis`)
 * @param {string[]} params.urls - raw source URLs (canonicalized here)
 * @returns {Promise<number>} number of rows written
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
    const { error: clearError } = await postgrestClient
      .from(table)
      .delete()
      .eq('entity_id', entityId);
    if (clearError) {
      throw new Error(`Failed to clear ${table} for entity ${entityId}: ${clearError.message}`);
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
    throw new Error(`Failed to sync ${table} for entity ${entityId}: ${upsertError.message}`);
  }

  // Delete via `.in(...)` (not a `not.in` filter) so postgrest-js escapes the values;
  // canonical URLs keep their query strings and can contain commas.
  const { data: existing, error: readError } = await postgrestClient
    .from(table)
    .select('url')
    .eq('entity_id', entityId);
  if (readError) {
    throw new Error(`Failed to read ${table} for entity ${entityId}: ${readError.message}`);
  }

  const keep = new Set(canonicalUrls);
  const staleUrls = (Array.isArray(existing) ? existing : [])
    .map((row) => row.url)
    .filter((url) => !keep.has(url));
  if (staleUrls.length > 0) {
    const { error: pruneError } = await postgrestClient
      .from(table)
      .delete()
      .eq('entity_id', entityId)
      .in('url', staleUrls);
    if (pruneError) {
      throw new Error(`Failed to prune ${table} for entity ${entityId}: ${pruneError.message}`);
    }
  }

  return rows.length;
}

/**
 * Look up index rows whose canonical URL matches any of the given URLs, for one site.
 * URLs are canonicalized with the same function used on write, so callers pass raw URLs.
 *
 * @param {object} postgrestClient - `@supabase/postgrest-js` client
 * @param {object} params
 * @param {string} params.table - `opportunity_urls` | `suggestion_urls`
 * @param {string} params.siteId - the site to scope the lookup to
 * @param {string[]} params.urls - raw URLs to match (canonicalized here)
 * @returns {Promise<Array<{entity_id: string, entity_type: string, url: string}>>}
 *   matched rows (the `url` is the canonical form that matched)
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
  for (let i = 0; i < canonicalUrls.length; i += LOOKUP_CHUNK_SIZE) {
    const chunk = canonicalUrls.slice(i, i + LOOKUP_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await postgrestClient
      .from(table)
      .select('entity_id, entity_type, url')
      .eq('site_id', siteId)
      .in('url', chunk);
    if (error) {
      throw new Error(`Failed to look up ${table} for site ${siteId}: ${error.message}`);
    }
    if (Array.isArray(data)) {
      results.push(...data);
    }
  }
  return results;
}
