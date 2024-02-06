/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { createUrl } from '@adobe/fetch';
import {
  hasText, isArray, isInteger, isObject, dateAfterDays,
} from '@adobe/spacecat-shared-utils';
import { fetch } from './utils.js';

const APIS = {
  ROTATE_DOMAINKEYS: 'https://helix-pages.anywhere.run/helix-services/run-query@v3/rotate-domainkeys',
  RUM_DASHBOARD_UI: 'https://data.aem.live/rum-dashboard',
  NOT_FOUND_DASHBOARD_UI: 'https://data.aem.live/404-reports',
  RUM_DASHBOARD: 'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-dashboard',
  DOMAIN_LIST: 'https://helix-pages.anywhere.run/helix-services/run-query@v3/dash/domain-list',
  RUM_SOURCES: 'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-sources',
  RUM_EXPERIMENTS: 'https://helix-pages.anywhere.run/helix-services/run-query@v3/rum-experiments',
};

const DOMAIN_LIST_DEFAULT_PARAMS = {
  interval: 30,
  offset: 0,
  limit: 100000,
};

export const RUM_DEFAULT_PARAMS = {
  interval: 7,
  offset: 0,
  limit: 101,
};

export const NOT_FOUND_DEFAULT_PARAMS = {
  ...RUM_DEFAULT_PARAMS,
  checkpoint: 404,
};

export async function sendRequest(url, opts) {
  let respJson;
  try {
    const resp = await (isObject(opts) ? fetch(url, opts) : fetch(url));
    respJson = await resp.json();
  } catch (e) {
    throw new Error(`Error during rum api call: ${e.message}`);
  }

  const data = respJson?.results?.data;
  if (!isArray(data)) {
    throw new Error('Unexpected response from rum api. $.results.data is not array');
  }

  return data;
}

async function generateDomainKey(domainkey, url, expiry) {
  if (!hasText(url) || !isInteger(expiry)) {
    throw new Error('Invalid input: url and expiry date parameters are required');
  }

  const params = {
    domainkey,
    url,
    expiry: dateAfterDays(expiry).toISOString(),
    note: 'generated by spacecat alerting',
  };

  const data = await sendRequest(createUrl(APIS.ROTATE_DOMAINKEYS, params), { method: 'POST' });

  if (data.length === 0) {
    throw new Error('Unexpected response: Rum api returned empty result');
  }

  if (data[0].status !== 'success') {
    throw new Error('Unexpected response: Response was not successful');
  }

  if (!hasText(data[0].key)) {
    throw new Error('Unexpected response: Rum api returned null domain key');
  }

  return data[0].key;
}

async function createBacklink(dashboardUrl, domainKey, domainUrl, expiry) {
  const scopedDomainKey = await generateDomainKey(domainKey, domainUrl, expiry);
  return `${dashboardUrl}?interval=${expiry}&offset=0&limit=100&url=${domainUrl}&domainkey=${scopedDomainKey}`;
}

export default class RUMAPIClient {
  static createFrom(context) {
    if (context.rumApiClient) return context.rumApiClient;

    const { RUM_DOMAIN_KEY: domainkey } = context.env;

    const client = new RUMAPIClient(domainkey);
    context.rumApiClient = client;
    return client;
  }

  constructor(domainkey) {
    if (!hasText(domainkey)) {
      throw Error('RUM API Client needs a domain key to be set');
    }

    this.domainkey = domainkey;
  }

  create404URL(params = {}) {
    return createUrl(
      APIS.RUM_SOURCES,
      {
        domainkey: this.domainkey, ...NOT_FOUND_DEFAULT_PARAMS, ...params,
      },
    );
  }

  createExperimentationURL(params = {}) {
    return createUrl(
      APIS.RUM_EXPERIMENTS,
      {
        domainkey: this.domainkey, ...RUM_DEFAULT_PARAMS, ...params,
      },
    );
  }

  async getRUMDashboard(params = {}) {
    return sendRequest(createUrl(
      APIS.RUM_DASHBOARD,
      { domainkey: this.domainkey, ...RUM_DEFAULT_PARAMS, ...params },
    ));
  }

  async get404Sources(params = {}) {
    return sendRequest(this.create404URL(
      params,
    ));
  }

  async getDomainList(params = {}) {
    const data = await sendRequest(createUrl(
      APIS.DOMAIN_LIST,
      { domainkey: this.domainkey, ...DOMAIN_LIST_DEFAULT_PARAMS, ...params },
    ));

    return data.map((row) => row.hostname);
  }

  async createRUMBacklink(url, expiry) {
    return createBacklink(APIS.RUM_DASHBOARD_UI, this.domainkey, url, expiry);
  }

  async create404Backlink(url, expiry) {
    return createBacklink(APIS.NOT_FOUND_DASHBOARD_UI, this.domainkey, url, expiry);
  }
}
