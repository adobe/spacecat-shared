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
import { hasText, fetch } from '@adobe/spacecat-shared-utils';
import { fetchBundles, createBundleStream } from './common/rum-bundler-client.js';
import notfound from './functions/404.js';
import notfoundInternalLinks from './functions/404-internal-links.js';
import cwv from './functions/cwv.js';
import formVitals from './functions/form-vitals.js';
import experiment from './functions/experiment.js';
import trafficAcquisition from './functions/traffic-acquisition.js';
import totalMetrics from './functions/total-metrics.js';
import variant from './functions/variant.js';
import pageviews from './functions/pageviews.js';
import trafficMetrics from './functions/traffic-metrics.js';
import rageclick from './functions/opportunities/rageclick.js';
import highInorganicHighBounceRate from './functions/opportunities/high-inorganic-high-bounce-rate.js';
import highOrganicLowCtr from './functions/opportunities/high-organic-low-ctr.js';
import trafficAnalysis from './functions/traffic-analysis.js';
import optimizationReportMetrics from './functions/reports/optimization/metrics.js';
import optimizationReportGraph from './functions/reports/optimization/graph.js';
import engagement from './functions/engagement.js';

// exported for tests
export const RUM_BUNDLER_API_HOST = 'https://bundles.aem.page';

const HANDLERS = {
  404: notfound,
  '404-internal-links': notfoundInternalLinks,
  cwv,
  'form-vitals': formVitals,
  experiment,
  'traffic-acquisition': trafficAcquisition,
  variant,
  rageclick,
  totalMetrics,
  'high-inorganic-high-bounce-rate': highInorganicHighBounceRate,
  'high-organic-low-ctr': highOrganicLowCtr,
  pageviews,
  trafficMetrics,
  'traffic-analysis': trafficAnalysis,
  'optimization-report-metrics': optimizationReportMetrics,
  'optimization-report-graph': optimizationReportGraph,
  engagement,
};

function sanitize(opts) {
  return {
    ...opts,
    /* c8 ignore next 1 */
    ...(hasText(opts.domainkey) && { domainkey: `${opts.domainkey.slice(0, 3)}***` }),
  };
}

export default class RUMAPIClient {
  static createFrom(context) {
    const { env, log = console } = context;
    const { RUM_ADMIN_KEY: rumAdminKey } = env;

    if (context.rumApiClient) return context.rumApiClient;

    const client = new RUMAPIClient({ rumAdminKey }, log);
    context.rumApiClient = client;
    return client;
  }

  constructor({ rumAdminKey }, log) {
    this.log = log;
    this.rumAdminKey = rumAdminKey;
    this.domainkeyCache = {};
  }

  async _exchangeDomainkey(domain) {
    if (hasText(this.domainkeyCache[domain])) {
      return this.domainkeyCache[domain];
    }

    const resp = await fetch(`${RUM_BUNDLER_API_HOST}/domainkey/${domain}`, {
      headers: {
        Authorization: `Bearer ${this.rumAdminKey}`,
      },
    });

    if (!resp.ok) {
      throw new Error(`Error during fetching domainkey for domain '${domain} using admin key. Status: ${resp.status}`);
    }

    try {
      const json = await resp.json();
      if (!hasText(json.domainkey)) {
        throw new Error(`Unexpected response: ${JSON.stringify(json)}`);
      }
      this.domainkeyCache[domain] = json.domainkey;
      return json.domainkey;
    } catch (e) {
      throw new Error(`Error during fetching domainkey for domain '${domain} using admin key. Error: ${e.message}`);
    }
  }

  async _getDomainkey(opts) {
    const { domain, domainkey } = opts;

    if (!hasText(domainkey) && !hasText(this.rumAdminKey)) {
      throw new Error('You need to provide a \'domainkey\' or set RUM_ADMIN_KEY env variable');
    }

    if (hasText(domainkey)) {
      return domainkey;
    }

    return this._exchangeDomainkey(domain);
  }

  async retrieveDomainkey(domain) {
    return this._exchangeDomainkey(domain);
  }

  // eslint-disable-next-line class-methods-use-this
  async query(query, opts) {
    const { handler, checkpoints } = HANDLERS[query] || {};
    if (!handler) throw new Error(`Unknown query ${query}`);

    try {
      const domainkey = await this._getDomainkey(opts);
      const bundles = await fetchBundles({
        ...opts,
        domainkey,
        checkpoints,
      }, this.log);

      this.log.info(`Query "${query}" fetched ${bundles.length} bundles`);
      return handler(bundles, opts);
    } catch (e) {
      throw new Error(`Query '${query}' failed. Opts: ${JSON.stringify(sanitize(opts))}. Reason: ${e.message}`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async queryMulti(queries, opts) {
    const queryHandlers = [];
    const allCheckpoints = new Set();

    for (const query of queries) {
      const { handler, checkpoints = [] } = HANDLERS[query] || {};

      if (!handler) {
        throw new Error(`Unknown query: ${query}`);
      }

      queryHandlers.push({ query, handler });
      checkpoints.forEach((checkpoint) => allCheckpoints.add(checkpoint));
    }

    try {
      const domainkey = await this._getDomainkey(opts);

      // Fetch bundles with deduplicated checkpoints
      const bundles = await fetchBundles({
        ...opts,
        domainkey,
        checkpoints: [...allCheckpoints],
      }, this.log);

      const results = {};
      this.log.info(`Multi query ${JSON.stringify(queries.join(', '))} fetched ${bundles.length} bundles`);

      // Execute each query handler sequentially
      for (const { query, handler } of queryHandlers) {
        // eslint-disable-next-line no-await-in-loop
        results[query] = await handler(bundles, opts);
      }

      return results;
    } catch (e) {
      throw new Error(`Multi query failed. Queries: ${JSON.stringify(queries)}, Opts: ${JSON.stringify(sanitize(opts))}. Reason: ${e.message}`);
    }
  }

  async queryStream(query, opts) {
    const { handler, checkpoints } = HANDLERS[query] || {};
    if (!handler) throw new Error(`Unknown query ${query}`);

    try {
      const domainkey = await this._getDomainkey(opts);
      return createBundleStream({
        ...opts,
        domainkey,
        checkpoints,
        handler,
      }, this.log);
    } catch (e) {
      throw new Error(`Query stream '${query}' failed. Opts: ${JSON.stringify(sanitize(opts))}. Reason: ${e.message}`);
    }
  }
}
