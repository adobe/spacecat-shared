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

import { API_SITES_CF_FRAGMENTS, API_SITES_FRAGMENT_TAGS } from './constants.js';
import { FragmentStateError } from './errors/index.js';

/**
 * Handles Content Fragment tagging operations via the AEM Sites API.
 * @see https://developer.adobe.com/experience-cloud/experience-manager-apis/api/stable/sites/#tag/Tagging
 */
export class FragmentTagging {
  /**
   * Creates a new FragmentTagging instance.
   * @param {Object} client - The client providing request and logging capabilities.
   * @param {Function} client.request - Function to make authenticated HTTP requests.
   * @param {Object} client.log - Logger instance.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Adds tags to a content fragment.
   * @param {string} fragmentId - The UUID of the fragment.
   * @param {Array<string>} tagIds - Array of tag IDs to add.
   * @returns {Promise<Object>} The result containing the updated tags.
   */
  async addTags(fragmentId, tagIds) {
    const { log } = this.client;

    log.info(`[AEM Client][Tagging] Adding ${tagIds.length} tag(s) to fragment ${fragmentId}`);

    try {
      const result = await this.client.request(
        'POST',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}${API_SITES_FRAGMENT_TAGS}`,
        { tags: tagIds },
      );

      log.info(`[AEM Client][Tagging] Successfully added tags to fragment ${fragmentId}`);

      return result;
    } catch (error) {
      log.error(`[AEM Client][Tagging] Failed to add tags to fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Retrieves all tags for a content fragment.
   * @param {string} fragmentId - The UUID of the fragment.
   * @returns {Promise<Object>} Object containing items array of tags and an etag.
   */
  async getTags(fragmentId) {
    const { log } = this.client;

    log.info(`[AEM Client][Tagging] Getting tags for fragment ${fragmentId}`);

    try {
      const result = await this.client.request(
        'GET',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}${API_SITES_FRAGMENT_TAGS}`,
      );

      log.info(`[AEM Client][Tagging] Retrieved ${result?.items?.length || 0} tag(s) for fragment ${fragmentId}`);

      return result;
    } catch (error) {
      log.error(`[AEM Client][Tagging] Failed to get tags for fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Replaces all tags on a content fragment with the provided tags.
   * @param {string} fragmentId - The UUID of the fragment.
   * @param {Array<string>} tagIds - Array of tag IDs to set.
   * @returns {Promise<Object>} The result containing the updated tags.
   * @throws {FragmentStateError} If the current tags have no ETag.
   */
  async replaceTags(fragmentId, tagIds) {
    const { log } = this.client;

    log.info(`[AEM Client][Tagging] Replacing tags on fragment ${fragmentId} with ${tagIds.length} tag(s)`);

    try {
      const currentTags = await this.getTags(fragmentId);
      if (!currentTags || !currentTags.etag) {
        throw new FragmentStateError(fragmentId, 'missing ETag for tags');
      }
      const { etag } = currentTags;

      log.info(`[AEM Client][Tagging] Retrieved ETag ${etag} for current tags of fragment ${fragmentId}`);

      const result = await this.client.request(
        'PUT',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}${API_SITES_FRAGMENT_TAGS}`,
        { tags: tagIds },
        {
          'If-Match': etag,
          'Content-Type': 'application/json',
        },
      );

      log.info(`[AEM Client][Tagging] Successfully replaced tags on fragment ${fragmentId}`);

      return result;
    } catch (error) {
      log.error(`[AEM Client][Tagging] Failed to replace tags on fragment ${fragmentId}:`, error);

      throw error;
    }
  }

  /**
   * Deletes all tags from a content fragment.
   * @param {string} fragmentId - The UUID of the fragment.
   * @returns {Promise<void>}
   * @throws {FragmentStateError} If the current tags have no ETag.
   */
  async deleteTags(fragmentId) {
    const { log } = this.client;
    log.info(`[AEM Client][Tagging] Deleting all tags from fragment ${fragmentId}`);

    try {
      const currentTags = await this.getTags(fragmentId);
      if (!currentTags || !currentTags.etag) {
        throw new FragmentStateError(fragmentId, 'missing ETag for tags');
      }
      const { etag } = currentTags;

      log.info(`[AEM Client][Tagging] Retrieved ETag ${etag} for current tags of fragment ${fragmentId}`);

      await this.client.request(
        'DELETE',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}${API_SITES_FRAGMENT_TAGS}`,
        null,
        {
          'If-Match': etag,
        },
      );

      log.info(`[AEM Client][Tagging] Successfully deleted all tags from fragment ${fragmentId}`);
    } catch (error) {
      log.error(`[AEM Client][Tagging] Failed to delete tags from fragment ${fragmentId}:`, error);

      throw error;
    }
  }
}
