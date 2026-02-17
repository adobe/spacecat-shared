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

describe('PostgREST IT - field mapping', () => {
  const dataAccess = createITDataAccess();

  it('maps snake_case fields to model camelCase for Site', async () => {
    const site = await dataAccess.Site.findById(TEST_IDS.siteId);

    expect(site).to.exist;
    const json = site.toJSON();

    expect(json).to.have.property('siteId', TEST_IDS.siteId);
    expect(json).to.have.property('baseURL', TEST_VALUES.siteBaseURL);
    expect(json).to.have.property('organizationId', TEST_IDS.organizationId);
    expect(json).to.not.have.property('id');
    expect(json).to.not.have.property('base_url');
    expect(json).to.not.have.property('baseUrl');
    expect(json).to.not.have.property('organization_id');
  });

  it('keeps camelCase in selected attributes path as well', async () => {
    const site = await dataAccess.Site.findById(TEST_IDS.siteId);
    const json = site.toJSON();

    expect(json.baseURL).to.equal(TEST_VALUES.siteBaseURL);
    expect(json.siteId).to.equal(TEST_IDS.siteId);
  });
});
