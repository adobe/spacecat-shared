/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  composeAuditURL,
  instrumentAWSClient,
  isArray,
  isInteger,
  isValidDate,
  isValidUrl,
  resolveCustomerSecretsName,
} from '@adobe/spacecat-shared-utils';
import { fetch as httpFetch } from './utils.js';

export default class GoogleClient {
  constructor(config, log = console) {
    this.log = log;
    this.authClient = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );
    this.apiKey = config.apiKey;

    this.authClient.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      token_type: config.tokenType,
      expiry_date: config.expiryDate,
    });

    this.expiryDate = config.expiryDate;
    this.siteUrl = config.siteUrl;
    this.baseUrl = config.baseUrl;
  }

  async #refreshTokenIfExpired() {
    if (this.authClient.credentials.expiry_date < Date.now()) {
      try {
        const { credentials } = await this.authClient.refreshAccessToken();
        this.authClient.setCredentials({
          access_token: credentials.access_token,
          expiry_date: credentials.expiry_date,
        });
      } catch (error) {
        this.log.error('Failed to refresh token:', error);
        throw error;
      }
    }
  }

  static async createFrom(context, baseURL) {
    if (!isValidUrl(baseURL)) {
      throw new Error('Error creating GoogleClient: Invalid base URL');
    }

    const customerSecret = resolveCustomerSecretsName(baseURL, context);
    const client = instrumentAWSClient(new SecretsManagerClient({}));

    try {
      const command = new GetSecretValueCommand({ SecretId: customerSecret });
      const response = await client.send(command);
      const secrets = JSON.parse(response.SecretString);

      const config = {
        accessToken: secrets.access_token,
        refreshToken: secrets.refresh_token,
        tokenType: secrets.token_type,
        expiryDate: secrets.expiry_date,
        siteUrl: secrets.site_url,
        baseUrl: baseURL,
        clientId: context.env.GOOGLE_CLIENT_ID,
        clientSecret: context.env.GOOGLE_CLIENT_SECRET,
        redirectUri: context.env.GOOGLE_REDIRECT_URI,
      };

      const googleClient = new GoogleClient(config, context.log);
      await googleClient.#refreshTokenIfExpired();

      return googleClient;
    } catch (error) {
      throw new Error(`Error creating GoogleClient: ${error.message}`);
    }
  }

  async getOrganicSearchData(startDate, endDate, dimensions = ['date'], rowLimit = 1000, startRow = 0) {
    if (!isValidUrl(this.siteUrl) && !this.siteUrl?.startsWith('sc-domain')) {
      throw new Error(`Error retrieving organic search data from Google API: Invalid site URL in secret (${this.siteUrl})`);
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Error retrieving organic search data from Google API: Invalid date format');
    }
    if (!isArray(dimensions)) {
      throw new Error('Error retrieving organic search data from Google API: Invalid dimensions format');
    }
    if (!isInteger(rowLimit) || !isInteger(startRow)) {
      throw new Error('Error retrieving organic search data from Google API: Invalid row limit or start row format');
    }
    if (rowLimit > 1000 || rowLimit < 1) {
      throw new Error('Error retrieving organic search data from Google API: Row limit must be between 1 and 1000');
    }
    if (startRow < 0) {
      throw new Error('Error retrieving organic search data from Google API: Start row must be greater than or equal to 0');
    }

    await this.#refreshTokenIfExpired();

    const auditUrl = await composeAuditURL(this.baseUrl);

    const webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
    });
    try {
      const params = {
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: startDate.toISOString()
            .split('T')[0],
          endDate: endDate.toISOString()
            .split('T')[0],
          dimensions,
          startRow,
          rowLimit,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'contains',
                  expression: auditUrl,
                },
              ],
            },
          ],
        },
      };
      this.log.info(`Retrieving organic search data: ${JSON.stringify(params)}`);
      return await webmasters.searchanalytics.query(params);
    } catch (error) {
      this.log.error('Error retrieving organic search data:', error.message);
      throw new Error(`Error retrieving organic search data from Google API: ${error.message}`);
    }
  }

  async urlInspect(url) {
    if (!isValidUrl(url)) {
      throw new Error(`Error inspecting URL: Invalid URL format (${url})`);
    }

    await this.#refreshTokenIfExpired();

    const apiEndpoint = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

    const response = await httpFetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authClient.credentials.access_token}`,
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: this.siteUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error inspecting URL ${url}. Returned status ${response.status}`);
    }

    try {
      return await response.json();
    } catch (e) {
      throw new Error(`Error parsing result of inspecting URL ${url}: ${e.message}`);
    }
  }

  async listSites() {
    await this.#refreshTokenIfExpired();

    const webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
    });
    try {
      return await webmasters.sites.list();
    } catch (error) {
      this.log.error('Error retrieving sites:', error.message);
      throw new Error(`Error retrieving sites from Google API: ${error.message}`);
    }
  }

  async getChromeUXReport(url, formFactor = 'PHONE') {
    const chromeuxreport = google.chromeuxreport({
      version: 'v1',
      auth: this.apiKey,
    });

    try {
      const response = await chromeuxreport.records.queryRecord({
        requestBody: {
          url,
          formFactor,
        },
      });
      return response;
    } catch (error) {
      this.log.error('Error retrieving Chrome UX report:', error.message);
      throw new Error(`Error retrieving Chrome UX report from Google API: ${error.message}`);
    }
  }

  async getPageSpeedInsights(url, strategy = 'mobile', category = 'performance') {
    const pagespeedonline = google.pagespeedonline({
      version: 'v5',
      auth: this.apiKey,
    });

    try {
      const response = await pagespeedonline.pagespeedapi.runpagespeed({
        url,
        category,
        strategy,
      }, { retry: false });

      return response;
    } catch (error) {
      this.log.error('Error retrieving Page Speed Insights:', error.message);
      throw new Error(`Error retrieving Page Speed Insights from Google API: ${error.message}`);
    }
  }
}
