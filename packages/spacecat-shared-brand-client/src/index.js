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
import {
  isValidIMSOrgId, hasText, isValidUrl, tracingFetch as fetch,
} from '@adobe/spacecat-shared-utils';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';

const PUBLISHED_BRANDS_FILTER = 'roles=BRAND&itemFilter=publishedBrands';
const API_GET_BRANDS = `/api/v1/libraries?${PUBLISHED_BRANDS_FILTER}`;
const API_GET_BRAND_GUIDELINES = (brandId) => `/api/v1/libraries/${brandId}?selector=details`;

export default class BrandClient {
  static createFrom(context) {
    const { env, log = console } = context;
    const { BRAND_API_BASE_URL: apiBaseUrl, BRAND_API_KEY: apiKey } = env;
    log.info(`Creating BrandClient with apiBaseUrl: ${apiBaseUrl} and apiKey: ${apiKey}`);

    if (context.brandClient) return context.brandClient;

    const client = new BrandClient({ apiBaseUrl, apiKey }, log);
    context.brandClient = client;
    return client;
  }

  constructor({ apiBaseUrl, apiKey }, log) {
    if (!isValidUrl(apiBaseUrl)) {
      throw new Error(`Invalid Brand API Base URL: ${apiBaseUrl}`);
    }
    if (!hasText(apiKey)) {
      throw new Error(`Invalid Brand API Key: ${apiKey}`);
    }
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
    this.log = log;
    this.serviceAccessToken = null;
  }

  // eslint-disable-next-line class-methods-use-this
  #mapToBrand(library) {
    let createdAt = '';
    let updatedAt = '';
    try {
      createdAt = new Date(library.created_date)?.toISOString();
    } catch (e) {
      this.log.error(`Error converting createdAt for brand ${library.library_urn}: ${e.message}`);
    }
    try {
      updatedAt = new Date(library.modified_date)?.toISOString();
    } catch (e) {
      this.log.error(`Error converting updatedAt for brand ${library.library_urn}: ${e.message}`);
    }
    return {
      id: library.library_urn,
      name: library.name,
      imsOrgId: library.org_id,
      createdAt,
      updatedAt,
    };
  }

  async getBrandsForOrganization(imsOrgId, imsAccessToken) {
    if (!isValidIMSOrgId(imsOrgId)) {
      throw new Error(`Invalid IMS Org ID: ${imsOrgId}`);
    }

    if (!hasText(imsAccessToken)) {
      throw new Error(`Invalid IMS Access Token: ${imsAccessToken}`);
    }
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `${imsAccessToken}`,
      'x-api-key': this.apiKey,
    };
    const response = await fetch(`${this.apiBaseUrl}${API_GET_BRANDS}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Error getting brands for organization ${imsOrgId}: ${response.statusText}`);
    }
    try {
      const result = await response.json();
      return result.libraries?.filter(
        (library) => library.org_id === imsOrgId,
      )?.map(this.#mapToBrand);
    } catch (e) {
      this.log.error(`Error getting brands for organization ${imsOrgId} with imsAccessToken. ${e.message}`);
      throw new Error(`Error getting brands for organization ${imsOrgId} with imsAccessToken. ${e.message}`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async #getImsAccessToken(imsConfig) {
    if (this.serviceAccessToken) {
      return this.serviceAccessToken;
    }
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
    this.serviceAccessToken = response?.access_token;
    return this.serviceAccessToken;
  }

  async getBrandGuidelines(brandId, imsOrgId, imsConfig = {}) {
    if (!hasText(brandId)) {
      throw new Error(`Invalid brand ID: ${brandId}`);
    }
    if (!isValidIMSOrgId(imsOrgId)) {
      throw new Error(`Invalid IMS Org ID: ${imsOrgId}`);
    }
    const {
      host, clientId, clientCode, clientSecret,
    } = imsConfig;
    if (!hasText(host) || !hasText(clientId) || !hasText(clientCode) || !hasText(clientSecret)) {
      throw new Error(`Invalid IMS Config: ${JSON.stringify(imsConfig)}`);
    }
    const imsAccessToken = await this.#getImsAccessToken(imsConfig);
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${imsAccessToken}`,
      'x-api-key': this.apiKey,
    };
    const response = await fetch(`${this.apiBaseUrl}${API_GET_BRAND_GUIDELINES(brandId)}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`Error getting brand guidelines for brand ${brandId}: ${response.status}`);
    }
    try {
      const result = await response.json();
      if (result.org_id !== imsOrgId) {
        throw new Error(`Brand ${brandId} not found for org ${imsOrgId}`);
      }
      const brandGuidelines = this.#mapToBrand(result);
      const guidelines = result.details?.['brand#copyGuidelines'];
      if (guidelines) {
        brandGuidelines.toneOfVoice = guidelines.toneOfVoice;
        brandGuidelines.coreValues = guidelines.coreValues;
        brandGuidelines.guidelines = guidelines.guidelines;
        brandGuidelines.restrictions = guidelines.restrictions;
        brandGuidelines.additionalGuidelines = guidelines.additionalGuidelines;
      }
      return brandGuidelines;
    } catch (e) {
      this.log.error(`Error getting brand guidelines for brand ${brandId}: ${e.message}`);
      throw new Error(`Error getting brand guidelines for brand ${brandId}: ${e.message}`);
    }
  }
}
