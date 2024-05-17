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
import { ok, internalServerError } from '@adobe/spacecat-shared-http-utils';
import { OAuth2Client } from 'google-auth-library';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { resolveCustomerSecretsName } from '@adobe/spacecat-shared-utils';

export default class GoogleClient {
  static async createFrom(context, baseURL) {
    try {
      const customerSecret = resolveCustomerSecretsName(baseURL, context);
      const client = new SecretsManagerClient({});
      const command = new GetSecretValueCommand({
        SecretId: customerSecret,
      });
      const response = await client.send(command);
      const secrets = JSON.parse(response.SecretString);
      const config = {
        accessToken: secrets.access_token,
        refreshToken: secrets.refresh_token,
        tokenType: secrets.token_type,
        expiryDate: secrets.expiry_date,
        siteUrl: secrets.site_url,
        clientId: context.env.GOOGLE_CLIENT_ID,
        clientSecret: context.env.GOOGLE_CLIENT_SECRET,
        redirectUri: context.env.GOOGLE_REDIRECT_URI,
      };
      return new GoogleClient(config, context.log);
    } catch (error) {
      throw new Error(`Error creating GoogleClient: ${error.message}`);
    }
  }

  constructor(config, log = console) {
    const authClient = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri,
    );

    if (!config.accessToken) {
      throw new Error('Missing access token in secret');
    }

    if (!config.refreshToken) {
      throw new Error('Missing refresh token in secret');
    }

    authClient.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      token_type: config.tokenType,
    });
    this.authClient = authClient;
    this.expiryDate = config.expiryDate;
    this.siteUrl = config.siteUrl;
    this.log = log;
  }

  async getOrganicSearchData(startDate, endDate, dimensions = ['date'], rowLimit = 10, startRow = 0) {
    if (new Date(this.expiryDate).getTime() < Date.now()) {
      const { tokens } = await this.authClient.refreshAccessToken();
      this.authClient.setCredentials({
        access_token: tokens.access_token,
      });
    }
    const webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
    });
    try {
      const result = await webmasters.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions,
          startRow,
          rowLimit,
        },
      });
      return ok(result);
    } catch (error) {
      this.log.error('Error retrieving organic search data:', error.message);
      return internalServerError(error.message);
    }
  }

  async listSites() {
    const webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
    });
    try {
      const result = await webmasters.sites.list();
      return ok(result);
    } catch (error) {
      this.log.error('Error retrieving sites:', error.message);
      return internalServerError(error.message);
    }
  }
}
