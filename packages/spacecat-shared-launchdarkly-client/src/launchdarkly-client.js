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

import * as ld from '@launchdarkly/node-server-sdk';

const DEFAULT_API_BASE_URL = 'https://app.launchdarkly.com';

/**
 * LaunchDarkly Client wrapper for SpaceCat services.
 * Supports both the Server SDK (flag evaluation) and the REST API (flag management).
 */
class LaunchDarklyClient {
  /**
   * Creates a LaunchDarklyClient instance from a Universal context
   * @param {Object} context - The Universal context object
   * @param {Object} context.env - Environment variables
   * @param {string} context.env.LD_SDK_KEY - LaunchDarkly SDK key
   * @param {string} [context.env.LD_API_TOKEN] - LaunchDarkly API access token
   * @param {string} [context.env.LD_API_BASE_URL] - LaunchDarkly API base URL
   * @param {Object} context.log - Logger instance
   * @returns {LaunchDarklyClient} A new LaunchDarklyClient instance
   */
  static createFrom(context) {
    const {
      LD_SDK_KEY: sdkKey,
      LD_API_TOKEN: apiToken,
      LD_API_BASE_URL: apiBaseUrl,
    } = context.env;
    return new LaunchDarklyClient({ sdkKey, apiToken, apiBaseUrl }, context.log);
  }

  /**
   * Creates a new LaunchDarklyClient instance
   * @param {Object} config - Configuration object
   * @param {string} [config.sdkKey] - LaunchDarkly SDK key (required for flag evaluation)
   * @param {string} [config.apiToken] - LaunchDarkly API access token (required for flag
   *   management via REST API)
   * @param {string} [config.apiBaseUrl] - LaunchDarkly API base URL
   * @param {Object} [config.options] - Additional LaunchDarkly SDK options
   * @param {Object} [log=console] - Logger instance
   */
  constructor(config, log = console) {
    const {
      sdkKey, apiToken, apiBaseUrl, options = {},
    } = config;

    if (!sdkKey && !apiToken) {
      throw new Error('LaunchDarkly SDK key or API token is required');
    }

    this.sdkKey = sdkKey;
    this.apiToken = apiToken;
    this.apiBaseUrl = apiBaseUrl || DEFAULT_API_BASE_URL;
    this.options = options;
    this.log = log;
    this.client = null;
    this.initPromise = null;
  }

  /**
   * Initializes the LaunchDarkly Server SDK client (for flag evaluation).
   * @returns {Promise<void>}
   * @throws {Error} If sdkKey was not provided
   */
  async init() {
    if (!this.sdkKey) {
      throw new Error('LaunchDarkly SDK key is required for flag evaluation');
    }

    if (this.client) {
      return undefined;
    }

    if (this.initPromise) {
      await this.initPromise;
      return undefined;
    }

    this.initPromise = (async () => {
      try {
        this.client = ld.init(this.sdkKey, this.options);
        await this.client.waitForInitialization();
        this.log.info('LaunchDarkly client initialized successfully');
      } catch (error) {
        this.log.error('Failed to initialize LaunchDarkly client:', error);
        throw error;
      }
    })();

    await this.initPromise;
    return undefined;
  }

  /**
   * Evaluates a feature flag for a given context
   * @param {string} flagKey - The feature flag key
   * @param {Object} context - The LaunchDarkly context (user/application context)
   * @param {*} defaultValue - Default value if flag evaluation fails
   * @returns {Promise<*>} The evaluated flag value
   */
  async variation(flagKey, context, defaultValue) {
    await this.init();

    try {
      const value = await this.client.variation(flagKey, context, defaultValue);
      this.log.debug(`Flag "${flagKey}" evaluated to:`, value);
      return value;
    } catch (error) {
      this.log.error(`Error evaluating flag "${flagKey}":`, error);
      return defaultValue;
    }
  }

  /**
   * Check if a feature flag is enabled for a specific IMS organization
   * @param {string} flagKey - The feature flag key
   * @param {string} imsOrgId - The IMS organization ID
   * @param {string} [userKey='anonymous'] - Optional user key for tracking
   * @returns {Promise<boolean>} True if flag is enabled for the IMS org, false otherwise
   */
  async isFlagEnabledForIMSOrg(flagKey, imsOrgId, userKey = 'anonymous') {
    const context = {
      kind: 'multi',
      user: {
        key: userKey,
      },
      organization: {
        key: imsOrgId,
        identityProviderId: imsOrgId,
      },
    };

    return this.variation(flagKey, context, false);
  }

  /**
   * Makes an authenticated request to the LaunchDarkly REST API.
   * @param {string} method - HTTP method
   * @param {string} path - API path (appended to apiBaseUrl)
   * @param {Object} [body] - Request body
   * @param {string} [contentType='application/json'] - Content-Type header
   * @returns {Promise<Object>} Parsed JSON response
   * @private
   */
  async _apiRequest(method, path, body, contentType = 'application/json', extraHeaders = {}) {
    if (!this.apiToken) {
      throw new Error('LaunchDarkly API token is required for REST API operations');
    }

    const url = `${this.apiBaseUrl}${path}`;
    const headers = {
      Authorization: this.apiToken,
      'Content-Type': contentType,
      ...extraHeaders,
    };

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    this.log.info(`LaunchDarkly API ${method} ${path}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(`LaunchDarkly API error: ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.body = errorBody;
      this.log.error(`LaunchDarkly API error: ${response.status}`, errorBody);
      throw error;
    }

    return response.json();
  }

  /**
   * Gets a feature flag's configuration from the LaunchDarkly REST API.
   * Returns the flag's variations, targeting rules, and environment-specific configuration.
   * @param {string} projectKey - The LaunchDarkly project key
   * @param {string} flagKey - The feature flag key
   * @param {string} [environmentKey] - Optional environment key to filter response
   * @returns {Promise<Object>} The feature flag configuration
   */
  async getFeatureFlag(projectKey, flagKey, environmentKey) {
    let path = `/api/v2/flags/${encodeURIComponent(projectKey)}/${encodeURIComponent(flagKey)}`;
    if (environmentKey) {
      path += `?env=${encodeURIComponent(environmentKey)}`;
    }
    return this._apiRequest('GET', path);
  }

  /**
   * Updates the fallthrough (default) variation for a feature flag in a specific environment.
   * This changes which variation is served when no targeting rules match.
   * @param {string} projectKey - The LaunchDarkly project key
   * @param {string} flagKey - The feature flag key
   * @param {string} environmentKey - The environment key
   * @param {string} variationId - The variation ID to serve as the default
   *   (from the variation's _id field)
   * @param {string} [comment] - Optional comment describing the change
   * @returns {Promise<Object>} The updated feature flag configuration
   */
  async updateFallthroughVariation(projectKey, flagKey, environmentKey, variationId, comment) {
    const path = `/api/v2/flags/${encodeURIComponent(projectKey)}/${encodeURIComponent(flagKey)}`;
    const body = {
      environmentKey,
      instructions: [
        {
          kind: 'updateFallthroughVariationOrRollout',
          variationId,
        },
      ],
    };

    if (comment) {
      body.comment = comment;
    }

    return this._apiRequest(
      'PATCH',
      path,
      body,
      'application/json; domain-model=launchdarkly.semanticpatch',
    );
  }

  /**
   * Updates the value of a specific variation of a feature flag.
   * This modifies the actual value stored in the variation, affecting all environments.
   * @param {string} projectKey - The LaunchDarkly project key
   * @param {string} flagKey - The feature flag key
   * @param {number} variationIndex - The zero-based index of the variation to update
   * @param {*} newValue - The new value for the variation
   * @param {string} [comment] - Optional comment describing the change
   * @returns {Promise<Object>} The updated feature flag configuration
   */
  async updateVariationValue(projectKey, flagKey, variationIndex, newValue, comment) {
    const path = `/api/v2/flags/${encodeURIComponent(projectKey)}/${encodeURIComponent(flagKey)}`;
    const patch = [
      {
        op: 'replace',
        path: `/variations/${variationIndex}/value`,
        value: newValue,
      },
    ];

    const extraHeaders = {};
    if (comment) {
      extraHeaders['X-LaunchDarkly-Comment'] = comment;
    }

    return this._apiRequest('PATCH', path, patch, 'application/json', extraHeaders);
  }
}

export default LaunchDarklyClient;
