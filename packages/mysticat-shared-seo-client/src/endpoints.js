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

/**
 * API path segments. Domain/overview reports use the root path,
 * while backlinks reports require the /analytics/v1/ path.
 */
export const API_PATHS = {
  root: '',
  analytics: 'analytics/v1/',
};

/**
 * Endpoint definitions for the SEO API.
 * Each entry maps a method name to its report type, columns, path, and default parameters.
 */
export const ENDPOINTS = {
  topPages: {
    type: 'domain_organic_unique',
    path: API_PATHS.root,
    columns: 'Ur,Tg',
    defaultParams: { display_sort: 'tg_desc', export_escape: 1 },
  },
  topPagesKeywords: {
    type: 'domain_organic',
    path: API_PATHS.root,
    columns: 'Ur,Ph,Tg',
    defaultParams: { display_sort: 'tg_desc', export_escape: 1 },
  },
  paidPages: {
    type: 'domain_adwords',
    path: API_PATHS.root,
    columns: 'Ph,Ur,Tg,Nq,Cp,Po,Tt',
    defaultParams: { display_sort: 'tg_desc', export_escape: 1 },
  },
  metrics: {
    type: 'domain_rank',
    path: API_PATHS.root,
    columns: 'Or,Ad,Ot,Oc,At,Ac,X0',
    defaultParams: { export_escape: 1 },
  },
  organicTraffic: {
    type: 'domain_rank_history',
    path: API_PATHS.root,
    columns: 'Dt,Ot,Oc,At,Ac',
    defaultParams: { display_sort: 'dt_asc', export_escape: 1 },
  },
  organicKeywords: {
    type: 'domain_organic',
    path: API_PATHS.root,
    columns: 'Ph,Po,Pp,Nq,Cp,Ur,Tg,Tr,Kd,Fp,Fk,Ts,In',
    defaultParams: { display_sort: 'tg_desc', export_escape: 1 },
  },
  brokenBacklinksPages: {
    type: 'backlinks_pages',
    path: API_PATHS.analytics,
    columns: 'source_url,response_code,backlinks_num,domains_num',
    defaultParams: { export_escape: 1 },
  },
  brokenBacklinks: {
    type: 'backlinks',
    path: API_PATHS.analytics,
    columns: 'source_title,source_url,target_url,page_ascore,external_num',
    defaultParams: { display_sort: 'page_ascore_desc', export_escape: 1 },
  },
  // Out of scope — stubs
  backlinks: {
    type: '', path: '', columns: '', defaultParams: {},
  },
  metricsByCountry: {
    type: '', path: '', columns: '', defaultParams: {},
  },
};
