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

import SeoClient from './client.js';

export default SeoClient;
export { fetch } from './client.js';
export { ENDPOINTS } from './endpoints.js';
export {
  buildQueryParams, parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, todayISO,
  buildFilter, extractBrand,
} from './utils.js';

export const ORGANIC_KEYWORDS_FIELDS = /** @type {const} */ ([
  'keyword',
  'keyword_country',
  'language',
  'sum_traffic',
  'volume',
  'best_position',
  'best_position_url',
  'cpc',
  'last_update',
  'is_branded',
  'is_navigational',
  'is_informational',
  'is_commercial',
  'is_transactional',
  'serp_features',
]);

export const METRICS_BY_COUNTRY_FILTER_FIELDS = /** @type {const} */ ([
  'org_keywords',
  'paid_keywords',
  'org_keywords_1_3',
  'org_traffic',
  'org_cost',
  'paid_traffic',
  'paid_cost',
  'paid_pages',
]);
