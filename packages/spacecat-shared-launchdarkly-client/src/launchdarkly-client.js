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

/**
 * LaunchDarkly Client wrapper for SpaceCat services
 */
class LaunchDarklyClient {
  /**
   * Creates a LaunchDarklyClient instance from a Universal context
   * @param {Object} context - The Universal context object
   * @param {Object} context.env - Environment variables
   * @param {string} context.env.LD_SDK_KEY - LaunchDarkly SDK key
   * @param {Object} context.log - Logger instance
   * @returns {LaunchDarklyClient} A new LaunchDarklyClient instance
   */
  static createFrom(context) {
    const {
      LD_SDK_KEY: sdkKey,
    } = context.env;
    return new LaunchDarklyClient({ sdkKey }, context.log);
  }

  /**
   * Creates a new LaunchDarklyClient instance
   * @param {Object} config - Configuration object
   * @param {string} config.sdkKey - LaunchDarkly SDK key
   * @param {Object} [config.options] - Additional LaunchDarkly SDK options
   * @param {Object} [log=console] - Logger instance
   */
  constructor(config, log = console) {
    const { sdkKey, options = {} } = config;

    if (!sdkKey) {
      throw new Error('LaunchDarkly SDK key is required');
    }

    this.sdkKey = sdkKey;
    this.options = options;
    this.log = log;
    this.client = null;
    this.initPromise = null;
  }

  /**
   * Initializes the LaunchDarkly client
   * @returns {Promise<void>}
   */
  async init() {
    // If already initialized, return immediately
    if (this.client) {
      return undefined;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return undefined;
    }

    // Start initialization
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
}

export default LaunchDarklyClient;
