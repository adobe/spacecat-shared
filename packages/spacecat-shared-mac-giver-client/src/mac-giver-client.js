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
   * Returns the subset of the requested permissions where `allowed === true`.
   *
   * Two outcomes are reported distinctly:
   *
   * - **Evaluated, no permissions granted** — MacGiver returned 2xx with
   *   `status: 'SUCCESS'` and no `allowed: true` entries (or `status` !==
   *   'SUCCESS'). Returns `[]`. The caller treats this as "user has no
   *   FACS roles for the requested permission set".
   * - **Could not evaluate** — MacGiver returned a non-2xx status, or the
   *   request failed at the transport layer. The method **throws** so the
   *   outer try/catch in login.js fires and omits the `facs_permissions`
   *   claim from the JWT (fail-safe at login). The caller never sees an
   *   empty array confused with an outage.
   *
   * Logging at the non-2xx path is tagged so operations alerting can
   * surface MacGiver health regressions independently of the login flow.
   *
   * `userToken` is optional per the MacGiver API.
   */
  async getPermissions({
    userId, imsOrgId, permissions, userToken,
  }) {
    const serviceToken = await this.imsClient.getServiceAccessToken();

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

    if (!res.ok) {
      // Distinguish "could not evaluate" from "evaluated, none". Login wraps
      // this call in a try/catch that logs and omits facs_permissions, so a
      // throw here is the right shape: the user still logs in, but without
      // FACS perms, and ops gets a tagged signal that MacGiver is degraded.
      this.log.warn(
        {
          tag: 'macgiver', status: res.status, userId, imsOrgId,
        },
        'MacGiver permission lookup returned non-2xx',
      );
      throw new Error(`MacGiver returned ${res.status}`);
    }

    const json = await res.json();
    if (json.status !== 'SUCCESS' || !json.results) {
      return [];
    }

    return Object.entries(json.results)
      .filter(([, v]) => v?.allowed === true)
      .map(([permission]) => permission);
  }

  /**
   * Checks a single FACS permission for a (user, org) pair.
   *
   * Boolean convenience wrapper around getPermissions. Returns true when
   * MacGiver reports the permission as allowed, false otherwise — including
   * the cases where getPermissions throws because MacGiver could not be
   * evaluated. Callers that need to distinguish "denied" from "could not
   * evaluate" must use getPermissions directly and handle the throw.
   */
  async checkPermission({
    userId, imsOrgId, permission, userToken,
  }) {
    try {
      const permitted = await this.getPermissions({
        userId, imsOrgId, permissions: [permission], userToken,
      });
      return permitted.includes(permission);
    } catch {
      // getPermissions already logged the underlying cause with a
      // `tag: 'macgiver'` warning; collapsing to false here preserves the
      // boolean fail-closed contract for callers that don't care about
      // the distinction.
      return false;
    }
  }
}
