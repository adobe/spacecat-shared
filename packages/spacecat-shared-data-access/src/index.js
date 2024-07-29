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
import { ImportJobStatus } from './models/importer/import-job.js';
import { ImportUrlStatus } from './models/importer/import-url.js';

const TABLE_NAME_AUDITS = 'spacecat-services-audits-dev';
const TABLE_NAME_KEY_EVENTS = 'spacecat-services-key-events';
const TABLE_NAME_LATEST_AUDITS = 'spacecat-services-latest-audits-dev';
const TABLE_NAME_SITES = 'spacecat-services-sites-dev';
const TABLE_NAME_SITE_CANDIDATES = 'spacecat-services-site-candidates-dev';
const TABLE_NAME_ORGANIZATIONS = 'spacecat-services-organizations-dev';
const TABLE_NAME_CONFIGURATIONS = 'spacecat-services-configurations-dev';
const TABLE_NAME_SITE_TOP_PAGES = 'spacecat-services-site-top-pages-dev';
const TABLE_NAME_IMPORT_JOBS = 'spacecat-services-import-jobs-dev';
const TABLE_NAME_IMPORT_URLS = 'spacecat-services-import-urls-dev';
const TABLE_NAME_EXPERIMENTS = 'spacecat-services-experiments-dev';
const TABLE_NAME_API_KEYS = 'spacecat-services-api-keys-dev';

const INDEX_NAME_ALL_KEY_EVENTS_BY_SITE_ID = 'spacecat-services-key-events-by-site-id';
const INDEX_NAME_ALL_SITES = 'spacecat-services-all-sites-dev';
const INDEX_NAME_ALL_ORGANIZATIONS = 'spacecat-services-all-organizations-dev';
const INDEX_NAME_ALL_ORGANIZATIONS_BY_IMS_ORG_ID = 'spacecat-services-all-organizations-by-ims-org-id-dev';
const INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE = 'spacecat-services-all-sites-by-delivery-type-dev';
const INDEX_NAME_ALL_LATEST_AUDIT_SCORES = 'spacecat-services-all-latest-audit-scores-dev';
const INDEX_NAME_ALL_SITES_ORGANIZATIONS = 'spacecat-services-all-sites-organizations-dev';
const INDEX_NAME_ALL_IMPORT_JOBS_BY_STATUS = 'spacecat-services-all-import-jobs-by-status-dev';
const INDEX_NAME_ALL_IMPORT_JOBS_BY_DATE_RANGE = 'spacecat-services-all-import-jobs-by-date-range-dev';
const INDEX_NAME_ALL_IMPORT_URLS_BY_JOB_ID_AND_STATUS = 'spacecat-services-all-import-urls-by-job-id-and-status-dev';

const PK_ALL_SITES = 'ALL_SITES';
const PK_ALL_CONFIGURATIONS = 'ALL_CONFIGURATIONS';
const PK_ALL_ORGANIZATIONS = 'ALL_ORGANIZATIONS';
const PK_ALL_LATEST_AUDITS = 'ALL_LATEST_AUDITS';
const PK_ALL_IMPORT_JOBS = 'ALL_IMPORT_JOBS';

export default function dataAccessWrapper(fn) {
  return async (request, context) => {
    if (!context.dataAccess) {
      const { log } = context;

      const {
        DYNAMO_TABLE_NAME_AUDITS = TABLE_NAME_AUDITS,
        DYNAMO_TABLE_NAME_KEY_EVENTS = TABLE_NAME_KEY_EVENTS,
        DYNAMO_TABLE_NAME_LATEST_AUDITS = TABLE_NAME_LATEST_AUDITS,
        DYNAMO_TABLE_NAME_SITES = TABLE_NAME_SITES,
        DYNAMO_TABLE_NAME_SITE_CANDIDATES = TABLE_NAME_SITE_CANDIDATES,
        DYNAMO_TABLE_NAME_ORGANIZATIONS = TABLE_NAME_ORGANIZATIONS,
        DYNAMO_TABLE_NAME_CONFIGURATIONS = TABLE_NAME_CONFIGURATIONS,
        DYNAMO_TABLE_NAME_SITE_TOP_PAGES = TABLE_NAME_SITE_TOP_PAGES,
        DYNAMO_TABLE_NAME_IMPORT_JOBS = TABLE_NAME_IMPORT_JOBS,
        DYNAMO_TABLE_NAME_IMPORT_URLS = TABLE_NAME_IMPORT_URLS,
        DYNAMO_TABLE_NAME_EXPERIMENTS = TABLE_NAME_EXPERIMENTS,
        DYNAMO_TABLE_NAME_API_KEYS = TABLE_NAME_API_KEYS,
        DYNAMO_INDEX_NAME_ALL_KEY_EVENTS_BY_SITE_ID = INDEX_NAME_ALL_KEY_EVENTS_BY_SITE_ID,
        DYNAMO_INDEX_NAME_ALL_SITES = INDEX_NAME_ALL_SITES,
        DYNAMO_INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE = INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE,
        DYNAMO_INDEX_NAME_ALL_LATEST_AUDIT_SCORES = INDEX_NAME_ALL_LATEST_AUDIT_SCORES,
        DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS = INDEX_NAME_ALL_ORGANIZATIONS,
        // eslint-disable-next-line max-len
        DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS_BY_IMS_ORG_ID = INDEX_NAME_ALL_ORGANIZATIONS_BY_IMS_ORG_ID,
        DYNAMO_INDEX_NAME_ALL_SITES_ORGANIZATIONS = INDEX_NAME_ALL_SITES_ORGANIZATIONS,
        DYNAMO_INDEX_NAME_ALL_IMPORT_JOBS_BY_STATUS = INDEX_NAME_ALL_IMPORT_JOBS_BY_STATUS,
        DYNAMO_INDEX_NAME_ALL_IMPORT_JOBS_BY_DATE_RANGE = INDEX_NAME_ALL_IMPORT_JOBS_BY_DATE_RANGE,
        DYNAMO_INDEX_NAME_ALL_IMPORT_URLS_BY_JOB_ID_AND_STATUS =
        INDEX_NAME_ALL_IMPORT_URLS_BY_JOB_ID_AND_STATUS,
      } = context.env;

      context.dataAccess = createDataAccess({
        tableNameAudits: DYNAMO_TABLE_NAME_AUDITS,
        tableNameKeyEvents: DYNAMO_TABLE_NAME_KEY_EVENTS,
        tableNameLatestAudits: DYNAMO_TABLE_NAME_LATEST_AUDITS,
        tableNameOrganizations: DYNAMO_TABLE_NAME_ORGANIZATIONS,
        tableNameSites: DYNAMO_TABLE_NAME_SITES,
        tableNameSiteCandidates: DYNAMO_TABLE_NAME_SITE_CANDIDATES,
        tableNameConfigurations: DYNAMO_TABLE_NAME_CONFIGURATIONS,
        tableNameSiteTopPages: DYNAMO_TABLE_NAME_SITE_TOP_PAGES,
        tableNameImportJobs: DYNAMO_TABLE_NAME_IMPORT_JOBS,
        tableNameImportUrls: DYNAMO_TABLE_NAME_IMPORT_URLS,
        tableNameExperiments: DYNAMO_TABLE_NAME_EXPERIMENTS,
        tableNameApiKeys: DYNAMO_TABLE_NAME_API_KEYS,
        indexNameAllKeyEventsBySiteId: DYNAMO_INDEX_NAME_ALL_KEY_EVENTS_BY_SITE_ID,
        indexNameAllSites: DYNAMO_INDEX_NAME_ALL_SITES,
        indexNameAllOrganizations: DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS,
        indexNameAllOrganizationsByImsOrgId: DYNAMO_INDEX_NAME_ALL_ORGANIZATIONS_BY_IMS_ORG_ID,
        indexNameAllSitesByDeliveryType: DYNAMO_INDEX_NAME_ALL_SITES_BY_DELIVERY_TYPE,
        indexNameAllLatestAuditScores: DYNAMO_INDEX_NAME_ALL_LATEST_AUDIT_SCORES,
        indexNameAllSitesOrganizations: DYNAMO_INDEX_NAME_ALL_SITES_ORGANIZATIONS,
        indexNameAllImportJobsByStatus: DYNAMO_INDEX_NAME_ALL_IMPORT_JOBS_BY_STATUS,
        indexNameAllImportJobsByDateRange: DYNAMO_INDEX_NAME_ALL_IMPORT_JOBS_BY_DATE_RANGE,
        indexNameImportUrlsByJobIdAndStatus: DYNAMO_INDEX_NAME_ALL_IMPORT_URLS_BY_JOB_ID_AND_STATUS,
        pkAllSites: PK_ALL_SITES,
        pkAllOrganizations: PK_ALL_ORGANIZATIONS,
        pkAllLatestAudits: PK_ALL_LATEST_AUDITS,
        pkAllConfigurations: PK_ALL_CONFIGURATIONS,
        pkAllImportJobs: PK_ALL_IMPORT_JOBS,
      }, log);
    }

    return fn(request, context);
  };
}

export {
  ImportJobStatus,
  ImportUrlStatus,
};
