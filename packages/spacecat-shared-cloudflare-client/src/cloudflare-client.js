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

import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export default class CloudflareClient {
  /**
   * Creates a CloudflareClient from a Universal context.
   * Reads the API token from context.env.CLOUDFLARE_API_TOKEN.
   * @param {object} context - Universal function context
   * @returns {CloudflareClient}
   */
  static createFrom(context) {
    const { env, log = console } = context;
    const { CLOUDFLARE_API_TOKEN: token } = env;
    if (!hasText(token)) {
      throw new Error('CloudflareClient requires CLOUDFLARE_API_TOKEN in context.env');
    }
    return new CloudflareClient({ token }, log);
  }

  /**
   * @param {{ token: string, apiBase?: string }} config
   * @param {object} [log]
   */
  constructor({ token, apiBase = CF_API_BASE }, log = console) {
    if (!hasText(token)) {
      throw new Error('CloudflareClient requires a token');
    }
    this.token = token;
    this.apiBase = apiBase;
    this.log = log;
  }

  async #cfFetch(path, options = {}) {
    const url = `${this.apiBase}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    });
    const body = await res.json();
    if (!body.success) {
      const msg = body.errors?.[0]?.message || `Cloudflare API error on ${path}`;
      throw new Error(msg);
    }
    return body.result;
  }

  /**
   * Lists all Cloudflare accounts accessible with the current token.
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listAccounts() {
    this.log.info('Listing Cloudflare accounts');
    return this.#cfFetch('/accounts?per_page=50');
  }

  /**
   * Uploads a Worker script as an ES module, binding env vars and enabling logs.
   *
   * @param {string} accountId
   * @param {string} scriptName
   * @param {string} scriptContent - Worker source (ES module)
   * @param {Array<{name: string, type: string, text?: string}>} [bindings]
   * @param {object} [opts]
   * @param {string}  [opts.compatibilityDate]
   * @param {boolean} [opts.observability] - Enable Workers Logs (default: true)
   * @returns {Promise<object>}
   */
  async deployWorkerScript(accountId, scriptName, scriptContent, bindings = [], opts = {}) {
    const {
      compatibilityDate = '2025-01-01',
      observability = true,
    } = opts;

    const metadata = {
      main_module: 'worker.js',
      bindings,
      compatibility_date: compatibilityDate,
      ...(observability && { observability: { enabled: true } }),
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('worker.js', new Blob([scriptContent], { type: 'application/javascript+module' }), 'worker.js');

    this.log.info(`Deploying worker script '${scriptName}' to account ${accountId}`);
    return this.#cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
      method: 'PUT',
      body: form,
    });
  }

  /**
   * Sets an encrypted secret on a deployed Worker script.
   *
   * @param {string} accountId
   * @param {string} scriptName
   * @param {string} secretName
   * @param {string} secretValue
   * @returns {Promise<object>}
   */
  async setWorkerSecret(accountId, scriptName, secretName, secretValue) {
    this.log.info(`Setting secret '${secretName}' on worker '${scriptName}'`);
    return this.#cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: secretName, text: secretValue, type: 'secret_text' }),
    });
  }

  /**
   * Lists active Cloudflare zones accessible with the current token.
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listZones() {
    this.log.info('Listing Cloudflare zones');
    return this.#cfFetch('/zones?per_page=50&status=active');
  }

  /**
   * Lists all Worker routes for a zone.
   * @param {string} zoneId
   * @returns {Promise<Array<{id: string, pattern: string, script: string}>>}
   */
  async listRoutes(zoneId) {
    this.log.info(`Listing routes for zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}/workers/routes`);
  }

  /**
   * Adds a Worker route to a zone.
   * @param {string} zoneId
   * @param {string} pattern - Route pattern, e.g. "example.com/*"
   * @param {string} scriptName - Worker script name to attach
   * @returns {Promise<{id: string, pattern: string, script: string}>}
   */
  async addRoute(zoneId, pattern, scriptName) {
    this.log.info(`Adding route '${pattern}' → '${scriptName}' on zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}/workers/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, script: scriptName }),
    });
  }

  /**
   * Deletes a Worker route from a zone.
   * @param {string} zoneId
   * @param {string} routeId
   * @returns {Promise<object>}
   */
  async deleteRoute(zoneId, routeId) {
    this.log.info(`Deleting route ${routeId} from zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}/workers/routes/${routeId}`, {
      method: 'DELETE',
    });
  }
}
