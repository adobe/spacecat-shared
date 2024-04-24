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

import crypto from 'crypto';
import { google } from 'googleapis';
import { ok, badRequest, internalServerError } from '@adobe/spacecat-shared-http-utils';
import { OAuth2Client } from 'google-auth-library';

export default class GoogleClient {
  static createFrom(context, siteId) {
    const { dataAccess } = context;
    const {
      GOOGLE_ENCRYPTION_KEY,
      GOOGLE_ENCRYPTION_IV,
    } = context.env;

    return new GoogleClient({
      siteId,
      dataAccess,
      GOOGLE_ENCRYPTION_KEY,
      GOOGLE_ENCRYPTION_IV,
    }, context.log);
  }

  constructor(config, log = console) {
    this.siteId = config.siteId;
    this.dataAccess = config.dataAccess;
    this.GOOGLE_ENCRYPTION_KEY = config.GOOGLE_ENCRYPTION_KEY;
    this.GOOGLE_ENCRYPTION_IV = config.GOOGLE_ENCRYPTION_IV;
    this.log = log;
  }

  decryptSecret(encrypted) {
    const key = Buffer.from(this.GOOGLE_ENCRYPTION_KEY, 'base64');
    const iv = Buffer.from(this.GOOGLE_ENCRYPTION_IV, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptSecret(secret) {
    const key = Buffer.from(this.GOOGLE_ENCRYPTION_KEY, 'base64');
    const iv = Buffer.from(this.GOOGLE_ENCRYPTION_IV, 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  async generateAuthClient() {
    const site = await this.dataAccess.getSiteByID(this.siteId);
    const config = site.getConfig();
    return new OAuth2Client(
      config.auth.google.client_id,
      this.decryptSecret(config.auth.google.client_secret),
      config.auth.google.redirect_uri,
    );
  }

  /**
   *
   * @param startDate
   * @param endDate
   * @returns {Promise<Response>}
   */
  async getOrganicSearchData(startDate, endDate) {
    const authClient = await this.generateAuthClient(this.siteId);
    const site = await this.dataAccess.getSiteByID(this.siteId);
    const config = site.getConfig();

    if (!config.auth.google.access_token || !config.auth.google.refresh_token) {
      return badRequest('Google token or refresh token not found');
    }

    const token = this.decryptSecret(config.auth.google.access_token);
    const refreshToken = this.decryptSecret(config.auth.google.refresh_token);
    const { expiration } = config.auth.google;

    authClient.setCredentials({
      access_token: token,
      refresh_token: refreshToken,
    });

    if (expiration < Date.now()) {
      const { tokens } = await authClient.refreshAccessToken();
      site.updateConfig({
        auth: {
          google: {
            ...config.auth.google,
            access_token: this.encryptSecret(tokens.access_token),
            expiration: tokens.expiry_date,
          },
        },
      });
      await this.dataAccess.updateSite(site);
      authClient.setCredentials({
        access_token: tokens.access_token,
      });
    }

    const webmasters = google.webmasters({
      version: 'v3',
      auth: authClient,
    });
    const siteUrl = site.getBaseURL();
    try {
      const result = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          rowLimit: 10,
        },
      });
      return ok(result.data);
    } catch (error) {
      this.log.error('Error:', error.message);
      return internalServerError(error.message);
    }
  }
}
