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

import BaseCdnClient from './base-cdn-client.js';

/**
 * Fastly CDN client implementation
 * Handles cache invalidation for Fastly CDN using surrogate key purging
 */
export default class FastlyCdnClient extends BaseCdnClient {
  constructor(env, log) {
    super(env, log);
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(env.TOKOWAKA_CDN_CONFIG);
    } catch (e) {
      throw new Error('Invalid TOKOWAKA_CDN_CONFIG: must be valid JSON');
    }

    if (!parsedConfig.fastly) {
      throw new Error("Missing 'fastly' config in TOKOWAKA_CDN_CONFIG");
    }

    this.cdnConfig = parsedConfig.fastly;
    this.providerName = 'fastly';
  }

  getProviderName() {
    return this.providerName;
  }

  validateConfig() {
    // serviceId, apiToken, and distributionUrl are required for Fastly API
    if (!this.cdnConfig.serviceId || !this.cdnConfig.apiToken) {
      this.log.error('Fastly CDN config missing required fields: serviceId and apiToken');
      return false;
    }

    if (!this.cdnConfig.distributionUrl) {
      this.log.error('Fastly CDN config missing distributionUrl (CloudFront distribution URL)');
      return false;
    }

    return true;
  }

  /**
   * Invalidates Fastly CDN cache for given paths using surrogate key purging
   * Constructs full CloudFront URLs as surrogate keys for Fastly purge
   * Works efficiently for both single and multiple paths
   * @param {Array<string>} paths - Array of URL paths to invalidate
   *   (e.g., '/opportunities/adobe.com/config')
   * @returns {Promise<Object>} Result of the invalidation request
   */
  async invalidateCache(paths) {
    if (!this.validateConfig()) {
      throw new Error('Invalid Fastly CDN configuration');
    }

    if (!Array.isArray(paths) || paths.length === 0) {
      this.log.warn('No paths provided for cache invalidation');
      return { status: 'skipped', message: 'No paths to invalidate' };
    }

    this.log.info(`Starting Fastly cache invalidation for ${paths.length} path(s)`);

    // Construct full CloudFront URLs as surrogate keys
    // Example: "https://deftbrsarcsf4.cloudfront.net/opportunities/adobe.com/config"
    const surrogateKeys = paths.map((path) => {
      // Ensure path starts with /
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      // Combine CloudFront distribution URL with path
      const fullUrl = `${this.cdnConfig.distributionUrl}${normalizedPath}`;
      return fullUrl;
    });

    this.log.debug(`Generated ${surrogateKeys.length} surrogate key(s) for purge`);
    // info level for testing purpose, will be removed before merge to main
    this.log.info(`Surrogate keys: ${surrogateKeys.join(', ')}`);

    const startTime = Date.now();
    const apiEndpoint = `https://api.fastly.com/service/${this.cdnConfig.serviceId}/purge`;
    this.log.debug(`Calling Fastly API: POST ${apiEndpoint}`);
    try {
      // Fastly batch purge using Surrogate-Key header (space-separated)
      // Works for both single and multiple keys
      const response = await fetch(
        `https://api.fastly.com/service/${this.cdnConfig.serviceId}/purge`,
        {
          method: 'POST',
          headers: {
            'Fastly-Key': this.cdnConfig.apiToken,
            'Surrogate-Key': surrogateKeys.join(' '),
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.log.error(`Failed to purge Fastly cache: ${response.status} - ${errorText}`);
        return {
          status: 'failed',
          provider: 'fastly',
          serviceId: this.cdnConfig.serviceId,
          totalPaths: paths.length,
          totalKeys: surrogateKeys.length,
          successCount: 0,
          failedCount: surrogateKeys.length,
          error: errorText,
          duration: Date.now() - startTime,
        };
      }

      const result = await response.json();
      const duration = Date.now() - startTime;
      this.log.info(
        `Successfully purged ${surrogateKeys.length} Fastly cache key(s) `
        + `for service ${this.cdnConfig.serviceId} (took ${duration}ms)`,
      );

      return {
        status: 'success',
        provider: 'fastly',
        serviceId: this.cdnConfig.serviceId,
        totalPaths: paths.length,
        totalKeys: surrogateKeys.length,
        successCount: surrogateKeys.length,
        failedCount: 0,
        purgeId: result.id,
        duration,
      };
    } catch (error) {
      this.log.error(`Error purging Fastly cache: ${error.message}`, error);
      return {
        status: 'error',
        provider: 'fastly',
        serviceId: this.cdnConfig.serviceId,
        totalPaths: paths.length,
        totalKeys: surrogateKeys.length,
        successCount: 0,
        failedCount: surrogateKeys.length,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }
}
