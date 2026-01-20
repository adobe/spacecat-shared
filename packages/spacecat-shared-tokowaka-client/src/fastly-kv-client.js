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

import {
  tracingFetch as fetch,
  hasText,
  isNonEmptyArray,
} from '@adobe/spacecat-shared-utils';

const FASTLY_KV_API_BASE = 'https://api.fastly.com/resources/stores/kv';
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT = 30000;

/**
 * Client for interacting with Fastly KV Store used by Tokowaka.
 * Used to fetch stale suggestion IDs for cleanup.
 *
 * Key format: `${suggestionId}`
 * Value format: { url: string, status: 'stale' | 'live' }
 */
export class FastlyKVClient {
  /**
   * Creates a new FastlyKVClient instance.
   * @param {object} env - Environment variables containing FASTLY_KV_STORE_ID and FASTLY_API_TOKEN
   * @param {object} log - Logger instance
   */
  constructor(env, log) {
    if (!hasText(env?.FASTLY_KV_STORE_ID)) {
      throw new Error('FASTLY_KV_STORE_ID environment variable is required');
    }
    if (!hasText(env?.FASTLY_API_TOKEN)) {
      throw new Error('FASTLY_API_TOKEN environment variable is required');
    }

    this.storeId = env.FASTLY_KV_STORE_ID;
    this.apiToken = env.FASTLY_API_TOKEN;
    this.log = log;
    this.timeout = env.FASTLY_KV_TIMEOUT || DEFAULT_TIMEOUT;
  }

  /**
   * Creates the authorization headers for Fastly API requests.
   * @returns {object} Headers object
   */
  #getHeaders() {
    return {
      'Fastly-Key': this.apiToken,
      Accept: 'application/json',
    };
  }

  /**
   * Retrieves the value for a specific key from the KV store.
   *
   * @param {string} key - The key to retrieve
   * @returns {Promise<{url: string, status: string}|null>} The parsed value or null if not found
   */
  async #getValue(key) {
    const url = `${FASTLY_KV_API_BASE}/${this.storeId}/keys/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.#getHeaders(),
      timeout: this.timeout,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get value from KV Store: ${response.status} - ${errorText}`);
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      this.log.warn(`Failed to parse value for key ${key} as JSON`);
      return { url: text, status: 'unknown' };
    }
  }

  /**
   * Lists stale keys from a single page of the KV store.
   *
   * @param {object} [options] - Options for listing keys
   * @param {number} [options.pageSize=100] - Number of keys to fetch per page
   * @param {string} [options.cursor] - Cursor for pagination
   * @returns {Promise<{keys: Array<object>, cursor: string|null}>}
   */
  async #listStaleKeysPage(options = {}) {
    const { pageSize = DEFAULT_PAGE_SIZE, cursor } = options;
    const staleEntries = [];

    const url = new URL(`${FASTLY_KV_API_BASE}/${this.storeId}/keys`);
    url.searchParams.set('limit', pageSize.toString());
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.#getHeaders(),
      timeout: this.timeout,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list keys from KV Store: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const { data: keys = [], meta = {} } = result;

    for (const keyName of keys) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const value = await this.#getValue(keyName);

        const normalizedStatus = typeof value?.status === 'string'
          ? value.status.trim().toLowerCase()
          : '';

        if (normalizedStatus === 'stale' && hasText(keyName)) {
          staleEntries.push({
            key: keyName,
            suggestionId: keyName,
            url: value.url,
          });
        }
      } catch (error) {
        this.log.warn(`Failed to fetch value for key ${keyName}: ${error.message}`);
      }
    }

    return {
      keys: staleEntries,
      cursor: meta.next_cursor || null,
    };
  }

  /**
   * Lists all stale suggestion IDs from the KV store, handling pagination automatically.
   *
   * @param {object} [options] - Options for listing keys
   * @param {number} [options.pageSize=100] - Number of keys to fetch per page
   * @param {number} [options.maxPages=100] - Maximum number of pages to fetch (safety limit)
   * @returns {Promise<Array<{key: string, suggestionId: string, url: string}>>}
   */
  async listAllStaleKeys(options = {}) {
    const { pageSize = DEFAULT_PAGE_SIZE, maxPages = 100 } = options;
    const allStaleKeys = [];
    let cursor = null;
    let pageCount = 0;

    this.log.info('Starting to fetch stale keys from Fastly KV Store');

    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.#listStaleKeysPage({ pageSize, cursor });

      if (isNonEmptyArray(result.keys)) {
        allStaleKeys.push(...result.keys);
      }

      cursor = result.cursor;
      pageCount += 1;

      this.log.debug(
        `Fetched page ${pageCount}, found ${result.keys.length} stale keys, total: ${allStaleKeys.length}`,
      );

      if (pageCount >= maxPages) {
        this.log.warn(`Reached maximum page limit (${maxPages}), stopping pagination`);
        break;
      }
    } while (cursor);

    this.log.info(`Completed fetching stale keys: ${allStaleKeys.length} total from ${pageCount} pages`);

    return allStaleKeys;
  }
}

export default FastlyKVClient;
