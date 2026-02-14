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

import { getDataAccess, getDynamoClients, TEST_DA_CONFIG } from './db.js';
import { createTablesFromSchema, deleteExistingTables } from './tableOperations.js';
import { seedPostgresDatabase, alterSchemaOnce } from './seed-postgres.js';
import { seedFromSQL } from './seed-postgres-sql.js';

const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

const resetDynamoDatabase = async () => {
  const { dbClient } = getDynamoClients();
  await deleteExistingTables(dbClient, [
    TEST_DA_CONFIG.tableNameApiKeys,
    TEST_DA_CONFIG.tableNameAudits,
    TEST_DA_CONFIG.tableNameConfigurations,
    TEST_DA_CONFIG.tableNameData,
    TEST_DA_CONFIG.tableNameExperiments,
    TEST_DA_CONFIG.tableNameImportJobs,
    TEST_DA_CONFIG.tableNameImportUrls,
    TEST_DA_CONFIG.tableNameScrapeJobs,
    TEST_DA_CONFIG.tableNameScrapeUrls,
    TEST_DA_CONFIG.tableNameKeyEvents,
    TEST_DA_CONFIG.tableNameLatestAudits,
    TEST_DA_CONFIG.tableNameOrganizations,
    TEST_DA_CONFIG.tableNameSiteCandidates,
    TEST_DA_CONFIG.tableNameSiteTopPages,
    TEST_DA_CONFIG.tableNameSites,
    TEST_DA_CONFIG.tableNamePageIntents,
    TEST_DA_CONFIG.tableNamePageCitabilities,
  ]);
  await createTablesFromSchema(dbClient);
};

const seedDynamoFixtures = async () => {
  const dataAccess = getDataAccess();
  const sampleData = {};

  for (const [key, data] of Object.entries(fixtures)) {
    console.log(`Seeding ${key}...`);

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`No data to seed for ${key}.`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const modelName = idNameToEntityName(key);

    // Skip Configuration - it uses S3 storage and doesn't support createMany().
    // Configuration IT tests set up their own mock S3 client.
    if (modelName === 'Configuration') {
      console.log(`Skipping ${key} - uses S3 storage.`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const Model = dataAccess[modelName];

    if (!Model) {
      throw new Error(`Model not found for ${modelName}`);
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await Model.createMany(data);
    sampleData[key] = result.createdItems;

    if (result.errorItems.length > 0) {
      throw new Error(
        `Error seeding ${key}: ${JSON.stringify(result.errorItems, null, 2)}`,
      );
    }

    console.log(`Successfully seeded ${key}.`);
  }

  return sampleData;
};

const seedDynamoDatabase = async () => {
  await resetDynamoDatabase();
  return seedDynamoFixtures();
};

const seedMode = process.env.IT_SEED_MODE || 'js';

export const seedDatabase = async () => {
  if (backend === 'postgresql') {
    if (seedMode === 'sql') {
      // SQL seeding still needs the schema alterations (disable FK triggers,
      // drop unique constraints) so tests can create records freely.
      alterSchemaOnce();
      await seedFromSQL({ log: console });
      return {};
    }
    return seedPostgresDatabase();
  }
  return seedDynamoDatabase();
};
