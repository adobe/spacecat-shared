/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import {
  isValidIMSOrgId, hasText, isValidUrl, tracingFetch as fetch,
} from '@adobe/spacecat-shared-utils';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

const CHECKS_PAGE_SIZE = 100;

const API_GET_BRAND_FROM_URL = (url) => `/api/v1/brands/from-url?url=${encodeURIComponent(url)}`;
const API_GET_BRAND_CHECKS = (brandId, page) => `/api/v1/brands/${brandId}/checks?status=ACTIVE&type=BRAND&scope=COPY&pageSize=${CHECKS_PAGE_SIZE}&page=${page}`;

/**
 * Client for the Adobe Brand Governance Agent API.
 * Resolves brand guidelines by site URL using COPY-scoped checks.
 * Returns null when the brand is not registered — caller falls back to Brand Publish.
 */
export class BrandGovernanceClient {
  static createFrom(context) {
    if (context.brandGovernanceClient) {
      return context.brandGovernanceClient;
    }

    const { env, log = console } = context;
    const {
      BRAND_GOV_API_BASE_URL: apiBaseUrl,
      BRAND_GOV_API_KEY: apiKey,
    } = env;

    const client = new BrandGovernanceClient({ apiBaseUrl, apiKey }, log);
    context.brandGovernanceClient = client;
    return client;
  }

  constructor({ apiBaseUrl, apiKey }, log) {
    this.log = log;
    if (!isValidUrl(apiBaseUrl)) {
      throw this.#createError(`Invalid Brand Governance API Base URL: ${apiBaseUrl}`, HTTP_BAD_REQUEST);
    }
    if (!hasText(apiKey)) {
      throw this.#createError(`Invalid Brand Governance API Key: ${apiKey}`, HTTP_BAD_REQUEST);
    }
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
  }

  #createError(message, status) {
    const error = Object.assign(new Error(message), { status });
    this.log.error(error.message);
    return error;
  }

  async #getImsAccessToken(imsConfig) {
    const {
      host, clientId, clientCode, clientSecret,
    } = imsConfig;
    const imsContext = {
      env: {
        IMS_HOST: host,
        IMS_CLIENT_ID: clientId,
        IMS_CLIENT_CODE: clientCode,
        IMS_CLIENT_SECRET: clientSecret,
      },
      log: this.log,
    };
    const imsClient = ImsClient.createFrom(imsContext);
    const response = await imsClient.getServiceAccessToken();
    const token = response?.access_token;
    if (!hasText(token)) {
      throw this.#createError('Failed to obtain IMS access token', HTTP_BAD_REQUEST);
    }
    return token;
  }

  /**
   * Fetches brand guidelines for a site URL from the Brand Governance Agent.
   * Returns null if the brand is not registered (404), allowing callers to fall back.
   *
   * @param {string} siteBaseUrl - The site's base URL to resolve brand by domain
   * @param {string} imsOrgId - The IMS org ID sent as x-gw-ims-org-id header
   * @param {object} imsConfig - IMS auth config: { host, clientId, clientCode, clientSecret }
   * @returns {Promise<object|null>} Brand guidelines or null if not registered
   */
  async getBrandGuidelinesForUrl(siteBaseUrl, imsOrgId, imsConfig) {
    if (!isValidUrl(siteBaseUrl)) {
      throw this.#createError(`Invalid site base URL: ${siteBaseUrl}`, HTTP_BAD_REQUEST);
    }
    if (!isValidIMSOrgId(imsOrgId)) {
      throw this.#createError(`Invalid IMS Org ID: ${imsOrgId}`, HTTP_BAD_REQUEST);
    }
    const missingFields = ['host', 'clientId', 'clientCode', 'clientSecret']
      .filter((k) => !hasText(imsConfig[k]));
    if (missingFields.length > 0) {
      throw this.#createError(`Invalid IMS Config: missing fields [${missingFields.join(', ')}]`, HTTP_BAD_REQUEST);
    }

    const imsAccessToken = await this.#getImsAccessToken(imsConfig);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${imsAccessToken}`,
      'x-api-key': this.apiKey,
      'x-gw-ims-org-id': imsOrgId,
    };

    const brandResponse = await fetch(
      `${this.apiBaseUrl}${API_GET_BRAND_FROM_URL(siteBaseUrl)}`,
      { headers },
    );
    if (brandResponse.status === HTTP_NOT_FOUND) {
      return null;
    }
    if (!brandResponse.ok) {
      throw this.#createError(
        `Error resolving brand for URL ${siteBaseUrl}: ${brandResponse.status}`,
        brandResponse.status,
      );
    }
    const brand = await brandResponse.json();

    const allChecks = [];
    let page = 1;
    do {
      // eslint-disable-next-line no-await-in-loop
      const checksResponse = await fetch(
        `${this.apiBaseUrl}${API_GET_BRAND_CHECKS(brand.id, page)}`,
        { headers },
      );
      if (!checksResponse.ok) {
        throw this.#createError(
          `Error fetching brand checks for brand ${brand.id}: ${checksResponse.status}`,
          checksResponse.status,
        );
      }
      // eslint-disable-next-line no-await-in-loop
      const { data = [] } = await checksResponse.json();
      allChecks.push(...data);
      if (data.length < CHECKS_PAGE_SIZE) {
        break;
      }
      page += 1;
    // eslint-disable-next-line no-constant-condition
    } while (true);

    const guidelines = allChecks.map((check) => ({ name: check.name, text: check.rule }));

    return {
      id: brand.id,
      name: brand.name,
      imsOrgId,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
      guidelines,
    };
  }
}
