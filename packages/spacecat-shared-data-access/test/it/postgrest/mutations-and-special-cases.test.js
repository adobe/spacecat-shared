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

import { createITDataAccess } from './helpers.js';

describe('PostgREST IT - mutations and v3 special cases', () => {
  const dataAccess = createITDataAccess();

  it('creates, updates and removes SiteCandidate', async () => {
    const suffix = Date.now().toString(36);
    const baseURL = `https://it-${suffix}.example.com`;

    const created = await dataAccess.SiteCandidate.create({
      baseURL,
      source: 'RUM',
      status: 'PENDING',
      hlxConfig: {},
    });

    expect(created).to.exist;
    const createdId = created.getId();
    expect(createdId).to.be.a('string');

    await dataAccess.SiteCandidate.updateByKeys({ siteCandidateId: createdId }, {
      status: 'APPROVED',
      updatedBy: 'it-suite',
    });

    const updated = await dataAccess.SiteCandidate.findById(createdId);
    expect(updated).to.exist;
    expect(updated.toJSON()).to.include({
      siteCandidateId: createdId,
      baseURL,
      status: 'APPROVED',
      updatedBy: 'it-suite',
    });

    await dataAccess.SiteCandidate.removeByIds([createdId]);
    const exists = await dataAccess.SiteCandidate.existsById(createdId);
    expect(exists).to.equal(false);
  });

  it('keeps KeyEvent deprecated in v3', async () => {
    let error;
    try {
      await dataAccess.KeyEvent.all();
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.include('KeyEvent is deprecated in data-access v3');
  });

  it('rejects direct LatestAudit writes', async () => {
    let error;
    try {
      await dataAccess.LatestAudit.create({
        siteId: '11111111-1111-1111-1111-111111111111',
        auditType: '404',
      });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.include(
      'LatestAudit is derived from Audit in v3 and cannot be created directly',
    );
  });
});
