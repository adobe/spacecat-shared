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
import cwv from './functions/cwv.js';
import experiment from './functions/experiment.js';
import variant from './functions/variant.js';

const HANDLERS = {
  404: notfound,
  cwv,
  experiment,
  variant
};

export default class RUMAPIClient {
  static createFrom(context) {
    if (context.rumApiClient) return context.rumApiClient;

    const client = new RUMAPIClient();
    context.rumApiClient = client;
    return client;
  }

  // eslint-disable-next-line class-methods-use-this
  async query(query, opts) {
    const { handler, checkpoints } = HANDLERS[query] || {};
    if (!handler) throw new Error(`Unknown query ${query}`);

    try {
      const bundles = await fetchBundles({
        ...opts,
        checkpoints,
      });

      return handler(bundles);
    } catch (e) {
      throw new Error(`Query '${query}' failed. Opts: ${JSON.stringify(opts)}. Reason: ${e.message}`);
    }
  }
}
