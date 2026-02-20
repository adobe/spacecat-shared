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

import { expect } from 'chai';

import { createITDataAccess, TEST_IDS } from './helpers.js';

describe('PostgREST IT - seed integrity', () => {
  const dataAccess = createITDataAccess();

  it('contains expected IDs required by IT helpers', async () => {
    const [organization, project, site, secondarySite, audit] = await Promise.all([
      dataAccess.Organization.findById(TEST_IDS.organizationId),
      dataAccess.Project.findById(TEST_IDS.projectId),
      dataAccess.Site.findById(TEST_IDS.siteId),
      dataAccess.Site.findById(TEST_IDS.siteIdSecondary),
      dataAccess.Audit.findById(TEST_IDS.auditId),
    ]);

    expect(organization, 'missing TEST_IDS.organizationId').to.exist;
    expect(project, 'missing TEST_IDS.projectId').to.exist;
    expect(site, 'missing TEST_IDS.siteId').to.exist;
    expect(secondarySite, 'missing TEST_IDS.siteIdSecondary').to.exist;
    expect(audit, 'missing TEST_IDS.auditId').to.exist;
  });
});
