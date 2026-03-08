/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { idNameToEntityName } from '../../../src/util/util.js';
import fixtures from '../../fixtures/index.fixtures.js';

import {
  getDataAccess,
  resetPostgresDatabase,
  setPostgresTriggersEnabled,
} from './db.js';

const NOOP = () => {};
const seedLogger = {
  log: NOOP,
  info: NOOP,
  debug: NOOP,
  warn: NOOP,
  error: NOOP,
};

const SEED_PRIORITY = [
  'organizations',
  'projects',
  'sites',
  'entitlements',
  'trialUsers',
  'siteEnrollments',
  'apiKeys',
  'siteCandidates',
  'consumers',
  'importJobs',
  'importUrls',
  'scrapeJobs',
  'scrapeUrls',
  'audits',
  'auditUrls',
  'experiments',
  'opportunities',
  'suggestions',
  'fixEntities',
  'fixEntitySuggestions',
  'pageIntents',
  'reports',
  'trialUserActivities',
  'siteTopForms',
  'siteTopPages',
  'pageCitabilities',
  'sentimentTopics',
  'sentimentGuidelines',
];

const getSeedPriority = (key) => {
  const index = SEED_PRIORITY.indexOf(key);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const collectErrorDetails = (error) => {
  const messages = [];
  const codes = [];
  let current = error;
  while (current) {
    if (current.message) {
      messages.push(current.message);
    }
    if (current.code) {
      codes.push(current.code);
    }
    current = current.cause;
  }
  return {
    message: messages.join(' | '),
    codes,
  };
};

const MISSING_DB_FIELD_CODES = new Set([
  'PGRST204', // PostgREST schema cache missing column/table metadata
  '42703', // PostgreSQL undefined_column
]);

const isMissingDbFieldError = ({ message, codes }) => (
  Array.isArray(codes) && codes.some((code) => MISSING_DB_FIELD_CODES.has(code))
)
  || (
    message.includes('Could not find the')
      && message.includes('column')
      && message.includes('schema cache')
  );

const isForeignKeyError = ({ message, codes }) => message.includes('violates foreign key constraint')
  || codes.includes('23503');

const classifyError = (error) => collectErrorDetails(error);

const seedItemsOneByOne = async (Model, key, items) => {
  const createdItems = [];
  const unresolvedItems = [];

  for (const item of items) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const created = await Model.create(item);
      createdItems.push(created);
    } catch (error) {
      const details = classifyError(error);
      if (isMissingDbFieldError(details)) {
        console.log(`Skipping one ${key} record - schema mismatch for v3 test DB (${details.message}).`);
        // eslint-disable-next-line no-continue
        continue;
      }
      if (isForeignKeyError(details)) {
        unresolvedItems.push(item);
        // eslint-disable-next-line no-continue
        continue;
      }
      throw error;
    }
  }

  return { createdItems, unresolvedItems };
};

const seedV2Fixtures = async () => {
  const dataAccess = getDataAccess({}, seedLogger);
  const sampleData = {};
  const skippedModels = new Set(['Configuration', 'KeyEvent']);
  const pending = Object.entries(fixtures)
    .sort(([a], [b]) => getSeedPriority(a) - getSeedPriority(b))
    .map(([key, data]) => [key, Array.isArray(data) ? [...data] : data]);

  let madeProgress = true;
  while (pending.length > 0 && madeProgress) {
    madeProgress = false;

    for (let i = 0; i < pending.length; i += 1) {
      const [key, data] = pending[i];

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`No data to seed for ${key}.`);
        pending.splice(i, 1);
        i -= 1;
        madeProgress = true;
        // eslint-disable-next-line no-continue
        continue;
      }

      const modelName = idNameToEntityName(key);

      // Skip models with special v3 handling:
      // - Configuration remains S3-backed and is tested separately with mock S3 setup.
      // - KeyEvent is deprecated in v3.
      if (skippedModels.has(modelName)) {
        console.log(`Skipping ${key} - unsupported for generic fixture seeding in v3.`);
        pending.splice(i, 1);
        i -= 1;
        madeProgress = true;
        // eslint-disable-next-line no-continue
        continue;
      }

      const Model = dataAccess[modelName];

      if (!Model) {
        throw new Error(`Model not found for ${modelName}`);
      }

      if (modelName === 'Consumer') {
        // Consumer intentionally disables createMany() due to allowlist/capability/clientId checks.
        // Seed row-by-row and still honor FK deferral logic from this generic seeder.
        // eslint-disable-next-line no-await-in-loop
        const { createdItems, unresolvedItems } = await seedItemsOneByOne(Model, key, data);
        sampleData[key] = [...(sampleData[key] || []), ...createdItems];

        if (unresolvedItems.length === 0) {
          pending.splice(i, 1);
          i -= 1;
          madeProgress = true;
          // eslint-disable-next-line no-continue
          continue;
        }

        if (unresolvedItems.length < data.length) {
          console.log(`Partially seeded ${key}; deferring ${unresolvedItems.length} records.`);
          pending[i] = [key, unresolvedItems];
          madeProgress = true;
          // eslint-disable-next-line no-continue
          continue;
        }

        console.log(`Deferring ${key} - waiting for dependency tables.`);
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await Model.createMany(data);
        sampleData[key] = [...(sampleData[key] || []), ...result.createdItems];

        if (result.errorItems.length > 0) {
          throw new Error(`Error seeding ${key}: ${JSON.stringify(result.errorItems, null, 2)}`);
        }
        pending.splice(i, 1);
        i -= 1;
        madeProgress = true;
      } catch (error) {
        const details = classifyError(error);
        const isMissingDbField = isMissingDbFieldError(details);
        const isForeignKeyDependency = isForeignKeyError(details);

        if (isMissingDbField) {
          console.log(`Skipping ${key} - schema mismatch for v3 test DB (${details.message}).`);
          pending.splice(i, 1);
          i -= 1;
          madeProgress = true;
          // eslint-disable-next-line no-continue
          continue;
        }

        if (isForeignKeyDependency) {
          // Bulk insert can fail if only a subset has unresolved dependencies.
          // Retry row-by-row to salvage valid rows and keep only unresolved rows pending.
          // eslint-disable-next-line no-await-in-loop
          const { createdItems, unresolvedItems } = await seedItemsOneByOne(Model, key, data);
          sampleData[key] = [...(sampleData[key] || []), ...createdItems];

          if (unresolvedItems.length === 0) {
            console.log(`Successfully seeded ${key} after row-level retries.`);
            pending.splice(i, 1);
            i -= 1;
            madeProgress = true;
            // eslint-disable-next-line no-continue
            continue;
          }

          if (unresolvedItems.length < data.length) {
            console.log(`Partially seeded ${key}; deferring ${unresolvedItems.length} records.`);
            pending[i] = [key, unresolvedItems];
            madeProgress = true;
            // eslint-disable-next-line no-continue
            continue;
          }

          console.log(`Deferring ${key} - waiting for dependency tables.`);
          // eslint-disable-next-line no-continue
          continue;
        }

        throw error;
      }
    }
  }

  if (pending.length > 0) {
    const unresolved = pending.map(([key]) => key).join(', ');
    console.log(`Leaving unresolved fixture groups for this run: ${unresolved}`);
  }

  return sampleData;
};

export const seedDatabase = async () => {
  await resetPostgresDatabase();
  await setPostgresTriggersEnabled(false);
  try {
    return await seedV2Fixtures();
  } finally {
    await setPostgresTriggersEnabled(true);
  }
};
