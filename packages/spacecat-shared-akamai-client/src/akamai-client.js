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

import { signRequest } from './edgegrid-auth.js';

const REQUIRED_CONFIG_KEYS = ['host', 'clientToken', 'clientSecret', 'accessToken'];
const SEARCH_KEYS = ['hostname', 'edgeHostname', 'propertyName'];
const ACTIVATION_NETWORKS = ['STAGING', 'PRODUCTION'];
// Akamai rule formats are "latest" or a dated token like "v2024-01-01". A strict
// allowlist keeps a caller-supplied value from injecting into the Content-Type
// header (e.g. a CR/LF-bearing string).
const RULE_FORMAT_RE = /^[a-z0-9-]+$/i;

function requireText(name, value) {
  if (!hasText(value)) {
    throw new Error(`${name} is required`);
  }
}

// Every property-scoped PAPI call needs the same (propertyId, contractId,
// groupId) triple present — validate them in one place.
function requirePropertyRef(propertyId, contractId, groupId) {
  requireText('propertyId', propertyId);
  requireText('contractId', contractId);
  requireText('groupId', groupId);
}

// Validates a network argument against PAPI's two networks and returns the
// canonical upper-cased form.
function assertNetwork(network) {
  requireText('network', network);
  const upper = network.toUpperCase();
  if (!ACTIVATION_NETWORKS.includes(upper)) {
    throw new Error(`network must be one of ${ACTIVATION_NETWORKS.join(', ')}, got: ${network}`);
  }
  return upper;
}

// Path segments are user/caller-supplied IDs interpolated directly into PAPI
// URLs — encode them so a stray "/", "?", "&", or "#" can't redirect the
// request to an unintended endpoint instead of failing loudly.
function encodePathSegment(value) {
  return encodeURIComponent(value);
}

/**
 * Reduces user input (a URL, a host:port, a trailing dot) to a bare,
 * lowercase hostname.
 *
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  let d = String(domain || '').trim().toLowerCase();
  if (d.includes('://')) {
    [, d] = d.split('://');
  }
  [d] = d.split('/');
  [d] = d.split(':');
  return d.replace(/\.$/, '');
}

/**
 * A thin client for Akamai's Property Manager API (PAPI), authenticated with
 * the EdgeGrid (EG1-HMAC-SHA256) scheme.
 *
 * Docs: https://techdocs.akamai.com/property-mgr/reference/api-summary
 */
export default class AkamaiClient {
  #clientToken;

  #clientSecret;

  #accessToken;

  /**
   * Creates an AkamaiClient from a Universal context. Reads EdgeGrid
   * credentials from context.env: AKAMAI_HOST, AKAMAI_CLIENT_TOKEN,
   * AKAMAI_CLIENT_SECRET, AKAMAI_ACCESS_TOKEN, and optionally
   * AKAMAI_ACCOUNT_SWITCH_KEY and AKAMAI_NOTIFY_EMAILS (comma-separated,
   * required only if you intend to call activate()).
   *
   * @param {object} context - Universal function context
   * @returns {AkamaiClient}
   */
  static createFrom(context) {
    const { env, log = console } = context;
    const {
      AKAMAI_HOST: host,
      AKAMAI_CLIENT_TOKEN: clientToken,
      AKAMAI_CLIENT_SECRET: clientSecret,
      AKAMAI_ACCESS_TOKEN: accessToken,
      AKAMAI_ACCOUNT_SWITCH_KEY: accountSwitchKey,
      AKAMAI_NOTIFY_EMAILS: notifyEmailsCsv,
    } = env;
    const notifyEmails = hasText(notifyEmailsCsv)
      ? notifyEmailsCsv.split(',').map((email) => email.trim()).filter(Boolean)
      : undefined;
    return new AkamaiClient({
      host, clientToken, clientSecret, accessToken, accountSwitchKey, notifyEmails,
    }, log);
  }

  /**
   * @param {object} config
   * @param {string} config.host - EdgeGrid host, e.g.
   *   "akab-xxxxx.luna.akamaiapis.net" (scheme, if present, is ignored)
   * @param {string} config.clientToken
   * @param {string} config.clientSecret
   * @param {string} config.accessToken
   * @param {string} [config.accountSwitchKey]
   * @param {string[]} [config.notifyEmails] - Required only to call activate();
   *   emails PAPI notifies about activation progress.
   * @param {object} [log]
   */
  constructor(config = {}, log = console) {
    REQUIRED_CONFIG_KEYS.forEach((key) => {
      if (!hasText(config[key])) {
        throw new Error(`AkamaiClient requires ${key}`);
      }
    });
    this.host = config.host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    this.#clientToken = config.clientToken;
    this.#clientSecret = config.clientSecret;
    this.#accessToken = config.accessToken;
    this.accountSwitchKey = config.accountSwitchKey;
    this.notifyEmails = config.notifyEmails;
    this.log = log;
  }

  #buildUrl(path, params) {
    const query = new URLSearchParams(params || {});
    if (this.accountSwitchKey) {
      query.set('accountSwitchKey', this.accountSwitchKey);
    }
    const qs = query.toString();
    return `https://${this.host}${path}${qs ? `?${qs}` : ''}`;
  }

  async #request(method, path, { params, body, headers } = {}) {
    const url = this.#buildUrl(path, params);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const authorization = signRequest({
      method,
      url,
      body: bodyStr,
      clientToken: this.#clientToken,
      clientSecret: this.#clientSecret,
      accessToken: this.#accessToken,
    });

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
          ...headers,
        },
        body: bodyStr,
      });
    } catch (e) {
      throw new Error(`PAPI ${method} ${path} request failed: ${e.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PAPI ${method} ${path} -> ${res.status}: ${text.slice(0, 1000)}`);
    }

    const text = await res.text();
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`PAPI ${method} ${path} returned a non-JSON response`);
    }
  }

  // --- Find a property by the customer's site domain ------------------------

  /**
   * Searches PAPI's find-by-value endpoint for a single key.
   *
   * @param {'hostname'|'edgeHostname'|'propertyName'} key
   * @param {string} value
   * @returns {Promise<Array<object>>}
   */
  async searchBy(key, value) {
    if (!SEARCH_KEYS.includes(key)) {
      throw new Error(`searchBy key must be one of ${SEARCH_KEYS.join(', ')}, got: ${key}`);
    }
    requireText('value', value);
    this.log.info(`Searching PAPI properties by ${key}: ${value}`);
    // key is now guaranteed to be one of SEARCH_KEYS, not attacker-controlled,
    // so this computed property can't be used to set the object's prototype.
    const body = {};
    body[key] = value;
    const data = await this.#request('POST', '/papi/v1/search/find-by-value', { body });
    return data.versions?.items ?? [];
  }

  /**
   * Finds candidate properties serving a site domain. Searches the exact
   * hostname (plus its apex/www variant) and a property-name match, then
   * dedupes by propertyId, recording why each matched.
   *
   * @param {string} domain
   * @returns {Promise<Array<object>>}
   */
  async findPropertiesByDomain(domain) {
    requireText('domain', domain);
    const normalized = normalizeDomain(domain);
    const hostCandidates = new Set([normalized]);
    if (normalized.startsWith('www.')) {
      hostCandidates.add(normalized.slice(4));
    } else {
      hostCandidates.add(`www.${normalized}`);
    }

    const results = new Map();
    const add = (item, reason, value) => {
      const { propertyId } = item;
      if (!propertyId) {
        return;
      }
      if (!results.has(propertyId)) {
        results.set(propertyId, {
          propertyId,
          propertyName: item.propertyName,
          contractId: item.contractId,
          groupId: item.groupId,
          propertyVersion: item.propertyVersion,
          productionStatus: item.productionStatus,
          stagingStatus: item.stagingStatus,
          matchedOn: new Set(),
          matchedValues: new Set(),
        });
      }
      const entry = results.get(propertyId);
      entry.matchedOn.add(reason);
      entry.matchedValues.add(value);
    };

    await Promise.all([...hostCandidates].map(async (host) => {
      try {
        const items = await this.searchBy('hostname', host);
        items.forEach((item) => add(item, 'hostname', host));
      } catch (e) {
        // No active version on that hostname, auth failure, rate-limiting,
        // etc. — not a hard failure (other candidates may still match), but
        // log it so a systemic failure (e.g. bad credentials) is observable
        // instead of silently returning an incomplete/empty result set.
        this.log.warn(`searchBy('hostname', '${host}') failed, continuing: ${e.message}`);
      }
    }));

    const label = normalized.startsWith('www.') ? normalized.slice(4) : normalized;
    const nameQueries = new Set([label, label.split('.')[0]]);
    await Promise.all([...nameQueries].map(async (nameQuery) => {
      try {
        const items = await this.searchBy('propertyName', nameQuery);
        items.forEach((item) => add(item, 'propertyName', nameQuery));
      } catch (e) {
        this.log.warn(`searchBy('propertyName', '${nameQuery}') failed, continuing: ${e.message}`);
      }
    }));

    return [...results.values()]
      .map((entry) => ({
        ...entry,
        matchedOn: [...entry.matchedOn].sort(),
        matchedValues: [...entry.matchedValues].sort(),
      }))
      // Hostname matches are a stronger signal than name matches.
      .sort((a, b) => {
        const aHost = a.matchedOn.includes('hostname') ? 0 : 1;
        const bHost = b.matchedOn.includes('hostname') ? 0 : 1;
        if (aHost !== bHost) {
          return aHost - bHost;
        }
        return (a.propertyName || '').localeCompare(b.propertyName || '');
      });
  }

  // --- Version + rule-tree operations ----------------------------------------

  /**
   * @param {string} propertyId
   * @param {string} contractId
   * @param {string} groupId
   * @returns {Promise<number>} the latest property version
   */
  async getLatestVersion(propertyId, contractId, groupId) {
    requirePropertyRef(propertyId, contractId, groupId);
    const id = encodePathSegment(propertyId);
    this.log.info(`Fetching latest version for property ${propertyId}`);
    const data = await this.#request('GET', `/papi/v1/properties/${id}/versions/latest`, {
      params: { contractId, groupId },
    });
    const version = data.versions?.items?.[0]?.propertyVersion;
    if (version === undefined) {
      throw new Error(`PAPI returned no versions for property ${propertyId}`);
    }
    return version;
  }

  /**
   * @param {string} propertyId
   * @param {number} version
   * @param {string} contractId
   * @param {string} groupId
   * @returns {Promise<{ruleTree: object, ruleFormat: string|undefined}>}
   */
  async getRuleTree(propertyId, version, contractId, groupId) {
    requirePropertyRef(propertyId, contractId, groupId);
    if (!Number.isInteger(version)) {
      throw new Error('version must be an integer');
    }
    const id = encodePathSegment(propertyId);
    this.log.info(`Fetching rule tree for property ${propertyId} v${version}`);
    const data = await this.#request(
      'GET',
      `/papi/v1/properties/${id}/versions/${version}/rules`,
      { params: { contractId, groupId } },
    );
    return { ruleTree: data, ruleFormat: data.ruleFormat };
  }

  /**
   * @param {string} propertyId
   * @param {number} baseVersion
   * @param {string} contractId
   * @param {string} groupId
   * @returns {Promise<number>} the newly created version number
   */
  async createVersion(propertyId, baseVersion, contractId, groupId) {
    requirePropertyRef(propertyId, contractId, groupId);
    if (!Number.isInteger(baseVersion)) {
      throw new Error('baseVersion must be an integer');
    }
    const id = encodePathSegment(propertyId);
    this.log.info(`Creating new version of property ${propertyId} from v${baseVersion}`);
    const data = await this.#request('POST', `/papi/v1/properties/${id}/versions`, {
      params: { contractId, groupId },
      body: { createFromVersion: baseVersion },
    });
    // versionLink looks like ".../versions/{N}{?query}"
    const match = typeof data.versionLink === 'string' ? data.versionLink.match(/\/versions\/(\d+)/) : null;
    if (!match) {
      throw new Error(`PAPI response did not include a parseable versionLink for property ${propertyId}`);
    }
    return Number(match[1]);
  }

  /**
   * PUTs a rule tree, with PAPI-side validation enabled. Errors/warnings, if
   * any, come back in the response body rather than as an HTTP error.
   *
   * @param {string} propertyId
   * @param {number} version
   * @param {string} contractId
   * @param {string} groupId
   * @param {object} ruleTree
   * @param {string} [ruleFormat]
   * @returns {Promise<object>}
   */
  async updateRuleTree(propertyId, version, contractId, groupId, ruleTree, ruleFormat) {
    requirePropertyRef(propertyId, contractId, groupId);
    if (!Number.isInteger(version)) {
      throw new Error('version must be an integer');
    }
    if (ruleTree === null || typeof ruleTree !== 'object') {
      throw new Error('ruleTree must be an object');
    }
    if (ruleFormat && !RULE_FORMAT_RE.test(ruleFormat)) {
      throw new Error('ruleFormat must contain only letters, digits, and hyphens');
    }
    const id = encodePathSegment(propertyId);
    const headers = ruleFormat
      ? { 'Content-Type': `application/vnd.akamai.papirules.${ruleFormat}+json` }
      : undefined;
    this.log.info(`Updating rule tree for property ${propertyId} v${version}`);
    return this.#request(
      'PUT',
      `/papi/v1/properties/${id}/versions/${version}/rules`,
      {
        params: { contractId, groupId, validateRules: 'true' },
        body: ruleTree,
        headers,
      },
    );
  }

  // --- Activation --------------------------------------------------------

  /**
   * Activates a property version. Requires the client to have been
   * constructed with a non-empty `notifyEmails` list (PAPI requires at least
   * one address to notify about activation progress).
   *
   * @param {string} propertyId
   * @param {number} version
   * @param {string} contractId
   * @param {string} groupId
   * @param {'STAGING'|'PRODUCTION'} network
   * @param {string} [note]
   * @returns {Promise<string>} the activationLink returned by PAPI
   */
  async activate(
    propertyId,
    version,
    contractId,
    groupId,
    network,
    note = 'Activated via spacecat-shared-akamai-client',
  ) {
    requirePropertyRef(propertyId, contractId, groupId);
    const upperNetwork = assertNetwork(network);
    if (!Number.isInteger(version)) {
      throw new Error('version must be an integer');
    }
    if (!Array.isArray(this.notifyEmails) || this.notifyEmails.length === 0) {
      throw new Error(
        'AkamaiClient must be constructed with a non-empty notifyEmails array to call activate()',
      );
    }
    const id = encodePathSegment(propertyId);
    this.log.info(`Activating property ${propertyId} v${version} to ${upperNetwork}`);
    const data = await this.#request('POST', `/papi/v1/properties/${id}/activations`, {
      params: { contractId, groupId },
      body: {
        propertyVersion: version,
        network: upperNetwork,
        note,
        notifyEmails: this.notifyEmails,
        acknowledgeAllWarnings: true,
      },
    });
    return data.activationLink ?? '';
  }

  /**
   * Extracts the activation ID from an activationLink URL/path.
   *
   * @param {string} link
   * @returns {string}
   */
  static activationIdFromLink(link) {
    const withoutQuery = (link || '').split('?')[0];
    return withoutQuery.replace(/\/+$/, '').split('/').pop();
  }

  /**
   * Details for one activation: status (PENDING/ZONE_1/ZONE_2/ZONE_3/ACTIVE/
   * ABORTED/FAILED/DEACTIVATED/...), network, propertyVersion, submitDate,
   * updateDate, note.
   *
   * @param {string} propertyId
   * @param {string} activationId
   * @param {string} contractId
   * @param {string} groupId
   * @returns {Promise<object|undefined>}
   */
  async getActivation(propertyId, activationId, contractId, groupId) {
    requirePropertyRef(propertyId, contractId, groupId);
    requireText('activationId', activationId);
    const id = encodePathSegment(propertyId);
    const actId = encodePathSegment(activationId);
    const data = await this.#request(
      'GET',
      `/papi/v1/properties/${id}/activations/${actId}`,
      { params: { contractId, groupId } },
    );
    return data.activations?.items?.[0];
  }

  /**
   * All activations (both networks, all versions) for a property.
   *
   * @param {string} propertyId
   * @param {string} contractId
   * @param {string} groupId
   * @returns {Promise<Array<object>>}
   */
  async listActivations(propertyId, contractId, groupId) {
    requirePropertyRef(propertyId, contractId, groupId);
    const id = encodePathSegment(propertyId);
    const data = await this.#request('GET', `/papi/v1/properties/${id}/activations`, {
      params: { contractId, groupId },
    });
    return data.activations?.items ?? [];
  }

  /**
   * The most recently submitted activation for a given network, or undefined
   * if the property has never been activated there.
   *
   * @param {string} propertyId
   * @param {string} contractId
   * @param {string} groupId
   * @param {'STAGING'|'PRODUCTION'} network
   * @returns {Promise<object|undefined>}
   */
  async latestActivation(propertyId, contractId, groupId, network) {
    const upperNetwork = assertNetwork(network);
    const activations = await this.listActivations(propertyId, contractId, groupId);
    const candidates = activations.filter(
      (a) => (a.network || '').toUpperCase() === upperNetwork,
    );
    if (candidates.length === 0) {
      return undefined;
    }
    candidates.sort(
      (a, b) => (a.updateDate ?? a.submitDate ?? '').localeCompare(b.updateDate ?? b.submitDate ?? ''),
    );
    return candidates[candidates.length - 1];
  }
}
