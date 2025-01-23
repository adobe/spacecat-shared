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
import { fetchBundles } from './common/rum-bundler-client.js';
import notfound from './functions/404.js';
import notfoundInternalLinks from './functions/404-internal-links.js';
import cwv from './functions/cwv.js';
import formVitals from './functions/form-vitals.js';
import experiment from './functions/experiment.js';
import trafficAcquisition from './functions/traffic-acquisition.js';
import totalMetrics from './functions/total-metrics.js';
import variant from './functions/variant.js';
import rageclick from './functions/opportunities/rageclick.js';
import highInorganicHighBounceRate from './functions/opportunities/high-inorganic-high-bounce-rate.js';
import highOrganicLowCtr from './functions/opportunities/high-organic-low-ctr.js';

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
};

export default class RUMAPIClient {
  static createFrom(context) {
    const { log = console } = context;

    if (context.rumApiClient) return context.rumApiClient;

    const client = new RUMAPIClient(log);
    context.rumApiClient = client;
    return client;
  }

  constructor(log) {
    this.log = log;
  }

  // eslint-disable-next-line class-methods-use-this
  async query(query, opts) {
    const { handler, checkpoints } = HANDLERS[query] || {};
    if (!handler) throw new Error(`Unknown query ${query}`);

    try {
      const bundles = await fetchBundles({
        ...opts,
        checkpoints,
      }, this.log);

      this.log.info(`Query "${query}" fetched ${bundles.length} bundles`);

      return handler(bundles, opts);
    } catch (e) {
      throw new Error(`Query '${query}' failed. Opts: ${JSON.stringify(opts)}. Reason: ${e.message}`);
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
      // Fetch bundles with deduplicated checkpoints
      const bundles = await fetchBundles({
        ...opts,
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
      throw new Error(`Multi query failed. Queries: ${JSON.stringify(queries)}, Opts: ${JSON.stringify(opts)}. Reason: ${e.message}`);
    }
  }
}
