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

/**
 * Base class for CDN clients
 * Defines the interface that all CDN-specific clients must implement
 */
export default class BaseCdnClient {
  constructor(config, log) {
    this.config = config;
    this.log = log;
  }

  /**
   * Returns the CDN provider name (e.g., 'akamai', 'cloudflare', 'fastly')
   * @returns {string} The CDN provider name
   */
  // eslint-disable-next-line class-methods-use-this
  getProviderName() {
    throw new Error('getProviderName() must be implemented by subclass');
  }

  /**
   * Validates the CDN configuration
   * @returns {boolean} True if configuration is valid
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  validateConfig() {
    return true; // Override in subclass if needed
  }

  /**
   * Invalidates the CDN cache for the given paths
   * @param {Array<string>} paths - Array of URL paths to invalidate
   * @returns {Promise<Object>} Result of the invalidation request
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async invalidateCache(_paths) {
    throw new Error('invalidateCache() must be implemented by subclass');
  }

  /**
   * Checks the status of an invalidation request
   * @param {string} requestId - The invalidation request ID
   * @returns {Promise<Object>} Status of the invalidation request
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async getInvalidationStatus(_requestId) {
    // Optional: Override in subclass if supported
    return { status: 'unknown', message: 'Status check not supported' };
  }
}
