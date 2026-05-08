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

const DEFAULT_BASE_URL = 'http://localhost:8080';
const CHECK_PATH = '/api/facs/permissions/check';

export default class MacGiverClient {
  static createFrom(context) {
    const { log = console } = context;
    const macGiverBaseUrl = context.env?.MACGIVER_BASE_URL || DEFAULT_BASE_URL;
    return new MacGiverClient({ macGiverBaseUrl, imsClient: context.imsClient, log });
  }

  constructor({ macGiverBaseUrl, imsClient, log }) {
    this.macGiverBaseUrl = macGiverBaseUrl;
    this.imsClient = imsClient;
    this.log = log;
  }

  /**
   * Checks a list of FACS permissions for a (user, org) pair in one round-trip.
   * Returns the subset of the requested permissions where allowed === true.
   * Fails closed: returns [] on any non-SUCCESS response.
   * userToken is optional per the MacGiver API.
   */
  async getPermissions({
    userId, imsOrgId, permissions, userToken,
  }) {
    const serviceToken = await this.imsClient.getServiceToken();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceToken}`,
    };
    if (userToken) {
      headers['X-User-Token'] = userToken;
    }

    const res = await fetch(`${this.macGiverBaseUrl}${CHECK_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject: { type: 'user', id: userId, relation: null },
        permissions,
        object: { type: 'organization', id: imsOrgId },
        namespaces: [],
      }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    if (json.status !== 'SUCCESS' || !json.results) return [];

    return Object.entries(json.results)
      .filter(([, v]) => v?.allowed === true)
      .map(([permission]) => permission);
  }

  /**
   * Checks a single FACS permission for a (user, org) pair.
   * Returns true if the permission is allowed, false otherwise (fail-closed).
   */
  async checkPermission({
    userId, imsOrgId, permission, userToken,
  }) {
    const permitted = await this.getPermissions({
      userId, imsOrgId, permissions: [permission], userToken,
    });
    return permitted.includes(permission);
  }
}
