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

/* eslint-env mocha */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

const isPostgres = process.env.DATA_ACCESS_BACKEND === 'postgresql';

// Collections where every public method throws 'deprecated'.
const DEPRECATED_COLLECTIONS = ['KeyEvent'];

// Collections that do not support standard all()/findById() signatures.
// - Configuration: S3-backed, different API (no all(), findById takes no UUID).
// - LatestAudit: virtual view over Audit; findById requires (siteId, auditType).
// - AuditUrl: findById requires (siteId, url), not a single UUID.
// - SentimentGuideline: findById requires (siteId, guidelineId).
// - SentimentTopic: findById requires (siteId, topicId).
// - FixEntitySuggestion: junction table with composite PK, no single ID.
const SKIP_STANDARD_READ = [
  'Configuration',
  'LatestAudit',
  'AuditUrl',
  'FixEntitySuggestion',
  'SentimentGuideline',
  'SentimentTopic',
];

// Non-existent UUID for findById smoke probes.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// This smoke test is designed for the Postgres/PostgREST backend.
// On DynamoDB, collections like ApiKey require composite key attributes for all(),
// and KeyEvent deprecation only exists in the Postgres path.
(isPostgres ? describe : describe.skip)('Postgres Collections Smoke Test', function () {
  this.timeout(30000);

  let dataAccess;
  let collectionNames;

  before(async function () {
    this.timeout(30000);
    await seedDatabase();
    dataAccess = getDataAccess();

    // Dynamically discover every collection exposed on the dataAccess object.
    collectionNames = Object.keys(dataAccess).filter(
      (key) => typeof dataAccess[key] === 'object' && dataAccess[key] !== null,
    );
  });

  it('discovers at least 20 collections', () => {
    expect(collectionNames.length).to.be.at.least(20);
  });

  describe('read operations', () => {
    it('all() returns an array for every standard collection', async () => {
      const standardCollections = collectionNames.filter(
        (name) => !DEPRECATED_COLLECTIONS.includes(name)
          && !SKIP_STANDARD_READ.includes(name),
      );

      for (const name of standardCollections) {
        const collection = dataAccess[name];
        // eslint-disable-next-line no-await-in-loop
        const result = await collection.all();
        expect(result, `${name}.all() should return an array`).to.be.an('array');
      }
    });

    it('findById(NIL_UUID) returns null for every standard collection', async () => {
      const standardCollections = collectionNames.filter(
        (name) => !DEPRECATED_COLLECTIONS.includes(name)
          && !SKIP_STANDARD_READ.includes(name),
      );

      for (const name of standardCollections) {
        const collection = dataAccess[name];
        // eslint-disable-next-line no-await-in-loop
        const result = await collection.findById(NIL_UUID);
        expect(result, `${name}.findById(NIL_UUID) should return null`).to.be.null;
      }
    });
  });

  describe('deprecated collections', () => {
    it('KeyEvent.all() throws with "deprecated"', async () => {
      await expect(dataAccess.KeyEvent.all())
        .to.be.rejectedWith(/deprecated/i);
    });
  });
});
