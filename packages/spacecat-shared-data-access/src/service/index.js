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
import { siteFunctions } from './sites/index.js';
import { siteCandidateFunctions } from './site-candidates/index.js';
import { organizationFunctions } from './organizations/index.js';

/**
 * Creates a data access object.
 *
 * @param {{pkAllSites: string, pkAllLatestAudits: string, indexNameAllLatestAuditScores: string,
 * tableNameAudits: string,tableNameLatestAudits: string, indexNameAllSitesOrganizations: string,
 * tableNameSites: string, tableNameOrganizations: string, indexNameAllSites: string,
 * indexNameAllOrganizations: string, pkAllOrganizations: string}} config configuration
 * @param {Logger} log logger
 * @returns {object} data access object
 */
export const createDataAccess = (config, log = console) => {
  const dynamoClient = createClient(log);

  const auditFuncs = auditFunctions(dynamoClient, config, log);
  const siteFuncs = siteFunctions(dynamoClient, config, log);
  const siteCandidateFuncs = siteCandidateFunctions(dynamoClient, config);
  const organizationFuncs = organizationFunctions(dynamoClient, config, log);

  return {
    ...auditFuncs,
    ...siteFuncs,
    ...siteCandidateFuncs,
    ...organizationFuncs,
  };
};
