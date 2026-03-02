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

describe('PostgREST IT - entity parity regressions', () => {
  const dataAccess = createITDataAccess();

  it('preserves ApiKey lookup by hashedApiKey', async () => {
    const suffix = Date.now().toString(36);
    const hashedApiKey = `it-hash-${suffix}`;
    const created = await dataAccess.ApiKey.create({
      name: `it-api-key-${suffix}`,
      hashedApiKey,
      imsOrgId: `it-org-${suffix}@AdobeOrg`,
      imsUserId: `it-user-${suffix}`,
      scopes: [{ name: 'imports.read' }],
      updatedBy: 'it-suite',
    });

    const found = await dataAccess.ApiKey.findByHashedApiKey(hashedApiKey);
    expect(found).to.exist;
    expect(found.getId()).to.equal(created.getId());
    expect(found.getHashedApiKey()).to.equal(hashedApiKey);
  });

  it('preserves AsyncJob enum validation on create', async () => {
    let error;
    try {
      await dataAccess.AsyncJob.create({
        status: 'NOT_A_REAL_STATUS',
        metadata: { source: 'it' },
      });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.message).to.match(/Failed to create/);
  });

  it('preserves ImportJob<->ImportUrl relation traversal', async () => {
    const suffix = Date.now().toString(36);
    const importJob = await dataAccess.ImportJob.create({
      importQueueId: `queue-${suffix}`,
      hashedApiKey: `hash-${suffix}`,
      baseURL: `https://it-${suffix}.example.com`,
      startedAt: new Date().toISOString(),
      status: 'RUNNING',
      initiatedBy: { apiKeyName: 'it-suite' },
      hasCustomImportJs: false,
      hasCustomHeaders: false,
      updatedBy: 'it-suite',
    });

    await dataAccess.ImportUrl.createMany([
      {
        importJobId: importJob.getId(),
        status: 'COMPLETE',
        url: `https://it-${suffix}.example.com/a`,
      },
      {
        importJobId: importJob.getId(),
        status: 'FAILED',
        url: `https://it-${suffix}.example.com/b`,
      },
    ]);

    const urls = await importJob.getImportUrls();
    expect(urls).to.have.length(2);
    expect(urls.map((url) => url.getImportJobId())).to.deep.equal([
      importJob.getId(),
      importJob.getId(),
    ]);
  });
});
