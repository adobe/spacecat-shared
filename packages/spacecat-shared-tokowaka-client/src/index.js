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

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { hasText, isNonEmptyObject } from '@adobe/spacecat-shared-utils';
import MapperRegistry from './mappers/mapper-registry.js';
import CdnClientRegistry from './cdn/cdn-client-registry.js';
import { mergePatches } from './utils/patch-utils.js';
import { getTokowakaConfigS3Path } from './utils/s3-utils.js';
import { groupSuggestionsByUrlPath, filterEligibleSuggestions } from './utils/suggestion-utils.js';
import { getEffectiveBaseURL } from './utils/site-utils.js';

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
    const { env, log = console, s3 } = context;
    const { TOKOWAKA_SITE_CONFIG_BUCKET: bucketName } = env;

    if (context.tokowakaClient) {
      return context.tokowakaClient;
    }

    // s3ClientWrapper puts s3Client at context.s3.s3Client, so check both locations
    const client = new TokowakaClient({
      bucketName,
      s3Client: s3?.s3Client,
      env,
    }, log);
    context.tokowakaClient = client;
    return client;
  }

  /**
   * Constructor
   * @param {Object} config - Configuration object
   * @param {string} config.bucketName - S3 bucket name for configs
   * @param {Object} config.s3Client - AWS S3 client
   * @param {Object} config.env - Environment variables (for CDN credentials)
   * @param {Object} log - Logger instance
   */
  constructor({ bucketName, s3Client, env = {} }, log) {
    this.log = log;

    if (!hasText(bucketName)) {
      throw this.#createError('TOKOWAKA_SITE_CONFIG_BUCKET is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(s3Client)) {
      throw this.#createError('S3 client is required', HTTP_BAD_REQUEST);
    }

    this.bucketName = bucketName;
    this.s3Client = s3Client;
    this.env = env;

    this.mapperRegistry = new MapperRegistry(log);
    this.cdnClientRegistry = new CdnClientRegistry(env, log);
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
   * @param {Array} suggestionsToDeploy - Array of suggestion entities to deploy
   * @param {Array} allOpportunitySuggestions - Optional: All suggestions for the opportunity
   *        (allows mappers like FAQ to include previously deployed suggestions)
   * @returns {Object} - Tokowaka configuration object
   */
  generateConfig(site, opportunity, suggestionsToDeploy, allOpportunitySuggestions = null) {
    const opportunityType = opportunity.getType();
    const siteId = site.getId();
    const baseURL = getEffectiveBaseURL(site);

    const mapper = this.mapperRegistry.getMapper(opportunityType);
    if (!mapper) {
      throw this.#createError(
        `No mapper found for opportunity type: ${opportunityType}. `
        + `Supported types: ${this.mapperRegistry.getSupportedOpportunityTypes().join(', ')}`,
        HTTP_NOT_IMPLEMENTED,
      );
    }

    // Group suggestions by URL
    const suggestionsByUrl = groupSuggestionsByUrlPath(suggestionsToDeploy, baseURL, this.log);

    // Generate patches for each URL using the mapper
    const tokowakaOptimizations = {};

    Object.entries(suggestionsByUrl).forEach(([urlPath, urlSuggestions]) => {
      let patches = [];
      // Use suggestionsToPatches if available (allows mappers to combine multiple suggestions)
      if (mapper.suggestionsToPatches) {
        patches = mapper.suggestionsToPatches(
          urlPath,
          urlSuggestions,
          opportunity.getId(),
          allOpportunitySuggestions,
        );
      } else {
        patches = urlSuggestions.map((suggestion) => mapper
          .suggestionToPatch(suggestion, opportunity.getId()))
          .filter((patch) => patch !== null);
      }

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
   * Gets list of supported opportunity types
   * @returns {string[]} - Array of supported opportunity types
   */
  getSupportedOpportunityTypes() {
    return this.mapperRegistry.getSupportedOpportunityTypes();
  }

  /**
   * Registers a custom mapper for an opportunity type
   * @param {BaseOpportunityMapper} mapper - Mapper instance
   */
  registerMapper(mapper) {
    this.mapperRegistry.registerMapper(mapper);
  }

  /**
   * Fetches existing Tokowaka configuration from S3
   * @param {string} siteTokowakaKey - Tokowaka API key (used as S3 key prefix)
   * @returns {Promise<Object|null>} - Existing configuration object or null if not found
   */
  async fetchConfig(siteTokowakaKey) {
    if (!hasText(siteTokowakaKey)) {
      throw this.#createError('Tokowaka API key is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaConfigS3Path(siteTokowakaKey);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Path,
      });

      const response = await this.s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      const config = JSON.parse(bodyContents);

      this.log.debug(`Successfully fetched existing Tokowaka config from s3://${this.bucketName}/${s3Path}`);
      return config;
    } catch (error) {
      // If config doesn't exist (NoSuchKey), return null
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        this.log.debug(`No existing Tokowaka config found at s3://${this.bucketName}/${s3Path}`);
        return null;
      }

      // For other errors, log and throw
      this.log.error(`Failed to fetch Tokowaka config from S3: ${error.message}`, error);
      throw this.#createError(`S3 fetch failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Merges existing configuration with new configuration
   * For each URL path, checks patch key:
   * - Multi-suggestion patches (suggestionIds array with length > 1):
   *   identified by opportunityId only
   * - Single-suggestion patches: identified by opportunityId+suggestionId
   * - If exists: updates the patch
   * - If not exists: adds new patch to the array
   * @param {Object} existingConfig - Existing configuration from S3
   * @param {Object} newConfig - New configuration generated from suggestions
   * @param {boolean} hasSinglePatchPerUrl - Whether mapper combines
   *   suggestions into single patch per URL
   * @returns {Object} - Merged configuration
   */
  mergeConfigs(existingConfig, newConfig, hasSinglePatchPerUrl = false) {
    if (!existingConfig) {
      return newConfig;
    }

    // Start with existing config structure
    const mergedConfig = {
      ...existingConfig,
      baseURL: newConfig.baseURL,
      version: newConfig.version,
      tokowakaForceFail: newConfig.tokowakaForceFail,
    };

    // Merge optimizations for each URL path
    Object.entries(newConfig.tokowakaOptimizations).forEach(([urlPath, newOptimization]) => {
      const existingOptimization = mergedConfig.tokowakaOptimizations[urlPath];

      if (!existingOptimization) {
        // URL path doesn't exist in existing config, add it entirely
        mergedConfig.tokowakaOptimizations[urlPath] = newOptimization;
        this.log.debug(`Added new URL path: ${urlPath}`);
      } else {
        // URL path exists, merge patches
        const existingPatches = existingOptimization.patches || [];
        const newPatches = newOptimization.patches || [];

        const { patches: mergedPatches, updateCount, addCount } = mergePatches(
          existingPatches,
          newPatches,
          hasSinglePatchPerUrl,
        );

        mergedConfig.tokowakaOptimizations[urlPath] = {
          ...existingOptimization,
          prerender: newOptimization.prerender,
          patches: mergedPatches,
        };

        this.log.debug(`Merged patches for ${urlPath}: ${updateCount} updated, ${addCount} added`);
      }
    });

    return mergedConfig;
  }

  /**
   * Uploads Tokowaka configuration to S3
   * @param {string} siteTokowakaKey - Tokowaka API key (used as S3 key prefix)
   * @param {Object} config - Tokowaka configuration object
   * @returns {Promise<string>} - S3 key of uploaded config
   */
  async uploadConfig(siteTokowakaKey, config) {
    if (!hasText(siteTokowakaKey)) {
      throw this.#createError('Tokowaka API key is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(config)) {
      throw this.#createError('Config object is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaConfigS3Path(siteTokowakaKey);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Path,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded Tokowaka config to s3://${this.bucketName}/${s3Path}`);

      return s3Path;
    } catch (error) {
      this.log.error(`Failed to upload Tokowaka config to S3: ${error.message}`, error);
      throw this.#createError(`S3 upload failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Invalidates CDN cache for the Tokowaka config
   * Currently supports CloudFront only
   * @param {string} apiKey - Tokowaka API key
   * @param {string} provider - CDN provider name (default: 'cloudfront')
   * @returns {Promise<Object|null>} - CDN invalidation result or null if skipped
   */
  async invalidateCdnCache(apiKey, provider) {
    if (!hasText(apiKey) || !hasText(provider)) {
      throw this.#createError('Tokowaka API key and provider are required', HTTP_BAD_REQUEST);
    }
    try {
      const pathsToInvalidate = [`/${getTokowakaConfigS3Path(apiKey)}`];
      this.log.debug(`Invalidating CDN cache for ${pathsToInvalidate.length} paths via ${provider}`);
      const cdnClient = this.cdnClientRegistry.getClient(provider);
      if (!cdnClient) {
        throw this.#createError(`No CDN client available for provider: ${provider}`, HTTP_NOT_IMPLEMENTED);
      }
      const result = await cdnClient.invalidateCache(pathsToInvalidate);
      this.log.info(`CDN cache invalidation completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.log.error(`Failed to invalidate Tokowaka CDN cache: ${error.message}`, error);
      return {
        status: 'error',
        provider: 'cloudfront',
        message: error.message,
      };
    }
  }

  /**
   * Deploys suggestions to Tokowaka by generating config and uploading to S3
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to deploy
   * @param {Array} allOpportunitySuggestions - Optional: All suggestions for the opportunity
   *        (needed for FAQ to rebuild with previously deployed suggestions)
   * @returns {Promise<Object>} - Deployment result with succeeded/failed suggestions
   */
  async deploySuggestions(site, opportunity, suggestions, allOpportunitySuggestions = null) {
    // Get site's Tokowaka API key
    const { apiKey } = site.getConfig()?.getTokowakaConfig() || {};

    if (!hasText(apiKey)) {
      throw this.#createError(
        'Site does not have a Tokowaka API key configured. Please onboard the site to Tokowaka first.',
        HTTP_BAD_REQUEST,
      );
    }

    const opportunityType = opportunity.getType();
    const mapper = this.mapperRegistry.getMapper(opportunityType);
    if (!mapper) {
      throw this.#createError(
        `No mapper found for opportunity type: ${opportunityType}. `
        + `Supported types: ${this.mapperRegistry.getSupportedOpportunityTypes().join(', ')}`,
        HTTP_NOT_IMPLEMENTED,
      );
    }

    // Validate which suggestions can be deployed using mapper's canDeploy method
    const {
      eligible: eligibleSuggestions,
      ineligible: ineligibleSuggestions,
    } = filterEligibleSuggestions(suggestions, mapper);

    this.log.debug(
      `Deploying ${eligibleSuggestions.length} eligible suggestions `
      + `(${ineligibleSuggestions.length} ineligible)`,
    );

    if (eligibleSuggestions.length === 0) {
      this.log.warn('No eligible suggestions to deploy');
      return {
        succeededSuggestions: [],
        failedSuggestions: ineligibleSuggestions,
      };
    }

    // Generate configuration with eligible suggestions only
    this.log.debug(`Generating Tokowaka config for site ${site.getId()}, opportunity ${opportunity.getId()}`);
    const newConfig = this.generateConfig(
      site,
      opportunity,
      eligibleSuggestions,
      allOpportunitySuggestions,
    );

    if (Object.keys(newConfig.tokowakaOptimizations).length === 0) {
      this.log.warn('No eligible suggestions to deploy');
      return {
        succeededSuggestions: [],
        failedSuggestions: suggestions,
      };
    }

    // Fetch existing configuration from S3
    this.log.debug(`Fetching existing Tokowaka config for site ${site.getId()}`);
    const existingConfig = await this.fetchConfig(apiKey);

    // Merge with existing config
    const config = this.mergeConfigs(existingConfig, newConfig, mapper.hasSinglePatchPerUrl());

    // Upload to S3
    this.log.info(`Uploading Tokowaka config for ${eligibleSuggestions.length} suggestions`);
    const s3Path = await this.uploadConfig(apiKey, config);

    // Invalidate CDN cache (non-blocking, failures are logged but don't fail deployment)
    const cdnInvalidationResult = await this.invalidateCdnCache(
      apiKey,
      this.env.TOKOWAKA_CDN_PROVIDER,
    );

    return {
      s3Path,
      cdnInvalidation: cdnInvalidationResult,
      succeededSuggestions: eligibleSuggestions,
      failedSuggestions: ineligibleSuggestions,
    };
  }
}

// Export the client as default and base classes for custom implementations
export default TokowakaClient;
