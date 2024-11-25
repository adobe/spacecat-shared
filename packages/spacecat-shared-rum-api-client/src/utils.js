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

import { context as h2, h1 } from '@adobe/fetch';
import { utils } from '@adobe/rum-distiller';
import { classifyTraffic } from './common/traffic.js';

export const DELIMITER = '≡';

export const generateKey = (...keys) => keys.join(DELIMITER);

export const trafficSeriesFn = (memo, type) => (bundle) => {
  const key = generateKey(bundle.url, bundle.id, bundle.time);
  if (!memo[key]) {
    // eslint-disable-next-line no-param-reassign
    memo[key] = classifyTraffic(bundle).type;
  }

  return type === memo[key] ? bundle.weight : 0;
};

export const loadBundles = (bundles, dataChunks) => {
  dataChunks.load([{ rumBundles: bundles.map(utils.addCalculatedProps) }]);
};

/* c8 ignore next 3 */
export const { fetch } = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1()
  : h2();
