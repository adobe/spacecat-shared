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

import { createDataAccess } from './service/index.js';

const TABLE_NAME_AUDITS = 'spacecat-services-audits-dev';
const TABLE_NAME_LATEST_AUDITS = 'spacecat-services-latest-audits-dev';
const TABLE_NAME_SITES = 'spacecat-services-sites-dev';
const TABLE_NAME_SITE_CANDIDATES = 'spacecat-services-site-candidates-dev';
const TABLE_NAME_ORGANIZATIONS = 'spacecat-services-organizations-dev';
const TABLE_NAME_CONFIGURATIONS = 'spacecat-services-configurations-dev';

const INDEX_NAME_ALL_SITES = 'spacecat-services-all-sites-dev';
const INDEX_NAME_ALL_ORGANIZATIONS = 'spacecat-services-all-organizations-dev';
const INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE = 'spacecat-services-all-sites-by-delivery-type-dev';
const INDEX_NAME_ALL_LATEST_AUDIT_SCORES = 'spacecat-services-all-latest-audit-scores-dev';
const INDEX_NAME_ALL_SITES_ORGANIZATIONS = 'spacecat-services-all-sites-organizations-dev';

const PK_ALL_SITES = 'ALL_SITES';
const PK_ALL_CONFIGURATIONS = 'ALL_CONFIGURATIONS';
const PK_ALL_ORGANIZATIONS = 'ALL_ORGANIZATIONS';
const PK_ALL_LATEST_AUDITS = 'ALL_LATEST_AUDITS';

export default function dataAccessWrapper(fn) {
  return async (request, context) => {
    if (!context.dataAccess) {
      const { log } = context;

      const {
        DYNAMO_TABLE_NAME_AUDITS = TABLE_NAME_AUDITS,
        DYNAMO_TABLE_NAME_LATEST_AUDITS = TABLE_NAME_LATEST_AUDITS,
        DYNAMO_TABLE_NAME_SITES = TABLE_NAME_SITES,
        DYNAMO_TABLE_NAME_SITE_CANDIDATES = TABLE_NAME_SITE_CANDIDATES,
        DYNAMO_TABLE_NAME_ORGANIZATIONS = TABLE_NAME_ORGANIZATIONS,
        DYNAMO_TABLE_NAME_CONFIGURATIONS = TABLE_NAME_CONFIGURATIONS,
        DYNAMO_INDEX_NAME_ALL_SITES = INDEX_NAME_ALL_SITES,
        DYNAMO_INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE = INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE,
        DYNAMO_INDEX_NAME_ALL_LATEST_AUDIT_SCORES = INDEX_NAME_ALL_LATEST_AUDIT_SCORES,
        DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS = INDEX_NAME_ALL_ORGANIZATIONS,
        DYNAMO_INDEX_NAME_ALL_SITES_ORGANIZATIONS = INDEX_NAME_ALL_SITES_ORGANIZATIONS,
      } = context.env;

      context.dataAccess = createDataAccess({
        tableNameAudits: DYNAMO_TABLE_NAME_AUDITS,
        tableNameLatestAudits: DYNAMO_TABLE_NAME_LATEST_AUDITS,
        tableNameOrganizations: DYNAMO_TABLE_NAME_ORGANIZATIONS,
        tableNameSites: DYNAMO_TABLE_NAME_SITES,
        tableNameSiteCandidates: DYNAMO_TABLE_NAME_SITE_CANDIDATES,
        tableNameConfigurations: DYNAMO_TABLE_NAME_CONFIGURATIONS,
        indexNameAllSites: DYNAMO_INDEX_NAME_ALL_SITES,
        indexNameAllOrganizations: DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS,
        indexNameAllSitesByDeliveryType: DYNAMO_INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE,
        indexNameAllLatestAuditScores: DYNAMO_INDEX_NAME_ALL_LATEST_AUDIT_SCORES,
        indexNameAllSitesOrganizations: DYNAMO_INDEX_NAME_ALL_SITES_ORGANIZATIONS,
        pkAllSites: PK_ALL_SITES,
        pkAllOrganizations: PK_ALL_ORGANIZATIONS,
        pkAllLatestAudits: PK_ALL_LATEST_AUDITS,
        pkAllConfigurations: PK_ALL_CONFIGURATIONS,
      }, log);
    }

    return fn(request, context);
  };
}
