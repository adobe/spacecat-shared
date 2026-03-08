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

describe('PostgREST IT - audit and latest-audit', () => {
  const dataAccess = createITDataAccess();

  it('reads Audit by id using PostgREST-backed collection', async () => {
    const audit = await dataAccess.Audit.findById(TEST_IDS.auditId);

    expect(audit).to.exist;
    expect(audit.toJSON()).to.include({
      auditId: TEST_IDS.auditId,
      siteId: TEST_IDS.siteId,
      auditType: '404',
    });
  });

  it('computes LatestAudit from Audit records', async () => {
    const latest = await dataAccess.LatestAudit.findById(TEST_IDS.siteId, '404');

    expect(latest).to.exist;
    expect(latest.getSiteId()).to.equal(TEST_IDS.siteId);
    expect(latest.getAuditType()).to.equal('404');

    const newestAudit = await dataAccess.Audit.findByIndexKeys(
      { siteId: TEST_IDS.siteId, auditType: '404' },
      { order: 'desc' },
    );

    expect(newestAudit).to.exist;
    expect(latest.getId()).to.equal(newestAudit.getId());
    expect(latest.getAuditedAt()).to.equal(newestAudit.getAuditedAt());
  });

  it('returns grouped latest records for audit type', async () => {
    const latest = await dataAccess.LatestAudit.all({ auditType: '404' }, { limit: 10 });

    expect(latest).to.be.an('array').that.is.not.empty;
    latest.forEach((item) => {
      const json = item.toJSON();
      expect(json.auditType).to.equal('404');
      expect(json).to.not.have.property('site_id');
    });
  });
});
