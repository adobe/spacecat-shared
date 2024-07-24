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

import { createClient } from '@adobe/spacecat-shared-dynamo';
import { auditFunctions } from './audits/index.js';
import { keyEventFunctions } from './key-events/index.js';
import { siteFunctions } from './sites/index.js';
import { siteCandidateFunctions } from './site-candidates/index.js';
import { organizationFunctions } from './organizations/index.js';
import { configurationFunctions } from './configurations/index.js';
import { siteTopPagesFunctions } from './site-top-pages/index.js';
import { importJobFunctions } from './import-job/index.js';
import { importUrlFunctions } from './import-url/index.js';
import { experimentFunctions } from './experiments/index.js';

/**
 * Creates a data access object.
 *
 * @param {{pkAllSites: string, pkAllLatestAudits: string, indexNameAllLatestAuditScores: string,
 * tableNameAudits: string,tableNameLatestAudits: string, indexNameAllSitesOrganizations: string,
 * tableNameSites: string, tableNameOrganizations: string, tableNameExperiments: string,
 * indexNameAllSites: string,
 * tableNameImportJobs: string, pkAllImportJobs: string, indexNameAllImportJobs: string,
 * tableNameSiteTopPages: string, indexNameAllOrganizations: string,
 * indexNameAllOrganizationsByImsOrgId: string, pkAllOrganizations: string}} config configuration
 * @param {Logger} log logger
 * @returns {object} data access object
 */
export const createDataAccess = (config, log = console) => {
  const dynamoClient = createClient(log);

  const auditFuncs = auditFunctions(dynamoClient, config, log);
  const keyEventFuncs = keyEventFunctions(dynamoClient, config, log);
  const siteFuncs = siteFunctions(dynamoClient, config, log);
  const siteCandidateFuncs = siteCandidateFunctions(dynamoClient, config, log);
  const organizationFuncs = organizationFunctions(dynamoClient, config, log);
  const configurationFuncs = configurationFunctions(dynamoClient, config);
  const siteTopPagesFuncs = siteTopPagesFunctions(dynamoClient, config);
  const importJobFuncs = importJobFunctions(dynamoClient, config, log);
  const importUrlFuncs = importUrlFunctions(dynamoClient, config, log);
  const experimentFuncs = experimentFunctions(dynamoClient, config, log);

  return {
    ...auditFuncs,
    ...keyEventFuncs,
    ...siteFuncs,
    ...siteCandidateFuncs,
    ...organizationFuncs,
    ...configurationFuncs,
    ...siteTopPagesFuncs,
    ...importJobFuncs,
    ...importUrlFuncs,
    ...experimentFuncs,
  };
};
