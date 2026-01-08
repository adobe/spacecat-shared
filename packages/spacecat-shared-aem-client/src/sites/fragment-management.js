/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { API_SITES_CF_FRAGMENTS } from './constants.js';
import { FragmentNotFoundError, FragmentStateError } from './errors/index.js';

/**
 * Handles Content Fragment CRUD operations via the AEM Sites API.
 * @see https://developer.adobe.com/experience-cloud/experience-manager-apis/api/stable/sites/#tag/Fragment-Management
 */
export class FragmentManagement {
  /**
   * Creates a new FragmentManagement instance.
   * @param {Object} client - The client providing request and logging capabilities.
   * @param {Function} client.request - Function to make authenticated HTTP requests.
   * @param {Object} client.log - Logger instance.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Resolves a fragment path to its UUID identifier.
   * @param {string} fragmentPath - The path of the content fragment.
   * @returns {Promise<string>} The UUID of the fragment.
   * @throws {FragmentNotFoundError} If no fragment exists at the specified path.
   */
  async resolveFragmentId(fragmentPath) {
    const { log } = this.client;

    log.info(`[AEM Client][Fragment Management] Resolving fragment ID for path ${fragmentPath}`);

    try {
      const result = await this.client.request(
        'GET',
        `${API_SITES_CF_FRAGMENTS}?path=${encodeURIComponent(fragmentPath)}&limit=1`,
      );

      if (!result || !result.items || result.items.length === 0) {
        throw new FragmentNotFoundError(fragmentPath);
      }

      const fragmentId = result.items[0].id;

      log.info(`[AEM Client][Fragment Management] Resolved ${fragmentPath} to ID ${fragmentId}`);

      return fragmentId;
    } catch (error) {
      log.error(
        `[AEM Client][Fragment Management] Failed to resolve fragment ID for ${fragmentPath}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Creates a new content fragment.
   * @param {string} parentPath - The parent folder path where the fragment will be created.
   * @param {Object} data - The fragment data.
   * @param {string} data.title - The display title of the fragment.
   * @param {string} data.name - The node name for the fragment (URL-safe).
   * @param {string} data.modelId - The base64-encoded model ID.
   * @param {Array} data.fields - Array of field definitions with values.
   * @returns {Promise<Object>} The created fragment data.
   */
  async createFragment(parentPath, data) {
    const { log } = this.client;

    log.info(`[AEM Client][Fragment Management] Creating fragment in ${parentPath}`);

    const payload = {
      title: data?.title,
      name: data?.name,
      modelId: data?.modelId,
      parentPath,
      fields: data?.fields,
    };

    try {
      const createdFragment = await this.client.request('POST', API_SITES_CF_FRAGMENTS, payload);

      log.info(`[AEM Client][Fragment Management] Successfully created fragment in ${parentPath}`);

      return createdFragment;
    } catch (error) {
      log.error(`[AEM Client][Fragment Management] Failed to create fragment in ${parentPath}:`, error);

      throw error;
    }
  }

  /**
   * Retrieves a content fragment by its UUID.
   * @param {string} fragmentId - The UUID of the fragment.
   * @returns {Promise<Object>} The fragment data including an etag property.
   */
  async getFragmentById(fragmentId) {
    const { log } = this.client;

    log.info(`[AEM Client][Fragment Management] Getting fragment ${fragmentId}`);

    try {
      const fragment = await this.client.request(
        'GET',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}`,
      );

      log.info(`[AEM Client][Fragment Management] Successfully retrieved fragment ${fragmentId}`);

      return fragment;
    } catch (error) {
      log.error(`[AEM Client][Fragment Management] Failed to get fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Retrieves a content fragment by its path.
   * @param {string} fragmentPath - The path of the fragment.
   * @returns {Promise<Object>} The fragment data including an etag property.
   */
  async getFragment(fragmentPath) {
    const fragmentId = await this.resolveFragmentId(fragmentPath);
    return this.getFragmentById(fragmentId);
  }

  /**
   * Applies JSON Patch operations to a fragment by its UUID.
   * @param {string} fragmentId - The UUID of the fragment.
   * @param {Array} patches - Array of JSON Patch operations.
   * @returns {Promise<Object>} The updated fragment data.
   * @throws {FragmentStateError} If the fragment has no ETag for optimistic locking.
   */
  async patchFragmentById(fragmentId, patches) {
    const { log } = this.client;

    log.info(
      `[AEM Client][Fragment Management] Patching fragment ${fragmentId} with ${patches.length} operation(s)`,
    );

    try {
      const currentFragment = await this.getFragmentById(fragmentId);
      if (!currentFragment || !currentFragment.etag) {
        throw new FragmentStateError(fragmentId, 'missing ETag');
      }
      const { etag } = currentFragment;

      log.info(`[AEM Client][Fragment Management] Retrieved ETag ${etag} for fragment ${fragmentId}`);

      const updatedFragment = await this.client.request(
        'PATCH',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}`,
        patches,
        {
          'If-Match': etag,
          'Content-Type': 'application/json-patch+json',
        },
      );

      log.info(`[AEM Client][Fragment Management] Successfully patched fragment ${fragmentId}`);

      return updatedFragment;
    } catch (error) {
      log.error(`[AEM Client][Fragment Management] Failed to patch fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Applies JSON Patch operations to a fragment by its path.
   * @param {string} fragmentPath - The path of the fragment.
   * @param {Array} patches - Array of JSON Patch operations.
   * @returns {Promise<Object>} The updated fragment data.
   */
  async patchFragment(fragmentPath, patches) {
    const fragmentId = await this.resolveFragmentId(fragmentPath);
    return this.patchFragmentById(fragmentId, patches);
  }

  /**
   * Deletes a content fragment by its UUID.
   * @param {string} fragmentId - The UUID of the fragment to delete.
   * @returns {Promise<null>} Null on successful deletion.
   * @throws {FragmentStateError} If the fragment has no ETag for optimistic locking.
   */
  async deleteFragmentById(fragmentId) {
    const { log } = this.client;

    log.info(`[AEM Client][Fragment Management] Deleting fragment ${fragmentId}`);

    try {
      const currentFragment = await this.getFragmentById(fragmentId);
      if (!currentFragment || !currentFragment.etag) {
        throw new FragmentStateError(fragmentId, 'missing ETag');
      }
      const { etag } = currentFragment;

      const result = await this.client.request(
        'DELETE',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}`,
        null,
        {
          'If-Match': etag,
        },
      );

      log.info(`[AEM Client][Fragment Management] Successfully deleted fragment ${fragmentId}`);

      return result;
    } catch (error) {
      log.error(`[AEM Client][Fragment Management] Failed to delete fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Deletes a content fragment by its path.
   * @param {string} fragmentPath - The path of the fragment to delete.
   * @returns {Promise<null>} Null on successful deletion.
   */
  async deleteFragment(fragmentPath) {
    const fragmentId = await this.resolveFragmentId(fragmentPath);
    return this.deleteFragmentById(fragmentId);
  }

  /**
   * Lists content fragments under a path with pagination support.
   * @param {string} path - The DAM path to search (e.g., /content/dam/).
   * @param {Object} [options={}] - Query options.
   * @param {string} [options.cursor] - Pagination cursor from previous response.
   * @param {string} [options.projection='minimal'] - Response projection (minimal, full).
   * @param {number} [options.limit] - Maximum items per page.
   * @returns {Promise<{items: Array, cursor: string|null}>} Paginated fragment list.
   */
  async getFragments(path, options = {}) {
    const { log } = this.client;
    const {
      cursor = null,
      projection = 'minimal',
      limit = 1,
    } = options;

    log.info(`[AEM Client][Fragment Management] Listing fragments from ${path}`);

    const params = new URLSearchParams({
      path,
      projection,
    });

    if (cursor) {
      params.set('cursor', cursor);
    }

    if (limit) {
      params.set('limit', limit.toString());
    }

    const queryPath = `${API_SITES_CF_FRAGMENTS}?${params.toString()}`;

    try {
      const data = await this.client.request('GET', queryPath);

      log.info(`[AEM Client][Fragment Management] Retrieved ${data?.items?.length || 0} fragments from ${path}`);

      return {
        items: data?.items || [],
        cursor: data?.cursor || null,
      };
    } catch (error) {
      log.error(`[AEM Client][Fragment Management] Failed to list fragments from ${path}:`, error);

      throw error;
    }
  }
}
