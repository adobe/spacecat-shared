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
import BaseCdnClient from './base-cdn-client.js';

/**
 * Akamai CDN client implementation
 * Handles cache invalidation (purge) for Akamai CDN
 */
export default class AkamaiCdnClient extends BaseCdnClient {
  constructor(config, log) {
    super(config, log);
    this.baseUrl = config.baseUrl || 'https://akaa-baseurl-xxx-xxx.luna.akamaiapis.net';
  }

  // eslint-disable-next-line class-methods-use-this
  getProviderName() {
    return 'akamai';
  }

  validateConfig() {
    const required = ['client_token', 'client_secret', 'access_token', 'host'];
    const missing = required.filter((key) => !this.config[key]);

    if (missing.length > 0) {
      this.log.error(`Akamai CDN config missing required fields: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Generates Akamai EdgeGrid authentication header
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {string} body - Request body
   * @returns {string} Authorization header value
   */
  generateAuthHeader(method, path, body = '') {
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, '+0000');
    const nonce = crypto.randomBytes(16).toString('hex');

    const authData = [
      `client_token=${this.config.clientToken}`,
      `access_token=${this.config.accessToken}`,
      `timestamp=${timestamp}`,
      `nonce=${nonce}`,
    ].join(';');

    const bodyHash = body
      ? crypto.createHash('sha256').update(body).digest('base64')
      : '';

    const dataToSign = [
      method.toUpperCase(),
      'https',
      this.baseUrl.replace(/^https?:\/\//, ''),
      path,
      '',
      bodyHash,
      authData,
    ].join('\t');

    const signingKey = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(timestamp)
      .digest();

    const signature = crypto
      .createHmac('sha256', signingKey)
      .update(dataToSign)
      .digest('base64');

    return `EG1-HMAC-SHA256 ${authData};signature=${signature}`;
  }

  /**
   * Invalidates Akamai CDN cache for given paths
   * @param {Array<string>} paths - Array of URL paths to invalidate
   * @returns {Promise<Object>} Result of the purge request
   */
  async invalidateCache(paths) {
    if (!this.validateConfig()) {
      throw new Error('Invalid Akamai CDN configuration');
    }

    if (!Array.isArray(paths) || paths.length === 0) {
      this.log.warn('No paths provided for cache invalidation');
      return { status: 'skipped', message: 'No paths to invalidate' };
    }

    const endpoint = '/ccu/v3/invalidate/url';
    const body = JSON.stringify({
      objects: paths,
    });

    try {
      const authHeader = this.generateAuthHeader('POST', endpoint, body);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Akamai purge failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      this.log.info(`Akamai cache invalidation initiated: ${result.purgeId || result.estimatedSeconds || 'success'}`);

      return {
        status: 'success',
        provider: 'akamai',
        purgeId: result.purgeId,
        estimatedSeconds: result.estimatedSeconds,
        paths: paths.length,
      };
    } catch (error) {
      this.log.error(`Failed to invalidate Akamai cache: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Checks the status of an Akamai purge request
   * @param {string} purgeId - The purge request ID
   * @returns {Promise<Object>} Status of the purge request
   */
  async getInvalidationStatus(purgeId) {
    if (!this.validateConfig()) {
      throw new Error('Invalid Akamai CDN configuration');
    }

    const endpoint = `/ccu/v3/purges/${purgeId}`;

    try {
      const authHeader = this.generateAuthHeader('GET', endpoint);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get purge status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        status: result.purgeStatus || 'unknown',
        provider: 'akamai',
        purgeId,
        ...result,
      };
    } catch (error) {
      this.log.error(`Failed to get Akamai purge status: ${error.message}`, error);
      throw error;
    }
  }
}
