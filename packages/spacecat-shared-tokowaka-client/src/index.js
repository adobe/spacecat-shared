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
import { getTokowakaConfigS3Path, getTokowakaMetaconfigS3Path } from './utils/s3-utils.js';
import { groupSuggestionsByUrlPath, filterEligibleSuggestions } from './utils/suggestion-utils.js';
import { getEffectiveBaseURL } from './utils/site-utils.js';
import { fetchHtmlWithWarmup } from './utils/custom-html-utils.js';

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
    const {
      TOKOWAKA_SITE_CONFIG_BUCKET: bucketName,
      TOKOWAKA_PREVIEW_BUCKET: previewBucketName,
    } = env;

    if (context.tokowakaClient) {
      return context.tokowakaClient;
    }

    // s3ClientWrapper puts s3Client at context.s3.s3Client, so check both locations
    const client = new TokowakaClient({
      bucketName,
      previewBucketName,
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
   * @param {string} config.previewBucketName - S3 bucket name for preview configs
   * @param {Object} config.s3Client - AWS S3 client
   * @param {Object} config.env - Environment variables (for CDN credentials)
   * @param {Object} log - Logger instance
   */
  constructor({
    bucketName, previewBucketName, s3Client, env = {},
  }, log) {
    this.log = log;

    if (!hasText(bucketName)) {
      throw this.#createError('TOKOWAKA_SITE_CONFIG_BUCKET is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(s3Client)) {
      throw this.#createError('S3 client is required', HTTP_BAD_REQUEST);
    }

    this.deployBucketName = bucketName;
    this.previewBucketName = previewBucketName;
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
   * Gets the list of CDN providers from environment configuration
   * Supports both single provider (string) and multiple providers (comma-separated string or array)
   * @returns {Array<string>} Array of CDN provider names
   * @private
   */
  #getCdnProviders() {
    const providerConfig = this.env.TOKOWAKA_CDN_PROVIDER;

    if (!providerConfig) {
      return [];
    }

    // If it's already an array, return it
    if (Array.isArray(providerConfig)) {
      return providerConfig.filter(Boolean);
    }

    // If it's a comma-separated string, split it
    if (typeof providerConfig === 'string') {
      return providerConfig
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }

    return [];
  }

  /**
   * Generates Tokowaka site configuration from suggestions for a specific URL
   * @param {string} url - Full URL for which to generate config
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestionsToDeploy - Array of suggestion entities to deploy
   * @returns {Object} - Tokowaka configuration object for the URL
   */
  generateConfig(url, opportunity, suggestionsToDeploy) {
    const opportunityType = opportunity.getType();

    const mapper = this.mapperRegistry.getMapper(opportunityType);
    if (!mapper) {
      throw this.#createError(
        `No mapper found for opportunity type: ${opportunityType}. `
        + `Supported types: ${this.mapperRegistry.getSupportedOpportunityTypes().join(', ')}`,
        HTTP_NOT_IMPLEMENTED,
      );
    }

    // Extract URL path from the full URL
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname;

    // Generate patches for the URL using the mapper
    const patches = mapper.suggestionsToPatches(
      urlPath,
      suggestionsToDeploy,
      opportunity.getId(),
    );

    // Check if configs without patches are allowed (e.g., prerender-only)
    if (patches.length === 0 && !mapper.allowConfigsWithoutPatch()) {
      return null;
    }

    return {
      url,
      version: '1.0',
      forceFail: false,
      prerender: mapper.requiresPrerender(),
      patches,
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
   * Fetches domain-level metaconfig from S3
   * @param {string} url - Full URL (used to extract domain)
   * @param {boolean} isPreview - Whether to fetch from preview path (default: false)
   * @returns {Promise<Object|null>} - Metaconfig object or null if not found
   */
  async fetchMetaconfig(url, isPreview = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaMetaconfigS3Path(url, this.log, isPreview);
    const bucketName = isPreview ? this.previewBucketName : this.deployBucketName;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Path,
      });

      const response = await this.s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      const metaconfig = JSON.parse(bodyContents);

      this.log.debug(`Successfully fetched metaconfig from s3://${bucketName}/${s3Path}`);
      return metaconfig;
    } catch (error) {
      // If metaconfig doesn't exist (NoSuchKey), return null
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        this.log.debug(`No metaconfig found at s3://${bucketName}/${s3Path}`);
        return null;
      }

      // For other errors, log and throw
      this.log.error(`Failed to fetch metaconfig from S3: ${error.message}`, error);
      throw this.#createError(`S3 fetch failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Uploads domain-level metaconfig to S3
   * @param {string} url - Full URL (used to extract domain)
   * @param {Object} metaconfig - Metaconfig object (siteId, prerender)
   * @param {boolean} isPreview - Whether to upload to preview path (default: false)
   * @returns {Promise<string>} - S3 key of uploaded metaconfig
   */
  async uploadMetaconfig(url, metaconfig, isPreview = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(metaconfig)) {
      throw this.#createError('Metaconfig object is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaMetaconfigS3Path(url, this.log, isPreview);
    const bucketName = isPreview ? this.previewBucketName : this.deployBucketName;

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Path,
        Body: JSON.stringify(metaconfig, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded metaconfig to s3://${bucketName}/${s3Path}`);

      return s3Path;
    } catch (error) {
      this.log.error(`Failed to upload metaconfig to S3: ${error.message}`, error);
      throw this.#createError(`S3 upload failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Fetches existing Tokowaka configuration from S3 for a specific URL
   * @param {string} url - Full URL (e.g., 'https://www.example.com/products/item')
   * @param {boolean} isPreview - Whether to fetch from preview path (default: false)
   * @returns {Promise<Object|null>} - Existing configuration object or null if not found
   */
  async fetchConfig(url, isPreview = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaConfigS3Path(url, this.log, isPreview);
    const bucketName = isPreview ? this.previewBucketName : this.deployBucketName;

    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Path,
      });

      const response = await this.s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      const config = JSON.parse(bodyContents);

      this.log.debug(`Successfully fetched existing Tokowaka config from s3://${bucketName}/${s3Path}`);
      return config;
    } catch (error) {
      // If config doesn't exist (NoSuchKey), return null
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        this.log.debug(`No existing Tokowaka config found at s3://${bucketName}/${s3Path}`);
        return null;
      }

      // For other errors, log and throw
      this.log.error(`Failed to fetch Tokowaka config from S3: ${error.message}`, error);
      throw this.#createError(`S3 fetch failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Merges existing configuration with new configuration
   * Checks patch key:
   * - Patches are identified by opportunityId+suggestionId
   * - Heading patches (no suggestionId) are identified by opportunityId
   * - If exists: updates the patch
   * - If not exists: adds new patch to the array
   * @param {Object} existingConfig - Existing configuration from S3
   * @param {Object} newConfig - New configuration generated from suggestions
   * @returns {Object} - Merged configuration
   */
  mergeConfigs(existingConfig, newConfig) {
    if (!existingConfig) {
      return newConfig;
    }

    const existingPatches = existingConfig.patches || [];
    const newPatches = newConfig.patches || [];

    const { patches: mergedPatches, updateCount, addCount } = mergePatches(
      existingPatches,
      newPatches,
    );

    this.log.debug(`Merged patches: ${updateCount} updated, ${addCount} added`);

    return {
      ...existingConfig,
      url: newConfig.url,
      version: newConfig.version,
      forceFail: newConfig.forceFail,
      prerender: newConfig.prerender,
      patches: mergedPatches,
    };
  }

  /**
   * Uploads Tokowaka configuration to S3 for a specific URL
   * @param {string} url - Full URL (e.g., 'https://www.example.com/products/item')
   * @param {Object} config - Tokowaka configuration object
   * @param {boolean} isPreview - Whether to upload to preview path (default: false)
   * @returns {Promise<string>} - S3 key of uploaded config
   */
  async uploadConfig(url, config, isPreview = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(config)) {
      throw this.#createError('Config object is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaConfigS3Path(url, this.log, isPreview);
    const bucketName = isPreview ? this.previewBucketName : this.deployBucketName;

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Path,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded Tokowaka config to s3://${bucketName}/${s3Path}`);

      return s3Path;
    } catch (error) {
      this.log.error(`Failed to upload Tokowaka config to S3: ${error.message}`, error);
      throw this.#createError(`S3 upload failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Invalidates CDN cache for the Tokowaka config for a specific URL
   * Supports multiple CDN providers in parallel (CloudFront, Fastly, etc.)
   * @param {string} url - Full URL (e.g., 'https://www.example.com/products/item')
   * @param {string|Array<string>} providers - CDN provider name(s)
   *   (e.g., 'cloudfront' or ['cloudfront', 'fastly'])
   * @param {boolean} isPreview - Whether to invalidate preview path (default: false)
   * @returns {Promise<Array<Object>>} - Array of CDN invalidation results
   */
  async invalidateCdnCache(url, providers, isPreview = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    // Convert single provider to array for uniform handling
    const providerList = Array.isArray(providers) ? providers : [providers].filter(Boolean);

    if (providerList.length === 0) {
      this.log.warn('No CDN providers specified for cache invalidation');
      return [];
    }

    const pathsToInvalidate = [`/${getTokowakaConfigS3Path(url, this.log, isPreview)}`];
    this.log.debug(`Invalidating CDN cache for ${pathsToInvalidate.length} paths via providers: ${providerList.join(', ')}`);

    // Invalidate all providers in parallel
    const invalidationPromises = providerList.map(async (provider) => {
      try {
        const cdnClient = this.cdnClientRegistry.getClient(provider);
        if (!cdnClient) {
          this.log.warn(`No CDN client available for provider: ${provider}`);
          return {
            status: 'error',
            provider,
            message: `No CDN client available for provider: ${provider}`,
          };
        }
        const result = await cdnClient.invalidateCache(pathsToInvalidate);
        this.log.info(`CDN cache invalidation completed for ${provider}: ${JSON.stringify(result)}`);
        return result;
      } catch (error) {
        this.log.error(`Failed to invalidate ${provider} CDN cache: ${error.message}`, error);
        return {
          status: 'error',
          provider,
          message: error.message,
        };
      }
    });

    // Wait for all invalidations to complete
    const results = await Promise.all(invalidationPromises);
    return results;
  }

  /**
   * Batch invalidates CDN cache for multiple URLs at once
   * More efficient than individual invalidations when processing multiple URLs
   * @param {Array<string>} urls - Array of full URLs to invalidate
   * @param {string|Array<string>} providers - CDN provider name(s)
   * @param {boolean} isPreview - Whether to invalidate preview paths (default: false)
   * @returns {Promise<Array<Object>>} - Array of CDN invalidation results (one per provider)
   */
  async batchInvalidateCdnCache(urls, providers, isPreview = false) {
    if (!Array.isArray(urls) || urls.length === 0) {
      this.log.warn('No URLs provided for batch cache invalidation');
      return [];
    }

    // Convert single provider to array for uniform handling
    const providerList = Array.isArray(providers) ? providers : [providers].filter(Boolean);

    if (providerList.length === 0) {
      this.log.warn('No CDN providers specified for batch cache invalidation');
      return [];
    }

    // Generate all S3 paths for the URLs
    const pathsToInvalidate = urls.map((url) => `/${getTokowakaConfigS3Path(url, this.log, isPreview)}`);

    this.log.debug(
      `Batch invalidating CDN cache for ${pathsToInvalidate.length} paths `
      + `via providers: ${providerList.join(', ')}`,
    );

    // Invalidate all providers in parallel with batched paths
    const invalidationPromises = providerList.map(async (provider) => {
      try {
        const cdnClient = this.cdnClientRegistry.getClient(provider);
        if (!cdnClient) {
          this.log.warn(`No CDN client available for provider: ${provider}`);
          return {
            status: 'error',
            provider,
            message: `No CDN client available for provider: ${provider}`,
          };
        }

        // Pass all paths at once for batch invalidation
        const result = await cdnClient.invalidateCache(pathsToInvalidate);
        this.log.info(
          `Batch CDN cache invalidation completed for ${provider}: `
          + `${pathsToInvalidate.length} paths (${JSON.stringify(result)})`,
        );
        return result;
      } catch (error) {
        this.log.error(`Failed to batch invalidate ${provider} CDN cache: ${error.message}`, error);
        return {
          status: 'error',
          provider,
          message: error.message,
        };
      }
    });

    // Wait for all provider invalidations to complete
    const results = await Promise.all(invalidationPromises);
    return results;
  }

  /**
   * Deploys suggestions to Tokowaka by generating config and uploading to S3
   * Now creates one file per URL instead of a single file with all URLs
   * Also creates/updates domain-level metadata if needed
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to deploy
   * @returns {Promise<Object>} - Deployment result with succeeded/failed suggestions
   */
  async deploySuggestions(site, opportunity, suggestions) {
    const opportunityType = opportunity.getType();
    const baseURL = getEffectiveBaseURL(site);
    const siteId = site.getId();
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

    // Group suggestions by URL
    const suggestionsByUrl = groupSuggestionsByUrlPath(eligibleSuggestions, baseURL, this.log);

    // Check/create domain-level metaconfig (only need to do this once per deployment)
    const firstUrl = new URL(Object.keys(suggestionsByUrl)[0], baseURL).toString();
    let metaconfig = await this.fetchMetaconfig(firstUrl);

    if (!metaconfig) {
      this.log.info('Creating domain-level metaconfig');
      metaconfig = {
        siteId,
        prerender: mapper.requiresPrerender(),
      };
      await this.uploadMetaconfig(firstUrl, metaconfig);
    } else {
      this.log.debug('Domain-level metaconfig already exists');
    }

    // Process each URL separately
    const s3Paths = [];
    const deployedUrls = []; // Track URLs for batch CDN invalidation

    for (const [urlPath, urlSuggestions] of Object.entries(suggestionsByUrl)) {
      const fullUrl = new URL(urlPath, baseURL).toString();
      this.log.debug(`Processing ${urlSuggestions.length} suggestions for URL: ${fullUrl}`);

      // Fetch existing configuration for this URL from S3
      // eslint-disable-next-line no-await-in-loop
      const existingConfig = await this.fetchConfig(fullUrl);

      // Generate configuration for this URL with eligible suggestions only
      const newConfig = this.generateConfig(fullUrl, opportunity, urlSuggestions);

      if (!newConfig) {
        this.log.warn(`No config generated for URL: ${fullUrl}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      // Check if mapper allows configs without patches (e.g., prerender-only config)
      const allowsNoPatch = mapper.allowConfigsWithoutPatch() && newConfig.patches.length === 0;

      if (!allowsNoPatch && (!newConfig.patches || newConfig.patches.length === 0)) {
        this.log.warn(`No eligible suggestions to deploy for URL: ${fullUrl}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      // Merge with existing config for this URL
      const config = this.mergeConfigs(existingConfig, newConfig);

      // Upload to S3
      // eslint-disable-next-line no-await-in-loop
      const s3Path = await this.uploadConfig(fullUrl, config);
      s3Paths.push(s3Path);
      deployedUrls.push(fullUrl); // Collect URL for batch invalidation
    }

    this.log.info(`Uploaded Tokowaka configs for ${s3Paths.length} URLs`);

    // Batch invalidate CDN cache for all deployed URLs at once
    // (much more efficient than individual invalidations)
    const cdnInvalidations = await this.batchInvalidateCdnCache(
      deployedUrls,
      this.#getCdnProviders(),
    );

    return {
      s3Paths,
      cdnInvalidations,
      succeededSuggestions: eligibleSuggestions,
      failedSuggestions: ineligibleSuggestions,
    };
  }

  /**
   * Rolls back deployed suggestions by removing their patches from the configuration
   * Now updates one file per URL instead of a single file with all URLs
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to rollback
   * @returns {Promise<Object>} - Rollback result with succeeded/failed suggestions
   */
  async rollbackSuggestions(site, opportunity, suggestions) {
    const opportunityType = opportunity.getType();
    const baseURL = getEffectiveBaseURL(site);
    const mapper = this.mapperRegistry.getMapper(opportunityType);
    if (!mapper) {
      throw this.#createError(
        `No mapper found for opportunity type: ${opportunityType}. `
        + `Supported types: ${this.mapperRegistry.getSupportedOpportunityTypes().join(', ')}`,
        HTTP_NOT_IMPLEMENTED,
      );
    }

    // Validate which suggestions can be rolled back
    // For rollback, we use the same canDeploy check to ensure data integrity
    const {
      eligible: eligibleSuggestions,
      ineligible: ineligibleSuggestions,
    } = filterEligibleSuggestions(suggestions, mapper);

    this.log.debug(
      `Rolling back ${eligibleSuggestions.length} eligible suggestions `
      + `(${ineligibleSuggestions.length} ineligible)`,
    );

    if (eligibleSuggestions.length === 0) {
      this.log.warn('No eligible suggestions to rollback');
      return {
        succeededSuggestions: [],
        failedSuggestions: ineligibleSuggestions,
      };
    }

    // Group suggestions by URL
    const suggestionsByUrl = groupSuggestionsByUrlPath(eligibleSuggestions, baseURL, this.log);

    // Process each URL separately
    const s3Paths = [];
    const rolledBackUrls = []; // Track URLs for batch CDN invalidation
    let totalRemovedCount = 0;

    for (const [urlPath, urlSuggestions] of Object.entries(suggestionsByUrl)) {
      const fullUrl = new URL(urlPath, baseURL).toString();
      this.log.debug(`Rolling back ${urlSuggestions.length} suggestions for URL: ${fullUrl}`);

      // Fetch existing configuration for this URL from S3
      // eslint-disable-next-line no-await-in-loop
      const existingConfig = await this.fetchConfig(fullUrl);

      if (!existingConfig) {
        this.log.warn(`No existing configuration found for URL: ${fullUrl}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      // Extract suggestion IDs to remove for this URL
      const suggestionIdsToRemove = urlSuggestions.map((s) => s.getId());

      // For prerender opportunities, disable prerender flag
      if (opportunityType === 'prerender') {
        this.log.info(`Rolling back prerender config for URL: ${fullUrl}`);

        // Set prerender to false (keep other patches if they exist)
        const updatedConfig = {
          ...existingConfig,
          prerender: false,
        };

        // Upload updated config to S3 for this URL
        // eslint-disable-next-line no-await-in-loop
        const s3Path = await this.uploadConfig(fullUrl, updatedConfig);
        s3Paths.push(s3Path);
        rolledBackUrls.push(fullUrl); // Collect URL for batch invalidation

        totalRemovedCount += 1; // Count as 1 rollback
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!existingConfig.patches) {
        this.log.info(`No patches found in configuration for URL: ${fullUrl}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      // Use mapper to remove patches
      const updatedConfig = mapper.rollbackPatches(
        existingConfig,
        suggestionIdsToRemove,
        opportunity.getId(),
      );

      if (updatedConfig.removedCount === 0) {
        this.log.warn(`No patches found for suggestions at URL: ${fullUrl}`);
        // eslint-disable-next-line no-continue
        continue;
      }

      this.log.info(`Removed ${updatedConfig.removedCount} patches for URL: ${fullUrl}`);
      totalRemovedCount += updatedConfig.removedCount;

      // Remove the removedCount property before uploading
      delete updatedConfig.removedCount;

      // Upload updated config to S3 for this URL
      // eslint-disable-next-line no-await-in-loop
      const s3Path = await this.uploadConfig(fullUrl, updatedConfig);
      s3Paths.push(s3Path);
      rolledBackUrls.push(fullUrl); // Collect URL for batch invalidation
    }

    this.log.info(`Updated Tokowaka configs for ${s3Paths.length} URLs, removed ${totalRemovedCount} patches total`);

    // Batch invalidate CDN cache for all rolled back URLs at once
    // (much more efficient than individual invalidations)
    const cdnInvalidations = await this.batchInvalidateCdnCache(
      rolledBackUrls,
      this.#getCdnProviders(),
    );

    return {
      s3Paths,
      cdnInvalidations,
      succeededSuggestions: eligibleSuggestions,
      failedSuggestions: ineligibleSuggestions,
      removedPatchesCount: totalRemovedCount,
    };
  }

  /**
   * Previews suggestions by generating config and uploading to preview path
   * All suggestions must belong to the same URL
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to preview (must be same URL)
   * @param {Object} options - Optional configuration for HTML fetching
   * @returns {Promise<Object>} - Preview result with config and succeeded/failed suggestions
   */
  async previewSuggestions(site, opportunity, suggestions, options = {}) {
    // Get site's forwarded host for preview
    const { forwardedHost, apiKey } = site.getConfig()?.getTokowakaConfig() || {};

    if (!hasText(forwardedHost) || !hasText(apiKey)) {
      throw this.#createError(
        'Site does not have a Tokowaka API key or forwarded host configured. '
        + 'Please onboard the site to Tokowaka first.',
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

    // TOKOWAKA_EDGE_URL is mandatory for preview
    const tokowakaEdgeUrl = this.env.TOKOWAKA_EDGE_URL;
    if (!hasText(tokowakaEdgeUrl)) {
      throw this.#createError(
        'TOKOWAKA_EDGE_URL is required for preview functionality',
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    // Validate which suggestions can be deployed using mapper's canDeploy method
    const {
      eligible: eligibleSuggestions,
      ineligible: ineligibleSuggestions,
    } = filterEligibleSuggestions(suggestions, mapper);

    this.log.debug(
      `Previewing ${eligibleSuggestions.length} eligible suggestions `
      + `(${ineligibleSuggestions.length} ineligible)`,
    );

    if (eligibleSuggestions.length === 0) {
      this.log.warn('No eligible suggestions to preview');
      return {
        config: null,
        succeededSuggestions: [],
        failedSuggestions: ineligibleSuggestions,
      };
    }

    // Get the preview URL from the first suggestion
    const previewUrl = eligibleSuggestions[0].getData()?.url;
    if (!hasText(previewUrl)) {
      throw this.#createError('Preview URL not found in suggestion data', HTTP_BAD_REQUEST);
    }

    // Fetch existing deployed configuration for this URL from production S3
    this.log.debug(`Fetching existing deployed Tokowaka config for URL: ${previewUrl}`);
    const existingConfig = await this.fetchConfig(previewUrl, false);

    // Generate configuration with eligible preview suggestions
    this.log.debug(`Generating preview Tokowaka config for opportunity ${opportunity.getId()}`);
    const newConfig = this.generateConfig(previewUrl, opportunity, eligibleSuggestions);

    if (!newConfig) {
      this.log.warn('No config generated for preview');
      return {
        config: null,
        succeededSuggestions: [],
        failedSuggestions: suggestions,
      };
    }

    /* c8 ignore next 9 */
    if (newConfig.patches.length === 0 && !mapper.allowConfigsWithoutPatch()) {
      this.log.warn('No eligible suggestions to preview');
      return {
        config: null,
        succeededSuggestions: [],
        failedSuggestions: suggestions,
      };
    }

    // Merge with existing deployed config to include already-deployed patches for this URL
    let config = newConfig;
    if (existingConfig && existingConfig.patches?.length > 0) {
      this.log.info(
        `Found ${existingConfig.patches.length} deployed patches, merging with preview suggestions`,
      );

      // Merge the existing deployed patches with new preview suggestions
      config = this.mergeConfigs(existingConfig, newConfig);

      this.log.debug(
        `Preview config now has ${config.patches.length} total patches`,
      );
    } else {
      this.log.info('No deployed patches found, using only preview suggestions');
    }

    // Upload to preview S3 path for this URL
    this.log.info(`Uploading preview Tokowaka config with ${eligibleSuggestions.length} new suggestions`);
    const s3Path = await this.uploadConfig(previewUrl, config, true);

    // Invalidate CDN cache for all providers in parallel (preview path)
    const cdnInvalidationResults = await this.invalidateCdnCache(
      previewUrl,
      this.#getCdnProviders(),
      true,
    );

    // Fetch HTML content for preview
    let originalHtml = null;
    let optimizedHtml = null;

    try {
      // Fetch original HTML (without preview)
      originalHtml = await fetchHtmlWithWarmup(
        previewUrl,
        apiKey,
        forwardedHost,
        tokowakaEdgeUrl,
        this.log,
        false,
        options,
      );
      // Then fetch optimized HTML (with preview)
      optimizedHtml = await fetchHtmlWithWarmup(
        previewUrl,
        apiKey,
        forwardedHost,
        tokowakaEdgeUrl,
        this.log,
        true,
        options,
      );
      this.log.info('Successfully fetched both original and optimized HTML for preview');
    } catch (error) {
      this.log.error(`Failed to fetch HTML for preview: ${error.message}`);
      throw this.#createError(
        `Preview failed: Unable to fetch HTML - ${error.message}`,
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    return {
      s3Path,
      config,
      cdnInvalidations: cdnInvalidationResults,
      succeededSuggestions: eligibleSuggestions,
      failedSuggestions: ineligibleSuggestions,
      html: {
        url: previewUrl,
        originalHtml,
        optimizedHtml,
      },
    };
  }
}

// Export the client as default and base classes for custom implementations
export default TokowakaClient;
