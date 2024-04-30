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
  static async createFrom(context) {
    const authClient = new OAuth2Client(
      context.env.GOOGLE_CLIENT_ID,
      context.env.GOOGLE_CLIENT_SECRET,
      context.env.GOOGLE_REDIRECT_URI,
    );

    authClient.setCredentials({
      access_token: context.env.ACCESS_TOKEN,
      refresh_token: context.env.REFRESH_TOKEN,
    });

    if (context.env.EXPIRATION < Date.now()) {
      const { tokens } = await authClient.refreshAccessToken();
      authClient.setCredentials({
        access_token: tokens.access_token,
      });
    }
    return new GoogleClient(authClient, context.log);
  }

  constructor(authClient, log = console) {
    this.authClient = authClient;
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
    const webmasters = google.webmasters({
      version: 'v3',
      auth: this.authClient,
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
