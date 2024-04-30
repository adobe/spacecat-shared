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

export default class GoogleClient {
  static createFrom(context) {
    return new GoogleClient(context.env, context.log);
  }

  constructor(config, log = console) {
    this.GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;
    this.GOOGLE_CLIENT_SECRET = config.GOOGLE_CLIENT_SECRET;
    this.GOOGLE_REDIRECT_URI = config.GOOGLE_REDIRECT_URI;
    this.ACCESS_TOKEN = config.ACCESS_TOKEN;
    this.REFRESH_TOKEN = config.REFRESH_TOKEN;
    this.EXPIRATION = config.EXPIRATION;
    this.log = log;
  }

  /**
   *
   * @param baseURL
   * @param startDate
   * @param endDate
   * @returns {Promise<Response>}
   */
  async getOrganicSearchData(baseURL, startDate, endDate) {
    const authClient = new OAuth2Client(
      this.GOOGLE_CLIENT_ID,
      this.GOOGLE_CLIENT_SECRET,
      this.GOOGLE_REDIRECT_URI,
    );

    authClient.setCredentials({
      access_token: this.ACCESS_TOKEN,
      refresh_token: this.REFRESH_TOKEN,
    });

    if (this.EXPIRATION < Date.now()) {
      const { tokens } = await authClient.refreshAccessToken();
      authClient.setCredentials({
        access_token: tokens.access_token,
      });
    }

    const webmasters = google.webmasters({
      version: 'v3',
      auth: authClient,
    });
    try {
      const result = await webmasters.searchanalytics.query({
        siteUrl: baseURL,
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
