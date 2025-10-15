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

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { hasText, isNonEmptyObject } from '@adobe/spacecat-shared-utils';
import MapperRegistry from './mappers/mapper-registry.js';
import BaseOpportunityMapper from './mappers/base-mapper.js';
import CdnClientRegistry from './cdn/cdn-client-registry.js';

const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_NOT_IMPLEMENTED = 501;

/**
 * Tokowaka Client - Manages edge optimization configurations
 */
class TokowakaClient {
  /**
   * Creates a TokowakaClient from context
   * @param {Object} context - The context object
   * @returns {TokowakaClient} - The client instance
   */
  static createFrom(context) {
    const { env, log = console, s3Client } = context;
    const { TOKOWAKA_CONFIG_BUCKET: bucketName } = env;

    if (context.tokowakaClient) {
      return context.tokowakaClient;
    }

    const client = new TokowakaClient({ bucketName, s3Client }, log);
    context.tokowakaClient = client;
    return client;
  }

  /**
   * Constructor
   * @param {Object} config - Configuration object
   * @param {string} config.bucketName - S3 bucket name for configs
   * @param {Object} config.s3Client - AWS S3 client
   * @param {Object} log - Logger instance
   */
  constructor({ bucketName, s3Client }, log) {
    this.log = log;

    if (!hasText(bucketName)) {
      throw this.#createError('TOKOWAKA_CONFIG_BUCKET is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(s3Client)) {
      throw this.#createError('S3 client is required', HTTP_BAD_REQUEST);
    }

    this.bucketName = bucketName;
    this.s3Client = s3Client;

    this.mapperRegistry = new MapperRegistry(log);
    this.cdnClientRegistry = new CdnClientRegistry(log);
  }

  #createError(message, status) {
    const error = Object.assign(new Error(message), { status });
    this.log.error(error.message);
    return error;
  }

  /**
   * Generates Tokowaka site configuration from suggestions
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities
   * @returns {Object} - Tokowaka configuration object
   */
  generateConfig(site, opportunity, suggestions) {
    const opportunityType = opportunity.getType();
    const siteId = site.getId();
    const baseURL = site.getBaseURL();

    // Get mapper for this opportunity type
    const mapper = this.mapperRegistry.getMapper(opportunityType);
    if (!mapper) {
      throw this.#createError(
        `No mapper found for opportunity type: ${opportunityType}. `
        + `Supported types: ${this.mapperRegistry.getSupportedOpportunityTypes().join(', ')}`,
        HTTP_NOT_IMPLEMENTED,
      );
    }

    // Group suggestions by URL
    const suggestionsByUrl = suggestions.reduce((acc, suggestion) => {
      const data = suggestion.getData();
      const url = data?.url;

      if (!url) {
        this.log.warn(`Suggestion ${suggestion.getId()} does not have a URL, skipping`);
        return acc;
      }

      let urlPath;
      try {
        urlPath = new URL(url).pathname;
      } catch (e) {
        this.log.warn(`Invalid URL for suggestion ${suggestion.getId()}: ${url}`);
        return acc;
      }

      if (!acc[urlPath]) {
        acc[urlPath] = [];
      }
      acc[urlPath].push(suggestion);
      return acc;
    }, {});

    // Generate patches for each URL using the mapper
    const tokowakaOptimizations = {};

    Object.entries(suggestionsByUrl).forEach(([urlPath, urlSuggestions]) => {
      const patches = urlSuggestions.map((suggestion) => {
        const patch = mapper.suggestionToPatch(suggestion, opportunity.getId());
        return patch;
      }).filter((patch) => patch !== null);

      if (patches.length > 0) {
        tokowakaOptimizations[urlPath] = {
          prerender: mapper.requiresPrerender(),
          patches,
        };
      }
    });

    return {
      siteId,
      baseURL,
      version: '1.0',
      tokowakaForceFail: false,
      tokowakaOptimizations,
    };
  }

  /**
   * Registers a custom mapper for an opportunity type
   * This allows extending the client with new opportunity types
   * @param {BaseOpportunityMapper} mapper - Mapper instance
   */
  registerMapper(mapper) {
    this.mapperRegistry.registerMapper(mapper);
  }

  /**
   * Gets list of supported opportunity types
   * @returns {string[]} - Array of supported opportunity types
   */
  getSupportedOpportunityTypes() {
    return this.mapperRegistry.getSupportedOpportunityTypes();
  }

  /**
   * Uploads Tokowaka configuration to S3
   * @param {string} apiKey - Tokowaka API key (used as S3 key prefix)
   * @param {Object} config - Tokowaka configuration object
   * @returns {Promise<string>} - S3 key of uploaded config
   */
  async uploadConfig(apiKey, config) {
    if (!hasText(apiKey)) {
      throw this.#createError('Tokowaka API key is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(config)) {
      throw this.#createError('Config object is required', HTTP_BAD_REQUEST);
    }

    const s3Key = `${apiKey}/v1/tokowaka-site-config.json`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded Tokowaka config to s3://${this.bucketName}/${s3Key}`);

      return s3Key;
    } catch (error) {
      this.log.error(`Failed to upload Tokowaka config to S3: ${error.message}`, error);
      throw this.#createError(`S3 upload failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Invalidates CDN cache for the Tokowaka config
   * @param {Object} site - Site entity
   * @param {string} s3Key - S3 key of the uploaded config
   * @returns {Promise<Object|null>} - CDN invalidation result or null if skipped
   */
  async invalidateCdnCache(site, s3Key) {
    const siteConfig = site.getConfig() || {};
    const { cdn } = siteConfig;

    if (!isNonEmptyObject(cdn)) {
      this.log.info('No CDN configuration found for site, skipping cache invalidation');
      return null;
    }

    const { provider, config: cdnConfig } = cdn;

    if (!hasText(provider) || !cdnConfig) {
      this.log.warn('CDN provider or config not specified in site config, skipping cache invalidation');
      return null;
    }

    try {
      const cdnClient = this.cdnClientRegistry.getClient(provider, cdnConfig);

      if (!cdnClient) {
        this.log.warn(`No CDN client available for provider: ${provider}, skipping cache invalidation`);
        return null;
      }

      // Build CDN paths to invalidate
      // The config is accessed via the Tokowaka API key path
      const baseURL = site.getBaseURL();
      const pathsToInvalidate = [
        `${baseURL}/${s3Key}`,
      ];

      this.log.debug(`Invalidating CDN cache for ${pathsToInvalidate.length} paths via ${provider}`);
      const result = await cdnClient.invalidateCache(pathsToInvalidate);

      this.log.info(`CDN cache invalidation completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      // Log error but don't fail the deployment
      this.log.error(`CDN cache invalidation failed (non-fatal): ${error.message}`, error);
      return {
        status: 'error',
        provider,
        message: error.message,
      };
    }
  }

  /**
   * Deploys suggestions to Tokowaka by generating config and uploading to S3
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities
   * @returns {Promise<Object>} - Deployment result with s3Key
   */
  async deploySuggestions(site, opportunity, suggestions) {
    // Get site's Tokowaka API key
    const { tokowakaApiKey } = site.getConfig() || {};

    if (!hasText(tokowakaApiKey)) {
      throw this.#createError(
        'Site does not have a Tokowaka API key configured. Please onboard the site to Tokowaka first.',
        HTTP_BAD_REQUEST,
      );
    }

    // Generate configuration
    this.log.info(`Generating Tokowaka config for site ${site.getId()}, opportunity ${opportunity.getId()}`);
    const config = this.generateConfig(site, opportunity, suggestions);

    // Upload to S3
    this.log.info(`Uploading Tokowaka config for ${suggestions.length} suggestions`);
    const s3Key = await this.uploadConfig(tokowakaApiKey, config);

    // // Invalidate CDN cache (non-blocking, failures are logged but don't fail deployment)
    // const cdnInvalidationResult = await this.invalidateCdnCache(site, s3Key);

    return {
      tokowakaApiKey,
      s3Key,
      config,
      // cdnInvalidation: cdnInvalidationResult,
    };
  }
}

// Export the client as default and base classes for custom implementations
export default TokowakaClient;
export { BaseOpportunityMapper };
export { default as BaseCdnClient } from './cdn/base-cdn-client.js';
export { default as AkamaiCdnClient } from './cdn/akamai-cdn-client.js';
export { default as CdnClientRegistry } from './cdn/cdn-client-registry.js';
