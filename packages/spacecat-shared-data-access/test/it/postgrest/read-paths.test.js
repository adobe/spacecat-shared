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

import { createITDataAccess, TEST_IDS, TEST_VALUES } from './helpers.js';

describe('PostgREST IT - read paths', () => {
  const dataAccess = createITDataAccess();

  it('reads Organization and Project by id', async () => {
    const organization = await dataAccess.Organization.findById(TEST_IDS.organizationId);
    const project = await dataAccess.Project.findById(TEST_IDS.projectId);

    expect(organization).to.exist;
    expect(project).to.exist;

    expect(project.toJSON()).to.include({
      projectId: TEST_IDS.projectId,
      organizationId: TEST_IDS.organizationId,
      projectName: TEST_VALUES.projectName,
    });
  });

  it('resolves Site by preview URL through custom collection logic', async () => {
    const site = await dataAccess.Site.findByIndexKeys({
      externalOwnerId: 'p50513',
      externalSiteId: 'e440257',
    });

    expect(site).to.exist;
    expect([TEST_IDS.siteId, TEST_IDS.siteIdSecondary]).to.include(site.getId());
  });

  it('reads site by baseURL through index keys', async () => {
    const site = await dataAccess.Site.findByIndexKeys({
      baseURL: TEST_VALUES.siteBaseURL,
    });

    expect(site).to.exist;
    expect(site.getId()).to.equal(TEST_IDS.siteId);
  });

  it('supports batchGetByKeys for Site ids', async () => {
    const result = await dataAccess.Site.batchGetByKeys([
      { siteId: TEST_IDS.siteId },
      { siteId: TEST_IDS.siteIdSecondary },
    ]);

    expect(result.unprocessed).to.deep.equal([]);
    expect(result.data.map((site) => site.getId())).to.include(TEST_IDS.siteId);
    expect(result.data.map((site) => site.getId())).to.include(TEST_IDS.siteIdSecondary);
  });
});
