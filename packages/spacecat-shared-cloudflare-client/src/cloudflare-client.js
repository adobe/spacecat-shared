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
  #token;

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
    this.#token = token;
    this.apiBase = apiBase;
    this.log = log;
  }

  async #cfFetch(path, options = {}) {
    const url = `${this.apiBase}${path}`;
    let res;
    try {
      res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.#token}`,
          ...options.headers,
        },
      });
    } catch (e) {
      throw new Error(`Cloudflare API request to ${path} failed: ${e.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudflare API returned ${res.status} on ${path}: ${text.slice(0, 200)}`);
    }

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error(`Cloudflare API returned a non-JSON response on ${path}`);
    }

    if (!body.success) {
      const msg = body.errors?.[0]?.message || `Cloudflare API error on ${path}`;
      throw new Error(msg);
    }
    return body.result;
  }

  /**
   * Lists Cloudflare accounts accessible with the current token.
   *
   * Returns a single page of results. To retrieve more than `perPage` accounts,
   * call repeatedly with an incrementing `page`.
   *
   * @param {object} [options]
   * @param {number} [options.page=1] - 1-based page number
   * @param {number} [options.perPage=50] - results per page
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listAccounts({ page = 1, perPage = 50 } = {}) {
    this.log.info('Listing Cloudflare accounts');
    return this.#cfFetch(`/accounts?page=${page}&per_page=${perPage}`);
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
   * @param {boolean} [opts.overwrite=false] - Bypass all existence checks and always upload.
   * @param {string[]} [opts.tags] - Tags to attach to the Worker script. When provided:
   *   script exists with a matching tag → silently skip (idempotent);
   *   script exists without a matching tag → error (different owner);
   *   script does not exist → deploy.
   * @returns {Promise<object|null>} - null when the deploy was skipped
   */
  async deployWorkerScript(accountId, scriptName, scriptContent, bindings = [], opts = {}) {
    if (!hasText(accountId)) {
      throw new Error('accountId is required');
    }
    if (!hasText(scriptName)) {
      throw new Error('scriptName is required');
    }
    if (!hasText(scriptContent)) {
      throw new Error('scriptContent is required');
    }

    const {
      compatibilityDate = '2025-01-01',
      observability = true,
      overwrite = false,
      tags,
    } = opts;

    if (!overwrite) {
      const found = await this.#findWorker(accountId, scriptName);
      if (found) {
        if (Array.isArray(tags) && tags.length > 0) {
          const settings = await this.#getWorkerSettings(accountId, scriptName);
          if (tags.some((t) => settings.tags?.includes(t))) {
            this.log.info(`Worker script '${scriptName}' already deployed with a matching tag — skipping`);
            return null;
          }
        }
        throw new Error(`Worker script '${scriptName}' already exists in account ${accountId}. Set overwrite: true to replace it.`);
      }
    }

    const metadata = {
      main_module: 'worker.js',
      bindings,
      compatibility_date: compatibilityDate,
      ...(observability && { observability: { enabled: true } }),
      ...(Array.isArray(tags) && tags.length > 0 && { tags }),
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
    if (!hasText(accountId)) {
      throw new Error('accountId is required');
    }
    if (!hasText(scriptName)) {
      throw new Error('scriptName is required');
    }
    if (!hasText(secretName)) {
      throw new Error('secretName is required');
    }
    this.log.debug(`Setting secret '${secretName}' on worker '${scriptName}'`);
    return this.#cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}/secrets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: secretName, text: secretValue, type: 'secret_text' }),
    });
  }

  async #findWorker(accountId, scriptName) {
    // name param returns partial matches — filter to exact script_name.
    // Note: the result objects use `script_name` for the worker name (used in URLs/routes);
    // `id` is the script tag identifier and is not the same value.
    const workers = await this.#cfFetch(
      `/accounts/${accountId}/workers/scripts-search?name=${encodeURIComponent(scriptName)}&per_page=100`,
    );
    return (workers ?? []).find((w) => w.script_name === scriptName) ?? null;
  }

  async #getWorkerSettings(accountId, scriptName) {
    return this.#cfFetch(`/accounts/${accountId}/workers/scripts/${scriptName}/script-settings`);
  }

  /**
   * Lists active Cloudflare zones accessible with the current token.
   *
   * Returns a single page of results. To retrieve more than `perPage` zones,
   * call repeatedly with an incrementing `page`.
   *
   * @param {object} [options]
   * @param {number} [options.page=1] - 1-based page number
   * @param {number} [options.perPage=50] - results per page
   * @param {string} [options.accountId] - restrict results to a specific account
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async listZones({ page = 1, perPage = 50, accountId } = {}) {
    this.log.info('Listing Cloudflare zones');
    const accountFilter = hasText(accountId) ? `&account.id=${encodeURIComponent(accountId)}` : '';
    return this.#cfFetch(`/zones?page=${page}&per_page=${perPage}&status=active${accountFilter}`);
  }

  /**
   * Fetches a single zone by ID — most notably its `name` (domain), so callers can verify a
   * caller-supplied zoneId actually belongs to the domain they claim it does before acting on it
   * (e.g. before creating a Logpush job or worker route for that zone).
   * @param {string} zoneId
   * @returns {Promise<{id: string, name: string, status: string}>}
   */
  async getZone(zoneId) {
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    this.log.info(`Fetching Cloudflare zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}`);
  }

  /**
   * Lists all Worker routes for a zone.
   * @param {string} zoneId
   * @returns {Promise<Array<{id: string, pattern: string, script: string}>>}
   */
  async listRoutes(zoneId) {
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
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
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    if (!hasText(pattern)) {
      throw new Error('pattern is required');
    }
    if (!hasText(scriptName)) {
      throw new Error('scriptName is required');
    }
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
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    if (!hasText(routeId)) {
      throw new Error('routeId is required');
    }
    this.log.info(`Deleting route ${routeId} from zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}/workers/routes/${routeId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Requests a Logpush ownership challenge for a destination. Cloudflare writes a challenge
   * file containing a token to the destination itself (e.g. the S3 path in `destinationConf`);
   * the caller must read that file out-of-band and pass the resulting token as
   * `ownership_challenge` when calling {@link createLogpushJob}.
   *
   * Zone-scoped (matches the zone-scoped `http_requests` dataset used for Logpush jobs here).
   *
   * @param {string} zoneId
   * @param {string} destinationConf - e.g. "s3://bucket/path/{DATE}?region=us-east-1"
   * @returns {Promise<{filename: string, valid: boolean, message?: string}>}
   */
  async requestLogpushOwnership(zoneId, destinationConf) {
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    if (!hasText(destinationConf)) {
      throw new Error('destinationConf is required');
    }
    this.log.info(`Requesting Logpush ownership challenge for zone ${zoneId}`);
    return this.#cfFetch(`/zones/${zoneId}/logpush/ownership`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination_conf: destinationConf }),
    });
  }

  /**
   * Lists Logpush jobs for a zone, scoped to a single dataset.
   * @param {string} zoneId
   * @param {string} dataset - e.g. "http_requests"
   * @returns {Promise<Array<object>>} Logpush job objects (id, dataset, destination_conf, ...)
   */
  async listLogpushJobs(zoneId, dataset) {
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    if (!hasText(dataset)) {
      throw new Error('dataset is required');
    }
    this.log.info(`Listing Logpush jobs for zone ${zoneId}, dataset ${dataset}`);
    return this.#cfFetch(`/zones/${zoneId}/logpush/datasets/${dataset}/jobs`);
  }

  /**
   * Creates a Logpush job for a zone. `payload.ownership_challenge` must be the token read
   * from the challenge file written by {@link requestLogpushOwnership} — Cloudflare validates
   * it inline against `payload.destination_conf` when creating the job.
   *
   * @param {string} zoneId
   * @param {object} payload
   * @param {string} payload.dataset - e.g. "http_requests"
   * @param {string} payload.destination_conf
   * @param {string} payload.ownership_challenge
   * @param {string} [payload.name]
   * @param {object} [payload.output_options] - e.g. { field_names, timestamp_format }
   * @param {boolean} [payload.enabled]
   * @returns {Promise<object>} the created Logpush job
   */
  async createLogpushJob(zoneId, payload) {
    if (!hasText(zoneId)) {
      throw new Error('zoneId is required');
    }
    if (!payload || !hasText(payload.dataset)) {
      throw new Error('payload.dataset is required');
    }
    if (!hasText(payload.destination_conf)) {
      throw new Error('payload.destination_conf is required');
    }
    if (!hasText(payload.ownership_challenge)) {
      throw new Error('payload.ownership_challenge is required');
    }
    this.log.info(`Creating Logpush job on zone ${zoneId} for dataset ${payload.dataset}`);
    return this.#cfFetch(`/zones/${zoneId}/logpush/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}
