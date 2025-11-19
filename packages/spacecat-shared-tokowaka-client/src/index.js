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

  /**
   * Helper function to wait for a specified duration
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  static #sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Fetches HTML content from Tokowaka edge with warmup call
   * Makes an initial warmup call, waits 3 seconds, then makes the actual call
   * @param {string} url - Full URL to fetch
   * @param {string} apiKey - Tokowaka API key
   * @param {string} forwardedHost - Host to forward in x-forwarded-host header
   * @param {boolean} isOptimized - Whether to fetch optimized HTML (with preview param)
   * @returns {Promise<string>} - HTML content
   */
  async fetchHtml(url, apiKey, forwardedHost, isOptimized = false) {
    if (!hasText(url)) {
      throw this.#createError('URL is required for fetching HTML', HTTP_BAD_REQUEST);
    }

    if (!hasText(apiKey)) {
      throw this.#createError('Tokowaka API key is required for fetching HTML', HTTP_BAD_REQUEST);
    }

    if (!hasText(forwardedHost)) {
      throw this.#createError('Forwarded host is required for fetching HTML', HTTP_BAD_REQUEST);
    }

    const tokowakaEdgeUrl = this.env.TOKOWAKA_EDGE_URL;
    if (!hasText(tokowakaEdgeUrl)) {
      throw this.#createError('TOKOWAKA_EDGE_URL is not configured', HTTP_BAD_REQUEST);
    }

    // Parse the URL to extract path and construct full URL
    const urlObj = new URL(url);
    const urlPath = urlObj.pathname + urlObj.search;

    // Add tokowakaPreview param for optimized HTML
    let fullUrl = `${tokowakaEdgeUrl}${urlPath}`;
    if (isOptimized) {
      // Add tokowakaPreview param, handling existing query params
      const separator = urlPath.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${separator}tokowakaPreview=true`;
    }

    const headers = {
      'x-forwarded-host': forwardedHost,
      'x-tokowaka-api-key': apiKey,
      'x-tokowaka-url': urlPath,
    };

    try {
      // First call - warmup (ignore response)
      this.log.info(`Making warmup call for ${isOptimized ? 'optimized' : 'original'} HTML`);
      this.log.info(`Warmup request URL: ${fullUrl}`);
      this.log.info(`Warmup request headers: ${JSON.stringify(headers)}`);

      const warmupResponse = await fetch(fullUrl, {
        method: 'GET',
        headers,
      });

      this.log.info(`Warmup response status: ${warmupResponse.status} ${warmupResponse.statusText}`);
      // Consume the response body to free up the connection
      await warmupResponse.text();
      this.log.info('Warmup call completed, waiting 3 seconds...');

      // Wait 3 seconds
      await TokowakaClient.#sleep(2000);

      // Second call - actual request
      this.log.info(`Making actual call for ${isOptimized ? 'optimized' : 'original'} HTML`);
      this.log.info(`Actual request URL: ${fullUrl}`);
      this.log.info(`Actual request headers: ${JSON.stringify(headers)}`);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
      });

      this.log.info(`Actual response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      this.log.info(`Successfully fetched ${isOptimized ? 'optimized' : 'original'} HTML (${html.length} bytes)`);
      return html;
    } catch (error) {
      const errorMsg = `Failed to fetch ${isOptimized ? 'optimized' : 'original'} HTML: ${error.message}`;
      this.log.error(errorMsg);
      throw this.#createError(errorMsg, HTTP_INTERNAL_SERVER_ERROR);
    }
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
   * @returns {Object} - Tokowaka configuration object
   */
  generateConfig(site, opportunity, suggestionsToDeploy) {
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
      const patches = mapper.suggestionsToPatches(
        urlPath,
        urlSuggestions,
        opportunity.getId(),
      );

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
        Bucket: this.deployBucketName,
        Key: s3Path,
      });

      const response = await this.s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      const config = JSON.parse(bodyContents);

      this.log.debug(`Successfully fetched existing Tokowaka config from s3://${this.deployBucketName}/${s3Path}`);
      return config;
    } catch (error) {
      // If config doesn't exist (NoSuchKey), return null
      if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
        this.log.debug(`No existing Tokowaka config found at s3://${this.deployBucketName}/${s3Path}`);
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
   * - Patches are identified by opportunityId+suggestionId
   * - Heading patches (no suggestionId) are identified by opportunityId:heading
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
   * @param {boolean} isPreview - Whether to upload to preview path (default: false)
   * @returns {Promise<string>} - S3 key of uploaded config
   */
  async uploadConfig(siteTokowakaKey, config, isPreview = false) {
    if (!hasText(siteTokowakaKey)) {
      throw this.#createError('Tokowaka API key is required', HTTP_BAD_REQUEST);
    }

    if (!isNonEmptyObject(config)) {
      throw this.#createError('Config object is required', HTTP_BAD_REQUEST);
    }

    const s3Path = getTokowakaConfigS3Path(siteTokowakaKey, isPreview);

    try {
      const command = new PutObjectCommand({
        Bucket: isPreview ? this.previewBucketName : this.deployBucketName,
        Key: s3Path,
        Body: JSON.stringify(config, null, 2),
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.log.info(`Successfully uploaded Tokowaka config to s3://${this.deployBucketName}/${s3Path}`);

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
   * @param {boolean} isPreview - Whether to invalidate preview path (default: false)
   * @returns {Promise<Object|null>} - CDN invalidation result or null if skipped
   */
  async invalidateCdnCache(apiKey, provider, isPreview = false) {
    if (!hasText(apiKey) || !hasText(provider)) {
      throw this.#createError('Tokowaka API key and provider are required', HTTP_BAD_REQUEST);
    }
    try {
      const pathsToInvalidate = [`/${getTokowakaConfigS3Path(apiKey, isPreview)}`];
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
   * @returns {Promise<Object>} - Deployment result with succeeded/failed suggestions
   */
  async deploySuggestions(site, opportunity, suggestions) {
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

    // Fetch existing configuration from S3
    this.log.debug(`Fetching existing Tokowaka config for site ${site.getId()}`);
    const existingConfig = await this.fetchConfig(apiKey);

    // Generate configuration with eligible suggestions only
    this.log.debug(`Generating Tokowaka config for site ${site.getId()}, opportunity ${opportunity.getId()}`);
    const newConfig = this.generateConfig(
      site,
      opportunity,
      eligibleSuggestions,
    );

    if (Object.keys(newConfig.tokowakaOptimizations).length === 0) {
      this.log.warn('No eligible suggestions to deploy');
      return {
        succeededSuggestions: [],
        failedSuggestions: suggestions,
      };
    }

    // Merge with existing config
    const config = this.mergeConfigs(existingConfig, newConfig);

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

  /**
   * Previews suggestions by generating config and uploading to preview path
   * Unlike deploySuggestions, this does NOT merge with existing config
   * @param {Object} site - Site entity
   * @param {Object} opportunity - Opportunity entity
   * @param {Array} suggestions - Array of suggestion entities to preview
   * @returns {Promise<Object>} - Preview result with config and succeeded/failed suggestions
   */
  async previewSuggestions(site, opportunity, suggestions) {
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

    // Fetch existing deployed configuration from production S3
    this.log.debug(`Fetching existing deployed Tokowaka config for site ${site.getId()}`);
    const existingConfig = await this.fetchConfig(apiKey, false);

    // Generate configuration with eligible preview suggestions
    this.log.debug(`Generating preview Tokowaka config for site ${site.getId()}, opportunity ${opportunity.getId()}`);
    const newConfig = this.generateConfig(
      site,
      opportunity,
      eligibleSuggestions,
    );

    if (Object.keys(newConfig.tokowakaOptimizations).length === 0) {
      this.log.warn('No eligible suggestions to preview');
      return {
        config: null,
        succeededSuggestions: [],
        failedSuggestions: suggestions,
      };
    }

    // Get the preview URL from the first suggestion
    const previewUrl = eligibleSuggestions[0].getData()?.url;

    // Merge with existing deployed config to include already-deployed patches for this URL
    let config = newConfig;
    if (existingConfig && previewUrl) {
      // Extract the URL path from the preview URL
      const urlPath = new URL(previewUrl).pathname;

      // Check if there are already deployed patches for this URL
      const existingUrlOptimization = existingConfig.tokowakaOptimizations?.[urlPath];

      if (existingUrlOptimization && existingUrlOptimization.patches?.length > 0) {
        this.log.info(
          `Found ${existingUrlOptimization.patches.length} deployed patches for ${urlPath}, `
          + 'merging with preview suggestions',
        );

        // Create a filtered existing config with only the URL being previewed
        const filteredExistingConfig = {
          ...existingConfig,
          tokowakaOptimizations: {
            [urlPath]: existingUrlOptimization,
          },
        };

        // Merge the existing deployed patches with new preview suggestions
        config = this.mergeConfigs(filteredExistingConfig, newConfig);

        this.log.debug(
          `Preview config now has ${config.tokowakaOptimizations[urlPath].patches.length} total patches`,
        );
      } else {
        this.log.info(`No deployed patches found for ${urlPath}, using only preview suggestions`);
      }
    }

    // Upload to preview S3 path (replaces any existing preview config)
    this.log.info(`Uploading preview Tokowaka config with ${eligibleSuggestions.length} new suggestions`);
    const s3Path = await this.uploadConfig(apiKey, config, true);

    // Invalidate CDN cache for preview path
    const cdnInvalidationResult = await this.invalidateCdnCache(
      apiKey,
      this.env.TOKOWAKA_CDN_PROVIDER,
      true,
    );

    // Fetch HTML content for preview
    let originalHtml = null;
    let optimizedHtml = null;

    if (previewUrl) {
      // Get forwarded host from site config
      const tokowakaConfig = site.getConfig()?.getTokowakaConfig();
      const forwardedHost = tokowakaConfig?.forwardedHost
        || getEffectiveBaseURL(site);

      try {
        this.log.info(`Fetching HTML for preview URL: ${previewUrl}`);

        // Fetch original HTML first
        this.log.info('Step 1: Fetching original HTML');
        originalHtml = await this.fetchHtml(previewUrl, apiKey, forwardedHost, false);
        this.log.info('Original HTML fetch completed');

        // Then fetch optimized HTML
        this.log.info('Step 2: Fetching optimized HTML');
        optimizedHtml = await this.fetchHtml(previewUrl, apiKey, forwardedHost, true);
        this.log.info('Optimized HTML fetch completed');

        this.log.info('Successfully fetched both original and optimized HTML for preview');
      } catch (error) {
        this.log.error(`Failed to fetch HTML for preview: ${error.message}`);
        // Don't fail the entire preview if HTML fetch fails
        // Return null values and let the caller handle it
      }
    }

    return {
      s3Path,
      config,
      cdnInvalidation: cdnInvalidationResult,
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
