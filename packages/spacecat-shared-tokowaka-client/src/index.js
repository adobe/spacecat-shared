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

import crypto from 'crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { hasText, isNonEmptyObject } from '@adobe/spacecat-shared-utils';
import { v4 as uuidv4 } from 'uuid';
import MapperRegistry from './mappers/mapper-registry.js';
import CdnClientRegistry from './cdn/cdn-client-registry.js';
import { mergePatches } from './utils/patch-utils.js';
import {
  getTokowakaConfigS3Path,
  getTokowakaMetaconfigS3Path,
  getHostName,
  normalizePath,
} from './utils/s3-utils.js';
import { groupSuggestionsByUrlPath, filterEligibleSuggestions } from './utils/suggestion-utils.js';
import { getEffectiveBaseURL } from './utils/site-utils.js';
import { fetchHtmlWithWarmup, calculateForwardedHost } from './utils/custom-html-utils.js';

export { FastlyKVClient } from './fastly-kv-client.js';

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
   * Updates the metaconfig with deployed endpoint paths
   * @param {Object} metaconfig - Existing metaconfig object
   * @param {Array<string>} deployedUrls - Array of successfully deployed URLs
   * @param {string} baseUrl - Base URL for uploading metaconfig
   * @returns {Promise<void>}
   * @private
   */
  async #updateMetaconfigWithDeployedPaths(metaconfig, deployedUrls, baseUrl) {
    if (!Array.isArray(deployedUrls) || deployedUrls.length === 0) {
      return;
    }

    try {
      // Initialize patches field if it doesn't exist
      const updatedMetaconfig = {
        ...metaconfig,
        patches: { ...(metaconfig.patches || {}) },
      };

      // Extract normalized paths from deployed URLs and add to patches object
      deployedUrls.forEach((url) => {
        const urlObj = new URL(url);
        const normalizedPath = normalizePath(urlObj.pathname);
        updatedMetaconfig.patches[normalizedPath] = true;
      });

      await this.uploadMetaconfig(baseUrl, updatedMetaconfig);
      this.log.info(`Updated metaconfig with ${deployedUrls.length} deployed endpoint(s)`);
    } catch (error) {
      this.log.error(`Failed to update metaconfig with deployed paths: ${error.message}`, error);
      throw this.#createError(
        `Failed to update metaconfig with deployed paths: ${error.message}`,
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }
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
   * @returns {Promise<Object|null>} - Metaconfig object or null if not found
   */
  async fetchMetaconfig(url) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaMetaconfigS3Path(url, this.log);
    const bucketName = this.deployBucketName;

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
   * Generates an API key for Tokowaka based on domain
   * @param {string} domain - Domain name (e.g., 'example.com')
   * @returns {string} - Base64 URL-encoded API key
   * @private
   */
  /* eslint-disable class-methods-use-this */
  #generateApiKey(normalizedHostName) {
    const uuid = uuidv4();
    return crypto
      .createHash('sha256')
      .update(`${uuid}${normalizedHostName}`)
      .digest('base64url');
  }

  /**
   * Creates and uploads domain-level metaconfig to S3 if it does not exists
   * Generates a new API key and creates the metaconfig structure
   * @param {string} url - Full URL (used to extract domain)
   * @param {string} siteId - Site ID
   * @param {Object} options - Optional configuration
   * @param {boolean} options.enhancements - Whether to enable enhancements (default: true)
   * @returns {Promise<Object>} - Object with s3Path and metaconfig
   */
  async createMetaconfig(url, siteId, options = {}) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const existingMetaconfig = await this.fetchMetaconfig(url);

    if (existingMetaconfig) {
      throw this.#createError('Metaconfig already exists for this URL', HTTP_BAD_REQUEST);
    }

    if (!hasText(siteId)) {
      throw this.#createError('Site ID is required', HTTP_BAD_REQUEST);
    }

    const normalizedHostName = getHostName(url, this.log);
    const apiKey = this.#generateApiKey(normalizedHostName);

    const metaconfig = {
      siteId,
      apiKeys: [apiKey],
      tokowakaEnabled: true,
      enhancements: options.enhancements ?? true,
      patches: {},
    };

    const s3Path = await this.uploadMetaconfig(url, metaconfig);

    this.log.info(`Created new Tokowaka metaconfig for ${normalizedHostName} at ${s3Path}`);

    return metaconfig;
  }

  /**
   * Updates domain-level metaconfig to S3 if it does not exists
   * Reuses the same API key and updates the metaconfig structure
   * @param {string} url - Full URL (used to extract domain)
   * @param {string} siteId - Site ID
   * @param {Object} options - Optional configuration
   * @returns {Promise<Object>} - Object with s3Path and metaconfig
   */
  async updateMetaconfig(url, siteId, options = {}) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const existingMetaconfig = await this.fetchMetaconfig(url);
    if (!existingMetaconfig) {
      throw this.#createError('Metaconfig does not exist for this URL', HTTP_BAD_REQUEST);
    }

    if (!hasText(siteId)) {
      throw this.#createError('Site ID is required', HTTP_BAD_REQUEST);
    }

    const normalizedHostName = getHostName(url, this.log);

    // dont override api keys
    // if patches exist, they cannot reset to empty object
    const hasForceFail = options.forceFail !== undefined
      || existingMetaconfig.forceFail !== undefined;
    const forceFail = options.forceFail
      ?? existingMetaconfig.forceFail
      ?? false;

    const hasPrerender = isNonEmptyObject(options.prerender)
      || isNonEmptyObject(existingMetaconfig.prerender);
    const prerender = options.prerender
      ?? existingMetaconfig.prerender;

    const metaconfig = {
      ...existingMetaconfig,
      tokowakaEnabled: options.tokowakaEnabled ?? existingMetaconfig.tokowakaEnabled ?? true,
      enhancements: options.enhancements ?? existingMetaconfig.enhancements ?? true,
      patches: isNonEmptyObject(options.patches)
        ? options.patches
        : (existingMetaconfig.patches ?? {}),
      ...(hasForceFail && { forceFail }),
      ...(hasPrerender && { prerender }),
    };

    const s3Path = await this.uploadMetaconfig(url, metaconfig);

    this.log.info(`Updated Tokowaka metaconfig for ${normalizedHostName} at ${s3Path}`);

    return metaconfig;
  }

  /**
   * Uploads domain-level metaconfig to S3
   * @param {string} url - Full URL (used to extract domain)
   * @param {Object} metaconfig - Metaconfig object (siteId, apiKeys, prerender)
   * @returns {Promise<string>} - S3 key of uploaded metaconfig
   */
  async uploadMetaconfig(url, metaconfig) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(metaconfig)) {
      throw this.#createError('Metaconfig object is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaMetaconfigS3Path(url, this.log);
    const bucketName = this.deployBucketName;

    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Path,
        Body: JSON.stringify(metaconfig, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded metaconfig to s3://${bucketName}/${s3Path}`);

      // Invalidate CDN cache for the metaconfig (both CloudFront and Fastly)
      this.log.info('Invalidating CDN cache for uploaded metaconfig');
      await this.invalidateCdnCache({ paths: [`/${s3Path}`] });

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
   * CDN cache invalidation method that supports invalidating URL configs
   * or custom S3 paths across provided or default CDN providers.
   * @param {Object} options - Invalidation options
   * @param {Array<string>} options.urls - Array of full URLs to invalidate (for URL configs)
   * @param {Array<string>} options.paths - Custom S3 paths to invalidate directly
   * @param {string|Array<string>} options.providers - CDN provider name(s)
   *  (default: all supported providers)
   * @param {boolean} options.isPreview - Whether to invalidate preview paths (default: false)
   * @returns {Promise<Array<Object>>} - Array of CDN invalidation results
   */
  async invalidateCdnCache({
    urls = [],
    paths = [],
    providers = this.#getCdnProviders(),
    isPreview = false,
  }) {
    // Convert single provider to array for uniform handling
    const providerList = Array.isArray(providers) ? providers : [providers].filter(Boolean);

    if (providerList.length === 0) {
      this.log.warn('No CDN providers specified for cache invalidation');
      return [];
    }

    // Build list of paths to invalidate
    const pathsToInvalidate = [...paths];

    // Add URL config paths
    if (urls.length > 0) {
      const urlPaths = urls.map((url) => `/${getTokowakaConfigS3Path(url, this.log, isPreview)}`);
      pathsToInvalidate.push(...urlPaths);
    }

    // Return early if no paths to invalidate
    if (pathsToInvalidate.length === 0) {
      this.log.debug('No paths to invalidate for CDN cache');
      return [];
    }

    this.log.info(
      `Invalidating CDN cache for ${pathsToInvalidate.length} path(s) `
      + `via providers: ${providerList.join(', ')}`,
    );

    const results = [];
    for (const provider of providerList) {
      try {
        const cdnClient = this.cdnClientRegistry.getClient(provider);
        if (!cdnClient) {
          this.log.warn(`No CDN client available for provider: ${provider}`);
          results.push({
            status: 'error',
            provider,
            message: `No CDN client available for provider: ${provider}`,
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await cdnClient.invalidateCache(pathsToInvalidate);
        this.log.info(
          `CDN cache invalidation completed for ${provider}: `
          + `${pathsToInvalidate.length} path(s)`,
        );
        results.push(result);
      } catch (error) {
        this.log.warn(`Failed to invalidate ${provider} CDN cache: ${error.message}`, error);
        results.push({
          status: 'error',
          provider,
          message: error.message,
        });
      }
    }
    return results;
  }

  /**
   * Deploys suggestions to Tokowaka by generating patch config and uploading to S3
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to deploy
   * @returns {Promise<Object>} - Deployment result with succeeded/failed suggestions
   */
  async deploySuggestions(site, opportunity, suggestions) {
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

    // Check if domain-level metaconfig exists
    const firstUrl = new URL(Object.keys(suggestionsByUrl)[0], baseURL).toString();
    const metaconfig = await this.fetchMetaconfig(firstUrl);

    if (!metaconfig) {
      throw this.#createError(
        'No domain-level metaconfig found. '
        + 'A domain-level metaconfig needs to be created first before deploying suggestions.',
        HTTP_BAD_REQUEST,
      );
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
      deployedUrls.push(fullUrl);
    }

    this.log.info(`Uploaded Tokowaka configs for ${s3Paths.length} URLs`);

    // Update metaconfig with deployed paths
    await this.#updateMetaconfigWithDeployedPaths(metaconfig, deployedUrls, baseURL);

    // Invalidate CDN cache for all deployed URLs at once
    const cdnInvalidations = await this.invalidateCdnCache({ urls: deployedUrls });

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
    const cdnInvalidations = await this.invalidateCdnCache({ urls: rolledBackUrls });

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
    const edgeUrl = this.env.TOKOWAKA_EDGE_URL;
    if (!hasText(edgeUrl)) {
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

    // Fetch metaconfig to get API key
    const metaconfig = await this.fetchMetaconfig(previewUrl);

    if (!metaconfig) {
      throw this.#createError(
        'No domain-level metaconfig found. '
        + 'A domain-level metaconfig needs to be created first before previewing suggestions.',
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    const { apiKeys } = metaconfig;
    if (!Array.isArray(apiKeys) || apiKeys.length === 0 || !hasText(apiKeys[0])) {
      throw this.#createError(
        'Metaconfig does not have valid API keys configured. '
        + 'Please ensure the metaconfig has at least one API key.',
        HTTP_INTERNAL_SERVER_ERROR,
      );
    }

    const apiKey = apiKeys[0];
    const forwardedHost = calculateForwardedHost(previewUrl, this.log);

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
    const cdnInvalidationResults = await this.invalidateCdnCache({
      urls: [previewUrl],
      isPreview: true,
    });

    // Fetch HTML content for preview
    let originalHtml = null;
    let optimizedHtml = null;

    try {
      // Fetch original HTML (without preview)
      originalHtml = await fetchHtmlWithWarmup(
        previewUrl,
        apiKey,
        forwardedHost,
        edgeUrl,
        this.log,
        false,
        options,
      );
      // Then fetch optimized HTML (with preview)
      optimizedHtml = await fetchHtmlWithWarmup(
        previewUrl,
        apiKey,
        forwardedHost,
        edgeUrl,
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

  /**
   * Checks if Edge Optimize is enabled for a specific page path
   * Follows one level of redirect and retries on failures
   * @param {Object} site - Site entity
   * @param {string} path - Path to check (e.g., '/products/chair')
   * @returns {Promise<Object>} - Status result with edgeoptimizedenabled flag
   */
  async checkEdgeOptimizeStatus(site, path) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    if (!hasText(path)) {
      throw this.#createError('Path is required', HTTP_BAD_REQUEST);
    }

    const baseURL = getEffectiveBaseURL(site);
    const targetUrl = new URL(path, baseURL).toString();

    this.log.info(`Checking edge optimize status for ${targetUrl}`);

    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        this.log.debug(`Attempt ${attempt + 1}/${maxRetries + 1}: Checking edge optimize status for ${targetUrl}`);

        // eslint-disable-next-line no-await-in-loop
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'chatgpt-user',
            'fastly-debug': '1',
          },
        });

        this.log.debug(`Response status: ${response.status}`);

        const edgeOptimizeEnabled = response.headers.get('x-tokowaka-request-id') !== null
          || response.headers.get('x-edgeoptimize-request-id') !== null;

        this.log.debug(`Edge optimize headers found: ${edgeOptimizeEnabled}`);

        return {
          edgeoptimizedenabled: edgeOptimizeEnabled,
        };
      } catch (error) {
        attempt += 1;

        if (attempt > maxRetries) {
          // All retries exhausted
          this.log.error(`Failed after ${maxRetries + 1} attempts: ${error.message}`);
          throw this.#createError(
            `Failed to check edge optimize status: ${error.message}`,
            HTTP_INTERNAL_SERVER_ERROR,
          );
        }

        // Exponential backoff: 200ms, 400ms, 800ms
        const delay = 100 * (2 ** attempt);
        this.log.warn(
          `Attempt ${attempt} to fetch failed: ${error.message}. Retrying in ${delay}ms...`,
        );
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => {
          setTimeout(res, delay);
        });
      }
    }
    /* c8 ignore start */
    // This should never be reached, but needed for consistent-return
    throw this.#createError(
      'Failed to check edge optimize status after all retries',
      HTTP_INTERNAL_SERVER_ERROR,
    );
    /* c8 ignore stop */
  }
}

// Export the client as default and base classes for custom implementations
export default TokowakaClient;
