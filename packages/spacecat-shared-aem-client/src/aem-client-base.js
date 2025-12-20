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

import { tracingFetch } from '@adobe/spacecat-shared-utils';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';
import { AemConfigurationError, AemRequestError } from './errors/index.js';

/**
 * Base client providing authentication and HTTP request capabilities for AEM APIs.
 *
 * Handles IMS token management and authenticated requests. Intended to be used
 * by the {@link AemClientBuilder} class.
 */
export class AemBaseClient {
  /**
   * Creates a new AemBaseClient instance.
   * @param {string} baseUrl - The AEM author instance URL.
   * @param {object} imsClient - An IMS client instance for authentication.
   * @param {object} [log=console] - Logger instance.
   * @throws {AemConfigurationError} If baseUrl or imsClient is missing.
   */
  constructor(baseUrl, imsClient, log = console) {
    if (!baseUrl) {
      throw new AemConfigurationError('base URL is required', 'baseUrl');
    }

    if (!imsClient) {
      throw new AemConfigurationError('IMS client is required', 'imsClient');
    }

    this.baseUrl = baseUrl;
    this.imsClient = imsClient;
    this.log = log;

    this.accessToken = null;
    this.tokenObtainedAt = null;
  }

  /**
   * Factory method to create an AemBaseClient from a context object.
   * @param {object} context - The execution context.
   * @param {object} context.site - Site object with getDeliveryConfig() method.
   * @param {object} context.env - Environment variables containing IMS configuration.
   * @param {string} context.env.IMS_HOST - IMS host URL.
   * @param {string} context.env.IMS_CLIENT_ID - IMS client ID.
   * @param {string} context.env.IMS_CLIENT_CODE - IMS client code.
   * @param {string} context.env.IMS_CLIENT_SECRET - IMS client secret.
   * @param {string} [context.env.IMS_SCOPE] - IMS scope.
   * @param {object} [context.log=console] - Logger instance.
   * @returns {AemBaseClient} A configured AemBaseClient instance.
   * @throws {AemConfigurationError} If the author URL is not configured.
   */
  static createFrom(context) {
    const { site, env, log } = context;

    const authorUrl = site.getDeliveryConfig().authorURL;
    if (!authorUrl) {
      throw new AemConfigurationError('author URL required', 'authorURL');
    }

    const imsClient = ImsClient.createFrom({
      log,
      env: {
        IMS_HOST: env.IMS_HOST,
        IMS_CLIENT_ID: env.IMS_CLIENT_ID,
        IMS_CLIENT_CODE: env.IMS_CLIENT_CODE,
        IMS_CLIENT_SECRET: env.IMS_CLIENT_SECRET,
        IMS_SCOPE: env.IMS_SCOPE,
      },
    });

    return new AemBaseClient(authorUrl, imsClient, log);
  }

  /**
   * Gets a valid service access token, fetching a new one if expired or missing.
   * @returns {Promise<string>} The access token string.
   */
  async getAccessToken() {
    if (this.isTokenExpired()) {
      this.accessToken = await this.imsClient.getServiceAccessToken();
      this.tokenObtainedAt = Date.now();
    }
    return this.accessToken.access_token;
  }

  /**
   * Checks if the current access token is expired.
   * @returns {boolean} True if the access token is expired, false otherwise.
   */
  isTokenExpired() {
    if (!this.accessToken || !this.tokenObtainedAt) {
      this.invalidateAccessToken();
      return true;
    }

    const expiresAt = this.tokenObtainedAt + (this.accessToken.expires_in * 1000);
    const isExpired = Date.now() >= expiresAt;
    if (isExpired) {
      this.invalidateAccessToken();
    }

    return isExpired;
  }

  /**
   * Invalidates the current access token, forcing a refresh on next request.
   */
  invalidateAccessToken() {
    this.accessToken = null;
    this.tokenObtainedAt = null;
  }

  /**
   * Makes an authenticated HTTP request to the AEM API.
   * @param {string} method - HTTP method (GET, POST, PATCH, PUT, DELETE).
   * @param {string} path - API path (appended to baseUrl).
   * @param {object|null} [body=null] - Request body (will be JSON-stringified).
   * @param {object} [additionalHeaders={'Content-Type': 'application/json'}] - Additional headers.
   * @returns {Promise<object|null>} Response data or null for non-JSON responses.
   * @throws {AemRequestError} If the request fails.
   */
  async request(method, path, body = null, additionalHeaders = { 'Content-Type': 'application/json' }) {
    const url = `${this.baseUrl}${path}`;
    const accessToken = await this.getAccessToken();

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      ...additionalHeaders,
    };

    const options = {
      method,
      headers,
    };

    if (body !== null && body !== undefined) {
      options.body = JSON.stringify(body);
    }

    this.log.info(`[AEM Client] ${method} ${url}`);

    const response = await tracingFetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      this.log.error(`[AEM Client] Request failed with status ${response.status}: ${errorText}`);
      throw AemRequestError.fromStatusCode(response.status, errorText, { resource: path, method });
    }

    // Handle non-empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();

      // Capture ETag from response headers for optimistic locking
      const etag = response.headers.get('ETag');
      if (etag && typeof data === 'object' && data !== null) {
        data.etag = etag;
      }

      return data;
    }

    return null;
  }
}
