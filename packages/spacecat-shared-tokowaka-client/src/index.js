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
import {
  hasText, isNonEmptyObject, prependSchema, tracingFetch,
} from '@adobe/spacecat-shared-utils';
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
import {
  omitKeys,
  isEdgeDeployableSuggestionStatus,
  isPatternSuggestion,
  groupSuggestionsByUrlPath,
  filterEligibleSuggestions,
  saveSuggestions,
  stripSuggestion,
  cleanupCoveredSuggestions,
  classifySuggestions,
  filterBatchCoveredSuggestions,
} from './utils/suggestion-utils.js';
import { buildUrlMatcher } from './utils/pattern-utils.js';
import { getEffectiveBaseURL } from './utils/site-utils.js';
import { removePatternFromMetaconfig, addPatternsToMetaconfig } from './utils/metaconfig-utils.js';
import { fetchHtmlWithWarmup, calculateForwardedHost } from './utils/custom-html-utils.js';
import {
  EDGE_OPTIMIZE_PROXY_BASE_URL_DEFAULT,
  PRIVATE_HOST_RE,
  WAF_PROBE_TIMEOUT_MS,
  classifyProbeResponse,
} from './utils/waf-probe-utils.js';

export { FastlyKVClient } from './fastly-kv-client.js';
export { calculateForwardedHost } from './utils/custom-html-utils.js';

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

    const client = new TokowakaClient({
      bucketName,
      previewBucketName,
      s3Client: s3?.s3Client ?? context.s3Client,
      env,
      dataAccess: context.dataAccess,
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
   * @param {Object} [config.dataAccess] - Data access layer
   *   (provides Suggestion.saveMany for batch saves)
   * @param {Object} log - Logger instance
   */
  constructor({
    bucketName, previewBucketName, s3Client, env = {}, dataAccess,
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
    this.dataAccess = dataAccess;

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
   * Internal method to fetch domain-level metaconfig from S3 with metadata
   * @param {string} url - Full URL (used to extract domain)
   * @returns {Promise<Object|null>} - Object with metaconfig and s3Metadata,
   *   or null if not found
   * @private
   */
  async #fetchMetaconfigWithMetadata(url) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const fetchStartTime = Date.now();
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

      // eslint-disable-next-line max-len
      this.log.debug(`Successfully fetched metaconfig from s3://${bucketName}/${s3Path} in ${Date.now() - fetchStartTime}ms`);

      return {
        metaconfig,
        s3Metadata: response.Metadata || {},
      };
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
   * Fetches domain-level metaconfig from S3
   * @param {string} url - Full URL (used to extract domain)
   * @returns {Promise<Object|null>} - Metaconfig object or null if not found
   */
  async fetchMetaconfig(url) {
    const result = await this.#fetchMetaconfigWithMetadata(url);
    return result?.metaconfig ?? null;
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
   * @param {boolean} options.enhancements - Whether to enable enhancements
   *   (default: true)
   * @param {Object} metadata - Optional S3 user-defined metadata for
   *   audit trail and behavior flags
   * @param {string} metadata.lastModifiedBy - User who modified the config
   * @param {boolean} metadata.isStageDomain - Whether this is a staging
   *   domain (enables wildcard prerender)
   * @returns {Promise<Object>} - Object with s3Path and metaconfig
   */
  async createMetaconfig(url, siteId, options = {}, metadata = {}) {
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

    // Handle staging domain with automatic prerender configuration
    const isStageDomain = metadata.isStageDomain === true;
    if (isStageDomain) {
      metaconfig.prerender = { allowList: ['/*'] };
    }

    // Persist isStageDomain in S3 metadata for future updates
    const s3Metadata = {
      ...metadata,
      ...(isStageDomain && { isStageDomain: 'true' }),
    };

    const s3Path = await this.uploadMetaconfig(url, metaconfig, s3Metadata);
    this.log.info(`Created new Tokowaka metaconfig for ${normalizedHostName} at ${s3Path}`);

    return metaconfig;
  }

  /**
   * Updates domain-level metaconfig to S3 if it does not exists
   * Reuses the same API key and updates the metaconfig structure
   * @param {string} url - Full URL (used to extract domain)
   * @param {string} siteId - Site ID
   * @param {Object} options - Optional configuration
   * @param {Object} metadata - Optional S3 user-defined metadata for
   *   audit trail and behavior flags
   * @param {string} metadata.lastModifiedBy - User who modified the config
   * @param {boolean} metadata.isStageDomain - Whether this is a staging
   *   domain (enables wildcard prerender)
   * @returns {Promise<Object>} - Object with s3Path and metaconfig
   */
  async updateMetaconfig(url, siteId, options = {}, metadata = {}) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    const raw = await this.#fetchMetaconfigWithMetadata(url);
    if (!raw?.metaconfig) {
      throw this.#createError('Metaconfig does not exist for this URL', HTTP_BAD_REQUEST);
    }
    const { metaconfig: existingMetaconfig, s3Metadata: existingS3Metadata } = raw;

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

    // Handle staging domain: check from metadata or from existing S3 metadata (S3 lowercases keys)
    const isStageDomain = metadata.isStageDomain === true
      || existingS3Metadata.isstagedomain === 'true';

    const hasPrerender = isStageDomain
      || isNonEmptyObject(options.prerender)
      || isNonEmptyObject(existingMetaconfig.prerender);

    const prerender = isStageDomain
      ? { allowList: ['/*'] }
      : (options.prerender ?? existingMetaconfig.prerender);

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

    // Persist isStageDomain in S3 metadata for future updates
    const s3Metadata = {
      ...metadata,
      ...(isStageDomain && { isStageDomain: 'true' }),
    };

    const uploadedPath = await this.uploadMetaconfig(url, metaconfig, s3Metadata);
    this.log.info(`Updated Tokowaka metaconfig for ${normalizedHostName} at ${uploadedPath}`);

    return metaconfig;
  }

  /**
   * Uploads domain-level metaconfig to S3
   * @param {string} url - Full URL (used to extract domain)
   * @param {Object} metaconfig - Metaconfig object (siteId, apiKeys, prerender)
   * @param {Object} metadata - Optional S3 user-defined metadata (key-value pairs)
   * @returns {Promise<string>} - S3 key of uploaded metaconfig
  */
  async uploadMetaconfig(url, metaconfig, metadata = {}) {
    if (!hasText(url)) {
      throw this.#createError('URL is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(metaconfig)) {
      throw this.#createError('Metaconfig object is required', HTTP_BAD_REQUEST);
    }

    const uploadStartTime = Date.now();
    const s3Path = getTokowakaMetaconfigS3Path(url, this.log);
    const bucketName = this.deployBucketName;

    try {
      const putObjectParams = {
        Bucket: bucketName,
        Key: s3Path,
        Body: JSON.stringify(metaconfig, null, 2),
        ContentType: 'application/json',
      };

      // Add user-defined metadata if provided
      if (isNonEmptyObject(metadata)) {
        putObjectParams.Metadata = metadata;
      }

      const command = new PutObjectCommand(putObjectParams);

      await this.s3Client.send(command);
      // eslint-disable-next-line max-len
      this.log.info(`Successfully uploaded metaconfig to s3://${bucketName}/${s3Path} in ${Date.now() - uploadStartTime}ms`);

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

    const fetchStartTime = Date.now();
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

      // eslint-disable-next-line max-len
      this.log.debug(`Successfully fetched existing Tokowaka config from s3://${bucketName}/${s3Path} in ${Date.now() - fetchStartTime}ms`);
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

    const uploadStartTime = Date.now();
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
      // eslint-disable-next-line max-len
      this.log.info(`Successfully uploaded config to s3://${bucketName}/${s3Path} in ${Date.now() - uploadStartTime}ms`);
      return s3Path;
    } catch (error) {
      this.log.error(`Failed to upload config to S3: ${error.message}`, error);
      throw this.#createError(`S3 upload failed: ${error.message}`, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Deploys suggestions to Tokowaka CDN for a given site and set of suggestion IDs
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array<string>} suggestionIds - Array of suggestion IDs to deploy
   * @param {Object} metadata - Optional S3 user-defined metadata
   * @returns {Promise<Object>} - Deployment result with success and failure info
   */
  async deploySuggestions(site, opportunity, suggestionIds, metadata = {}) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(opportunity)) {
      throw this.#createError('Opportunity is required', HTTP_BAD_REQUEST);
    }

    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      throw this.#createError('Suggestion IDs are required', HTTP_BAD_REQUEST);
    }

    const baseURL = getEffectiveBaseURL(site);
    const opType = opportunity.getType();
    this.log.info(`Deploying ${suggestionIds.length} suggestions for ${baseURL} (${opType})`);

    // Load the Suggestion entities from dataAccess
    const { Suggestion } = this.dataAccess;
    const allSuggestions = await Suggestion.allByOpportunityId(opportunity.getId());
    const suggestions = allSuggestions.filter((s) => suggestionIds.includes(s.getId()));

    if (suggestions.length === 0) {
      throw this.#createError('No matching suggestions found', HTTP_BAD_REQUEST);
    }

    // Generate and upload individual Tokowaka configs per URL
    const urlGroups = groupSuggestionsByUrlPath(suggestions, baseURL);
    const deployedUrls = [];
    const failedUrls = [];

    await Promise.all(Object.entries(urlGroups).map(async ([url, urlSuggestions]) => {
      try {
        const eligibleSuggestions = filterEligibleSuggestions(urlSuggestions);
        if (eligibleSuggestions.length === 0) {
          this.log.info(`No eligible suggestions for ${url}, skipping config generation`);
          return;
        }
        const newConfig = this.generateConfig(url, opportunity, eligibleSuggestions);
        if (!newConfig) {
          this.log.info(`No config generated for ${url}, skipping upload`);
          return;
        }
        const existingConfig = await this.fetchConfig(url);
        const mergedConfig = this.mergeConfigs(existingConfig, newConfig);
        await this.uploadConfig(url, mergedConfig);
        deployedUrls.push(url);
      } catch (error) {
        this.log.error(`Failed to deploy config for ${url}: ${error.message}`);
        failedUrls.push({ url, error: error.message });
      }
    }));

    // After deploying individual configs, update the metaconfig patches
    await this.#updateMetaconfigWithDeployedPaths(
      await this.fetchMetaconfig(baseURL) || {},
      deployedUrls,
      baseURL,
    );

    // Mark deployed suggestions as DEPLOYED
    const allDeployedSuggestions = suggestions.filter((s) => {
      const url = new URL(s.getData().url).toString();
      return deployedUrls.includes(url);
    });
    await saveSuggestions(allDeployedSuggestions, 'DEPLOYED', this.log);

    return {
      deployed: deployedUrls,
      failed: failedUrls,
    };
  }

  /**
   * Rolls back suggestions for a given site and set of suggestion IDs
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array<string>} suggestionIds - Array of suggestion IDs to rollback
   * @param {Object} metadata - Optional S3 user-defined metadata
   * @returns {Promise<Object>} - Rollback result with success and failure info
   */
  async rollbackSuggestions(site, opportunity, suggestionIds, metadata = {}) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(opportunity)) {
      throw this.#createError('Opportunity is required', HTTP_BAD_REQUEST);
    }

    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      throw this.#createError('Suggestion IDs are required', HTTP_BAD_REQUEST);
    }

    const baseURL = getEffectiveBaseURL(site);
    this.log.info(`Rolling back ${suggestionIds.length} suggestions for ${baseURL}`);

    const { Suggestion } = this.dataAccess;
    const allSuggestions = await Suggestion.allByOpportunityId(opportunity.getId());
    const suggestions = allSuggestions.filter((s) => suggestionIds.includes(s.getId()));

    if (suggestions.length === 0) {
      throw this.#createError('No matching suggestions found', HTTP_BAD_REQUEST);
    }

    const urlGroups = groupSuggestionsByUrlPath(suggestions, baseURL);
    const rolledBackUrls = [];
    const failedUrls = [];

    await Promise.all(Object.entries(urlGroups).map(async ([url, urlSuggestions]) => {
      try {
        const existingConfig = await this.fetchConfig(url);
        if (!existingConfig) {
          this.log.info(`No config found for ${url}, skipping rollback`);
          return;
        }

        const opportunityId = opportunity.getId();
        const strippedSuggestions = urlSuggestions.map((s) => stripSuggestion(s, opportunityId));
        const updatedConfig = {
          ...existingConfig,
          patches: existingConfig.patches.filter(
            (p) => !strippedSuggestions.some(
              (s) => s.opportunityId === p.opportunityId && s.suggestionId === p.suggestionId,
            ),
          ),
        };

        await this.uploadConfig(url, updatedConfig);
        rolledBackUrls.push(url);
      } catch (error) {
        this.log.error(`Failed to rollback config for ${url}: ${error.message}`);
        failedUrls.push({ url, error: error.message });
      }
    }));

    // Mark rolled-back suggestions as INITIAL
    const allRolledBackSuggestions = suggestions.filter((s) => {
      const url = new URL(s.getData().url).toString();
      return rolledBackUrls.includes(url);
    });
    await saveSuggestions(allRolledBackSuggestions, 'INITIAL', this.log);

    return {
      rolledBack: rolledBackUrls,
      failed: failedUrls,
    };
  }

  /**
   * Deploys edge optimize suggestions for all eligible suggestions of a given opportunity
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Object} metadata - Optional S3 user-defined metadata
   * @returns {Promise<Object>} - Deployment result
   */
  async deployEdgeOptimizeSuggestions(site, opportunity, metadata = {}) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(opportunity)) {
      throw this.#createError('Opportunity is required', HTTP_BAD_REQUEST);
    }

    const baseURL = getEffectiveBaseURL(site);
    this.log.info(`Deploying edge optimize suggestions for ${baseURL}`);

    const { Suggestion } = this.dataAccess;
    const allSuggestions = await Suggestion.allByOpportunityId(opportunity.getId());

    const deployableSuggestions = allSuggestions.filter((s) => isEdgeDeployableSuggestionStatus(s.getStatus()));
    if (deployableSuggestions.length === 0) {
      this.log.info(`No eligible suggestions to deploy for ${baseURL}`);
      return { deployed: [], failed: [] };
    }

    this.log.info(`Deploying ${deployableSuggestions.length} edge optimize suggestions for ${baseURL}`);
    const suggestionIds = deployableSuggestions.map((s) => s.getId());

    return this.deploySuggestions(site, opportunity, suggestionIds, metadata);
  }

  /**
   * Generates and deploys a batch of Tokowaka configs based on new suggestions
   * and a pre-fetched list of existing suggestions in DEPLOYED status.
   *
   * This method is designed for the nightly batch-sync job, where a single
   * S3 read + diff is cheaper than N per-URL fetchConfig calls.
   *
   * @param {Object}   site              - Site entity (provides baseURL, siteId).
   * @param {Object}   opportunity       - Opportunity entity (type + id).
   * @param {Array}    newSuggestions    - New suggestion entities to consider.
   * @param {Array}    deployedSuggestions - Existing DEPLOYED suggestion entities.
   * @param {Object}   [metadata={}]     - Optional S3 user-defined metadata.
   * @returns {Promise<{deployed: string[], failed: Array<{url,error}>}>}
   */
  async batchDeploySuggestions(
    site, opportunity, newSuggestions, deployedSuggestions, metadata = {},
  ) {
    if (!isNonEmptyObject(site)) throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    if (!isNonEmptyObject(opportunity)) throw this.#createError('Opportunity is required', HTTP_BAD_REQUEST);

    const baseURL = getEffectiveBaseURL(site);
    this.log.info(`[batchDeploy] Starting batch deploy for ${baseURL}, ` +
      `newSuggestions=${newSuggestions.length}, deployedSuggestions=${deployedSuggestions.length}`);

    // ---------- 1. compute diff per URL (no S3 reads yet) ----------
    const incomingGroups = groupSuggestionsByUrlPath(newSuggestions, baseURL);
    const existingGroups = groupSuggestionsByUrlPath(deployedSuggestions, baseURL);

    // Collect all URLs that appear in either set
    const allUrls = new Set([
      ...Object.keys(incomingGroups),
      ...Object.keys(existingGroups),
    ]);

    const deployedUrls = [];
    const failedUrls = [];
    const skippedUrls = [];

    await Promise.all([...allUrls].map(async (url) => {
      try {
        const incoming = incomingGroups[url] ?? [];
        const existing = existingGroups[url] ?? [];

        // Filter to suggestions that should actually be deployed
        const eligible = filterEligibleSuggestions(incoming);

        // Build covered-by map and exclude pattern suggestions already covered by an LCP candidate
        const incomingFiltered = filterBatchCoveredSuggestions(eligible, existing);

        if (incomingFiltered.length === 0 && existing.length === 0) {
          this.log.debug(`[batchDeploy] Nothing to do for ${url}, skipping`);
          skippedUrls.push(url);
          return;
        }

        // We need to read the current S3 config to perform a surgical merge
        const existingConfig = await this.fetchConfig(url);

        // Remove stale patches (suggestions that were DEPLOYED but are no longer in the new set)
        const staleSuggestions = classifySuggestions(incoming, existing, this.log);
        const configAfterCleanup = cleanupCoveredSuggestions(
          existingConfig,
          staleSuggestions,
          opportunity.getId(),
          this.log,
        );

        // Generate and merge new patches
        const newConfig = incomingFiltered.length > 0
          ? this.generateConfig(url, opportunity, incomingFiltered)
          : null;
        const finalConfig = newConfig
          ? this.mergeConfigs(configAfterCleanup, newConfig)
          : configAfterCleanup;

        if (!finalConfig) {
          this.log.info(`[batchDeploy] No final config for ${url}, skipping upload`);
          skippedUrls.push(url);
          return;
        }

        await this.uploadConfig(url, finalConfig);
        deployedUrls.push(url);
      } catch (error) {
        this.log.error(`[batchDeploy] Failed for ${url}: ${error.message}`);
        failedUrls.push({ url, error: error.message });
      }
    }));

    await this.#updateMetaconfigWithDeployedPaths(
      await this.fetchMetaconfig(baseURL) || {},
      deployedUrls,
      baseURL,
    );

    this.log.info(
      `[batchDeploy] Done for ${baseURL}: ` +
      `deployed=${deployedUrls.length}, failed=${failedUrls.length}, skipped=${skippedUrls.length}`,
    );

    return { deployed: deployedUrls, failed: failedUrls };
  }

  /**
   * Invalidates CDN cache for a given set of paths
   * @param {Object} options - Options object
   * @param {Array<string>} options.paths - Array of paths to invalidate
   * @returns {Promise<void>}
   */
  async invalidateCdnCache({ paths }) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return;
    }

    const providers = this.#getCdnProviders();
    if (providers.length === 0) {
      this.log.warn('No CDN providers configured, skipping cache invalidation');
      return;
    }

    await Promise.all(providers.map(async (provider) => {
      try {
        const cdnClient = this.cdnClientRegistry.getClient(provider);
        if (!cdnClient) {
          this.log.warn(`No CDN client found for provider: ${provider}`);
          return;
        }
        await cdnClient.invalidateCache(paths);
        this.log.info(`Successfully invalidated CDN cache for provider: ${provider}`);
      } catch (error) {
        this.log.error(`Failed to invalidate CDN cache for provider ${provider}: ${error.message}`);
      }
    }));
  }

  /**
   * Checks if Edge Optimize is enabled for a specific page path
   * Follows one level of redirect and retries on failures
   * @param {Object} site - Site entity
   * @param {string} path - Path to check (e.g., '/products/chair')
   * @returns {Promise<Object>} - Status result with edgeOptimizeEnabled flag
   */
  async checkEdgeOptimizeStatus(site, path) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    if (!hasText(path)) {
      throw this.#createError('Path is required', HTTP_BAD_REQUEST);
    }

    const currentConfig = site.getConfig();
    const existingEdgeConfig = currentConfig?.getEdgeOptimizeConfig();
    const isAlreadyEnabled = existingEdgeConfig?.enabled ?? false;
    if (isAlreadyEnabled) {
      return { edgeOptimizeEnabled: true };
    }

    const baseURL = getEffectiveBaseURL(site);
    const targetUrl = new URL(path, baseURL).toString();

    this.log.info(`Checking edge optimize status for ${targetUrl}`);

    const maxRetries = 3;
    let attempt = 0;

    const REQUEST_TIMEOUT_MS = 5000;

    // Build probe headers: start with safe defaults, then overlay any per-site
    // custom headers from config.scraperConfig.headers so customers can
    // configure an allowlist-friendly User-Agent or add a shared-secret header
    // instead of being blocked by their WAF/CDN (see LLMO-5280).
    const DEFAULT_PROBE_HEADERS = {
      // eslint-disable-next-line max-len
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Tokowaka-AI Tokowaka/1.0 AdobeEdgeOptimize-AI AdobeEdgeOptimize/1.0',
      'fastly-debug': '1',
    };
    const customHeaders = currentConfig?.getScraperConfig?.()?.headers ?? {};
    const probeHeaders = { ...DEFAULT_PROBE_HEADERS, ...customHeaders };

    while (attempt <= maxRetries) {
      try {
        // eslint-disable-next-line max-len
        this.log.debug(`Attempt ${attempt + 1}/${maxRetries + 1}: Checking edge optimize status for ${targetUrl}`);

        // eslint-disable-next-line no-await-in-loop
        const response = await tracingFetch(targetUrl, {
          method: 'GET',
          headers: probeHeaders,
          timeout: REQUEST_TIMEOUT_MS,
        });

        this.log.info(`Edge optimize probe for ${targetUrl} status=${response.status}`);

        const edgeOptimizeEnabled = response.headers.get('x-tokowaka-request-id') !== null
          || response.headers.get('x-edgeoptimize-request-id') !== null;

        this.log.debug(`Edge optimize headers found: ${edgeOptimizeEnabled}`);

        return {
          edgeOptimizeEnabled,
        };
      } catch (error) {
        const isTimeout = error?.code === 'ETIMEOUT';

        if (isTimeout) {
          // eslint-disable-next-line max-len
          this.log.warn(`Request timed out after ${REQUEST_TIMEOUT_MS}ms for ${targetUrl}, returning edgeOptimizeEnabled: false`);
          return { edgeOptimizeEnabled: false };
        }

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

  /**
   * Probes whether a WAF or Bot Manager is blocking AdobeEdgeOptimize/1.0 traffic
   * for the site.
   *
   * Probe outcomes:
   * - Hard block: HTTP 401/403/406/429/503 → `{ reachable: false, blocked: true }`
   * - CF challenge: cf-mitigated: challenge header → `{ reachable: false, blocked: true }`
   * - Soft block: 2xx with bot-challenge HTML → `{ reachable: false, blocked: true }`
   * - Pass: 2xx with real content → `{ reachable: true, blocked: false }`
   * - Network/timeout error → `{ reachable: false, blocked: null }`
   *
   * This method never throws — all errors are captured into the return value.
   * Use the separate edge-optimize status API to determine if edge optimize is active.
   *
   * @param {import('@adobe/spacecat-shared-data-access').Site} site
   * @returns {Promise<{reachable: boolean, blocked: boolean|null, status?: number}>}
   */
  async probeWafBlock(site) {
    if (!isNonEmptyObject(site)) {
      throw this.#createError('Site is required', HTTP_BAD_REQUEST);
    }

    const baseURL = getEffectiveBaseURL(site);

    // Skip private/internal hosts — no WAF probe needed
    if (PRIVATE_HOST_RE.test(new URL(baseURL).hostname)) {
      this.log.info(`probeWafBlock: skipping private host ${baseURL}`);
      return { reachable: true, blocked: false };
    }

    const proxyUrl = `${EDGE_OPTIMIZE_PROXY_BASE_URL_DEFAULT}${prependSchema(baseURL, 'https')}/`;

    this.log.info(`probeWafBlock: sending probe to ${proxyUrl}`);

    let response;
    try {
      response = await tracingFetch(proxyUrl, {
        method: 'GET',
        headers: {
          // eslint-disable-next-line max-len
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Tokowaka-AI Tokowaka/1.0 AdobeEdgeOptimize-AI AdobeEdgeOptimize/1.0',
        },
        redirect: 'follow',
        timeout: WAF_PROBE_TIMEOUT_MS,
      });
    } catch (fetchError) {
      this.log.warn(`probeWafBlock: network/timeout error for ${proxyUrl}: ${fetchError.message}`);
      return { reachable: false, blocked: null };
    }

    const body = await response.text();
    const result = classifyProbeResponse(response, body, this.log);
    this.log.info(`probeWafBlock: ${proxyUrl} → status=${response.status}, result=${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Fetches and compares original vs optimized HTML for a preview URL
   * @param {string} previewUrl - The preview URL to fetch
   * @param {string} baseURL - Base URL for the original request
   * @returns {Promise<Object>} - Comparison result
   */
  async compareHtml(previewUrl, baseURL) {
    if (!hasText(previewUrl)) {
      throw this.#createError('Preview URL is required', HTTP_BAD_REQUEST);
    }

    if (!hasText(baseURL)) {
      throw this.#createError('Base URL is required', HTTP_BAD_REQUEST);
    }

    const originalUrl = new URL(new URL(previewUrl).pathname, baseURL).toString();

    const [optimizedHtml, originalHtml] = await Promise.all([
      fetchHtmlWithWarmup(previewUrl, { skipWarmup: true }),
      fetchHtmlWithWarmup(originalUrl, { skipWarmup: true }),
    ]);

    const previewUrlObj = new URL(previewUrl);
    const host = previewUrlObj.hostname;
    const path = previewUrlObj.pathname;

    return {
      host,
      path,
      htmlComparison: {
        url: previewUrl,
        originalHtml,
        optimizedHtml,
      },
    };
  }
}

export { TokowakaClient }; // Named export for test and non-default import implementations
export default TokowakaClient;
