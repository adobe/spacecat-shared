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

import { API_SITES_CF_FRAGMENTS, API_SITES_FRAGMENT_VERSIONS } from './constants.js';

/**
 * Handles Content Fragment versioning operations via the AEM Sites API.
 * @see https://developer.adobe.com/experience-cloud/experience-manager-apis/api/stable/sites/#tag/Fragment-Versioning
 */
export class FragmentVersioning {
  /**
   * Creates a new FragmentVersioning instance.
   * @param {Object} client - The client providing request and logging capabilities.
   * @param {Function} client.request - Function to make authenticated HTTP requests.
   * @param {Object} client.log - Logger instance.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Creates a new version for a fragment.
   * @param {string} fragmentId - The UUID of the fragment.
   * @param {Object} [options={}] - Version options.
   * @param {string} [options.label] - Optional label for the version.
   * @param {string} [options.comment] - Optional comment describing the version.
   * @returns {Promise<Object>} The created version data.
   */
  async createVersion(fragmentId, { label, comment } = {}) {
    const { log } = this.client;

    log.info(`[AEM Client][Fragment Versioning] Creating version for fragment ${fragmentId}`);

    const payload = {};
    if (label) {
      payload.label = label;
    }
    if (comment) {
      payload.comment = comment;
    }

    try {
      const version = await this.client.request(
        'POST',
        `${API_SITES_CF_FRAGMENTS}/${fragmentId}${API_SITES_FRAGMENT_VERSIONS}`,
        payload,
      );

      log.info(`[AEM Client][Fragment Versioning] Created version for fragment ${fragmentId}`);

      return version;
    } catch (error) {
      log.error(
        `[AEM Client][Fragment Versioning] Failed to create version for fragment ${fragmentId}: ${error.message}`,
      );

      throw error;
    }
  }
}
