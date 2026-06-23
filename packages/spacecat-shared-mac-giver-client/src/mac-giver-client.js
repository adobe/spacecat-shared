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
    log.info(`macGiverBaseUrl used in mac-giver client: ${macGiverBaseUrl}`);
    this.macGiverBaseUrl = macGiverBaseUrl;
    this.imsClient = imsClient;
    this.log = log;
  }

  /**
   * Calls the MacGiver `/api/facs/permissions/check` endpoint for a single
   * (user, org) pair and returns the subset of evaluated permissions where
   * `allowed === true`.
   *
   * `permissions` and `namespaces` map directly onto the request body:
   * - `permissions` — evaluate this explicit list of (possibly namespaced)
   *   permissions.
   * - `namespaces` — evaluate every permission defined in these namespaces.
   * At least one must be non-empty (MacGiver rejects a request where both are
   * empty); the public methods below each supply exactly one.
   *
   * The `X-User-Token` header is intentionally omitted — FACS uses it only for
   * logging, never for the evaluation itself, so the service token alone is
   * sufficient for SpaceCat's use.
   *
   * Two outcomes are reported distinctly:
   * - **Evaluated, none granted** — 2xx with `status: 'SUCCESS'` and no
   *   `allowed: true` entries (or a non-SUCCESS status). Returns `[]`.
   * - **Could not evaluate** — non-2xx, or a transport-layer failure. **Throws**
   *   so callers (e.g. login.js) can fail-safe and omit the `facs_permissions`
   *   claim rather than confusing an outage with "no permissions". The non-2xx
   *   path is logged with a `tag: 'macgiver'` warning for independent alerting.
   *
   * @param {object} args
   * @param {string} args.userId    - IMS user id (subject).
   * @param {string} args.imsOrgId  - IMS org id (object).
   * @param {string[]} [args.permissions] - Explicit permissions to evaluate.
   * @param {string[]} [args.namespaces]  - Namespaces whose permissions to evaluate.
   * @returns {Promise<string[]>} Allowed permission names.
   */
  async #check({
    userId, imsOrgId, permissions = [], namespaces = [],
  }) {
    const url = `${this.macGiverBaseUrl}${CHECK_PATH}`;
    const requestBody = {
      subject: { type: 'user', id: userId, relation: null },
      permissions,
      object: { type: 'organization', id: imsOrgId },
      namespaces,
    };
    // DEBUG (temporary): trace the outbound request. Never logs the service
    // token. Drop these info logs once MacGiver wiring is verified.
    this.log.info({
      tag: 'macgiver',
      url,
      method: 'POST',
      userId,
      imsOrgId,
      permissions,
      namespaces,
    }, 'MacGiver check: sending request');

    // ImsClient.getServiceAccessToken() resolves to
    // { access_token, expires_in, token_type } — the bearer is in `access_token`.
    // Templating the whole object would send `Bearer [object Object]` and FACS
    // would reject it with 401.
    const { access_token: serviceToken } = await this.imsClient.getServiceAccessToken();
    if (!serviceToken) {
      throw new Error('MacGiver check: IMS service token is missing access_token');
    }
    this.log.info({
      tag: 'macgiver',
      url,
      hasServiceToken: true,
    }, 'MacGiver check: resolved service token, calling MacGiver');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    this.log.info({
      tag: 'macgiver', url, status: res.status, ok: res.ok,
    }, 'MacGiver check: received response');

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
    this.log.info({
      tag: 'macgiver',
      url,
      status: json.status,
      hasResults: Boolean(json.results),
      resultKeys: json.results ? Object.keys(json.results) : [],
    }, 'MacGiver check: parsed response body');

    if (json.status !== 'SUCCESS' || !json.results) {
      return [];
    }

    const allowed = Object.entries(json.results)
      .filter(([, v]) => v?.allowed === true)
      .map(([permission]) => permission);
    this.log.info({
      tag: 'macgiver', url, allowedCount: allowed.length, allowed,
    }, 'MacGiver check: returning allowed permissions');
    return allowed;
  }

  /**
   * Checks an explicit list of FACS permissions for a (user, org) pair in one
   * round-trip. Returns the subset of the requested permissions where
   * `allowed === true`. See `#check` for the evaluated-vs-unavailable contract.
   *
   * @param {object} args
   * @param {string} args.userId
   * @param {string} args.imsOrgId
   * @param {string[]} args.permissions - The permissions to evaluate.
   * @returns {Promise<string[]>} Allowed subset of `permissions`.
   */
  async checkListOfPermission({ userId, imsOrgId, permissions }) {
    return this.#check({ userId, imsOrgId, permissions });
  }

  /**
   * Returns every FACS permission the (user, org) pair holds across the given
   * namespaces — MacGiver evaluates all permissions defined in each namespace
   * and this returns the allowed subset. See `#check` for the
   * evaluated-vs-unavailable contract.
   *
   * @param {object} args
   * @param {string} args.userId
   * @param {string} args.imsOrgId
   * @param {string[]} args.namespaces - The namespaces whose permissions to evaluate.
   * @returns {Promise<string[]>} All allowed permissions across `namespaces`.
   */
  async checkAllPermission({ userId, imsOrgId, namespaces }) {
    return this.#check({ userId, imsOrgId, namespaces });
  }
}
