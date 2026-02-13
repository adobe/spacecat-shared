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

import { createDataAccess } from '../../../src/service/index.js';

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';

const createLogger = () => ({
  info: () => {},
  debug: () => {},
  error: () => {},
  warn: () => {},
  trace: () => {},
});

describe('PostgREST integration', () => {
  let dataAccess;

  before(() => {
    dataAccess = createDataAccess({ postgrestUrl: POSTGREST_URL }, createLogger());
  });

  it('maps snake_case DB fields back to camelCase model fields (sites.base_url -> site.baseURL)', async () => {
    const site = await dataAccess.Site.findById('0983c6da-0dee-45cc-b897-3f1fed6b460b');

    expect(site).to.exist;

    const json = site.toJSON();
    expect(json).to.have.property('baseURL').that.is.a('string');
    expect(json).to.have.property('siteId').that.is.a('string');
    expect(json).to.not.have.property('base_url');
    expect(json).to.not.have.property('baseUrl');
  });

  it('keeps LatestAudit as a virtual collection derived from audits', async () => {
    const latest = await dataAccess.LatestAudit.all({ auditType: '404' }, { limit: 5 });

    expect(latest).to.be.an('array').that.is.not.empty;
    const first = latest[0].toJSON();

    expect(first).to.have.property('siteId').that.is.a('string');
    expect(first).to.have.property('auditType').that.is.a('string');
    expect(first).to.have.property('auditedAt').that.is.a('string');
    expect(first).to.not.have.property('site_id');
  });

  it('throws a v3 deprecation error for KeyEvent', async () => {
    let error;
    try {
      await dataAccess.KeyEvent.all();
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.include('KeyEvent is deprecated in data-access v3');
  });
});
