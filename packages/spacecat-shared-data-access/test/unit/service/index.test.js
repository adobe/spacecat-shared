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

/* eslint-env mocha */

import { expect } from 'chai';
import { createDataAccess } from '../../../src/service/index.js';

describe('Data Access Object Tests', () => {
  const auditFunctions = [
    'addAudit',
    'getAuditForSite',
    'getAuditsForSite',
    'getLatestAudits',
    'getLatestAuditForSite',
    'getLatestAuditsForSite',
    'removeAuditsForSite',
  ];
  const siteFunctions = [
    'addSite',
    'updateSite',
    'removeSite',
    'removeSitesForOrganization',
    'getSites',
    'getSitesByDeliveryType',
    'getSitesByOrganizationID',
    'getSitesToAudit',
    'getSitesWithLatestAudit',
    'getSitesByOrganizationIDWithLatestAudits',
    'getSiteByBaseURL',
    'getSiteByBaseURLWithAuditInfo',
    'getSiteByBaseURLWithAudits',
    'getSiteByBaseURLWithLatestAudit',
    'getSiteByID',
  ];

  const siteCandidateFunctions = [
    'getSiteCandidates',
    'getSiteCandidateByBaseURL',
    'upsertSiteCandidate',
    'siteCandidateExists',
    'updateSiteCandidate',
  ];

  const organizationFunctions = [
    'getOrganizations',
    'getOrganizationByID',
    'addOrganization',
    'updateOrganization',
    'removeOrganization',
    'getOrganizationByImsOrgID',
  ];

  const configurationFunctions = [
    'getConfiguration',
    'getConfigurations',
    'getConfigurationByVersion',
    'updateConfiguration',
  ];

  const siteTopPagesFunctions = [
    'getTopPagesForSite',
    'addSiteTopPage',
    'removeSiteTopPages',
  ];

  const keyEventsFunctions = [
    'createKeyEvent',
    'getKeyEventsForSite',
    'removeKeyEvent',
  ];

  const importJobFunctions = [
    'getImportJobByID',
    'getImportJobsByStatus',
    'createNewImportJob',
    'updateImportJob',
    'getImportJobsByDateRange',
    'removeImportJob',
  ];

  const importUrlFunctions = [
    'getImportUrlById',
    'createNewImportUrl',
    'updateImportUrl',
    'getImportUrlsByJobIdAndStatus',
    'getImportUrlsByJobId',
  ];

  const experimentFunctions = [
    'getExperiments',
    'upsertExperiment',
    'getExperiment',
  ];

  const apiKeyFunctions = [
    'getApiKeyByHashedApiKey',
    'createNewApiKey',
    'updateApiKey',
    'getApiKeysByImsUserIdAndImsOrgId',
    'getApiKeyById',
  ];

  const electroServiceFunctions = [
    'ApiKey',
    'Audit',
    'Configuration',
    'Experiment',
    'ImportJob',
    'ImportUrl',
    'KeyEvent',
    'LatestAudit',
    'Opportunity',
    'Organization',
    'Site',
    'SiteCandidate',
    'SiteTopPage',
    'Suggestion',
  ];

  let dao;

  before(() => {
    dao = createDataAccess({ tableNameData: 'test' });
  });

  it('contains all known audit functions', () => {
    auditFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known site functions', () => {
    siteFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known site candidate functions', () => {
    siteCandidateFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known site top pages functions', () => {
    siteTopPagesFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known key events functions', () => {
    keyEventsFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known importJob functions', () => {
    importJobFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known importUrl functions', () => {
    importUrlFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('contains all known apiKey functions', () => {
    apiKeyFunctions.forEach((funcName) => {
      expect(dao).to.have.property(funcName);
    });
  });

  it('does not contain any unexpected functions', () => {
    const expectedFunctions = new Set([
      ...auditFunctions,
      ...keyEventsFunctions,
      ...siteFunctions,
      ...siteCandidateFunctions,
      ...organizationFunctions,
      ...configurationFunctions,
      ...siteTopPagesFunctions,
      ...importJobFunctions,
      ...importUrlFunctions,
      ...experimentFunctions,
      ...apiKeyFunctions,
      ...electroServiceFunctions,
    ]);
    Object.keys(dao).forEach((funcName) => {
      expect(expectedFunctions).to.include(funcName);
    });
  });
});
