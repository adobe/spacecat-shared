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

import { FlatBundle } from '../common/flat-bundle.js';
import { pageviewsByUrl } from '../common/aggregateFns.js';

const CTR_CHECKPOINT = 'click';
// handler function to calculate CTR using the collectPageviews function
function handler(bundles) {
  const pageviews = pageviewsByUrl(bundles);

  return FlatBundle.fromArray(bundles)
    .groupBy('url')
    .filter((row) => row.checkpoint === CTR_CHECKPOINT && pageviews.views > 5000)
    .map((collectPageviews) => {
      const { url, views, clicks } = collectPageviews;
      const ctr = (clicks / views) * 100;
      return {
        url, views, clicks, ctr,
      };
    });
}

export default {
  handler,
  checkpoints: CTR_CHECKPOINT,
};
