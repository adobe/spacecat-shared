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

import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

import { createDataAccess } from '../../../src/service/index.js';

export const TEST_DA_CONFIG = {
  indexNameAllImportJobsByDateRange: 'spacecat-services-all-import-jobs-by-date-range',
  indexNameAllImportJobsByStatus: 'spacecat-services-all-import-jobs-by-status',
  indexNameAllKeyEventsBySiteId: 'spacecat-services-key-events-by-site-id',
  indexNameAllLatestAuditScores: 'spacecat-services-all-latest-audit-scores',
  indexNameAllOrganizations: 'spacecat-services-all-organizations',
  indexNameAllOrganizationsByImsOrgId: 'spacecat-services-all-organizations-by-ims-org-id',
  indexNameAllSites: 'spacecat-services-all-sites',
  indexNameAllSitesByDeliveryType: 'spacecat-services-all-sites-by-delivery-type',
  indexNameAllSitesOrganizations: 'spacecat-services-all-sites-organizations',
  indexNameApiKeyByHashedApiKey: 'spacecat-services-api-key-by-hashed-api-key',
  indexNameApiKeyByImsUserIdAndImsOrgId: 'spacecat-services-api-key-by-ims-user-id-and-ims-org-id',
  indexNameImportUrlsByJobIdAndStatus: 'spacecat-services-all-import-urls-by-job-id-and-status',
  pkAllConfigurations: 'ALL_CONFIGURATIONS',
  pkAllImportJobs: 'ALL_IMPORT_JOBS',
  pkAllLatestAudits: 'ALL_LATEST_AUDITS',
  pkAllOrganizations: 'ALL_ORGANIZATIONS',
  pkAllSites: 'ALL_SITES',
  tableNameApiKeys: 'spacecat-services-api-keys',
  tableNameAudits: 'spacecat-services-audits',
  tableNameConfigurations: 'spacecat-services-configurations',
  tableNameData: 'spacecat-services-data',
  tableNameExperiments: 'spacecat-services-experiments',
  tableNameImportJobs: 'spacecat-services-import-jobs',
  tableNameImportUrls: 'spacecat-services-import-urls',
  tableNameKeyEvents: 'spacecat-services-key-events',
  tableNameLatestAudits: 'spacecat-services-latest-audits',
  tableNameOrganizations: 'spacecat-services-organizations',
  tableNameSiteCandidates: 'spacecat-services-site-candidates',
  tableNameSiteTopPages: 'spacecat-services-site-top-pages',
  tableNameSites: 'spacecat-services-sites',
  tableNameSpacecatData: 'spacecat-data',
};

export const TEST_DA_MIGRATION_CONFIG = {
  indexNameAllImportJobsByDateRange: 'spacecat-services-all-import-jobs-by-date-range',
  indexNameAllImportJobsByStatus: 'spacecat-services-all-import-jobs-by-status',
  indexNameAllKeyEventsBySiteId: 'spacecat-services-key-events-by-site-id-dev',
  indexNameAllLatestAuditScores: 'spacecat-services-all-latest-audit-scores',
  indexNameAllOrganizations: 'spacecat-services-all-organizations-dev',
  indexNameAllOrganizationsByImsOrgId: 'spacecat-services-all-organizations-by-ims-org-id-dev',
  indexNameAllSites: 'spacecat-services-all-sites-dev',
  indexNameAllSitesByDeliveryType: 'spacecat-services-all-sites-by-delivery-type-dev',
  indexNameAllSitesOrganizations: 'spacecat-services-all-sites-organizations-dev',
  indexNameApiKeyByHashedApiKey: 'spacecat-services-api-key-by-hashed-api-key',
  indexNameApiKeyByImsUserIdAndImsOrgId: 'spacecat-services-api-key-by-ims-user-id-and-ims-org-id',
  indexNameImportUrlsByJobIdAndStatus: 'spacecat-services-all-import-urls-by-job-id-and-status',
  pkAllConfigurations: 'ALL_CONFIGURATIONS',
  pkAllImportJobs: 'ALL_IMPORT_JOBS',
  pkAllLatestAudits: 'ALL_LATEST_AUDITS',
  pkAllOrganizations: 'ALL_ORGANIZATIONS',
  pkAllSites: 'ALL_SITES',
  tableNameApiKeys: 'spacecat-services-api-keys-dev',
  tableNameAudits: 'spacecat-services-audits-dev',
  tableNameConfigurations: 'spacecat-services-configurations-dev',
  tableNameData: 'spacecat-services-data-dev',
  tableNameExperiments: 'spacecat-services-experiments-dev',
  tableNameImportJobs: 'spacecat-services-import-jobs-dev',
  tableNameImportUrls: 'spacecat-services-import-urls-dev',
  tableNameKeyEvents: 'spacecat-services-key-events-dev',
  tableNameLatestAudits: 'spacecat-services-latest-audits-dev',
  tableNameOrganizations: 'spacecat-services-organizations-dev',
  tableNameSiteCandidates: 'spacecat-services-site-candidates-dev',
  tableNameSiteTopPages: 'spacecat-services-site-top-pages-dev',
  tableNameSites: 'spacecat-services-sites-dev',
  tableNameSpacecatData: 'spacecat-services-data-dev',
};

let docClient = null;

const getDynamoClients = (config = {}) => {
  let dbClient;
  if (config?.region && config?.credentials) {
    dbClient = new DynamoDB(config);
  } else {
    dbClient = new DynamoDB({
      endpoint: 'http://127.0.0.1:8000',
      region: 'local',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
    });
  }
  docClient = DynamoDBDocument.from(dbClient);

  return { dbClient, docClient };
};

export const getDataAccess = async (config, isMigration = false) => {
  const { dbClient } = getDynamoClients(config);
  return createDataAccess(isMigration
    ? TEST_DA_MIGRATION_CONFIG
    : TEST_DA_CONFIG, console, dbClient);
};

export { getDynamoClients };
