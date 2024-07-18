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

function handler(bundles) {
  const collectPageViews = bundles => pageviewsByUrl(bundles).filter(page => page.views >= 5000);
  const pageviewUrls = collectPageViews(bundles).map(row => row.url);

  return FlatBundle.fromArray(bundles)
    .filter(row => pageviewUrls.includes(row.url) && row.checkpoint === 'convert')
    .groupBy('url')
    .map((groupedByUrl) => {
      const { url, items } = groupedByUrl;
      const totalViews = pageviews.find((row) => row.url === url).views;
      const totalConversions = items.reduce((acc, cur) => acc + cur.weight, 0);
      return {
        url,
        conversionRate: totalConversions / totalViews,
      };
      })
      .filter((row) => row.conversionRate < 0.05);
}
    
export default {
  handler,
  checkpoints: ['pageview', 'convert'],
};

