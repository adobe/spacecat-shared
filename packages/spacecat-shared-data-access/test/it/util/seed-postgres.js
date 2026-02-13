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

import { PostgrestClient } from '@supabase/postgrest-js';

import { idNameToEntityName } from '../../../src/util/util.js';
import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from './db.js';

// Tables in reverse dependency order for deletion
const TABLES_REVERSE_ORDER = [
  'fix_entity_suggestions',
  'fix_entities',
  'suggestions',
  'opportunities',
  'latest_audits',
  'audits',
  'audit_urls',
  'experiments',
  'key_events',
  'site_top_pages',
  'site_top_forms',
  'site_candidates',
  'site_enrollments',
  'page_intents',
  'page_citabilities',
  'sentiment_guidelines',
  'sentiment_topics',
  'scrape_urls',
  'scrape_jobs',
  'import_urls',
  'import_jobs',
  'api_keys',
  'async_jobs',
  'entitlements',
  'trial_user_activities',
  'trial_users',
  'reports',
  'projects',
  'sites',
  'organizations',
];

const resetPostgresDatabase = async () => {
  const postgrestUrl = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
  const client = new PostgrestClient(postgrestUrl);

  for (const table of TABLES_REVERSE_ORDER) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await client.from(table).delete().neq('id', '');
    if (error) {
      // Table may not exist - that's OK for some entities
      console.log(`Warning clearing ${table}: ${error.message}`);
    }
  }
};

const seedPostgresFixtures = async () => {
  const dataAccess = getDataAccess();
  const sampleData = {};

  for (const [key, data] of Object.entries(fixtures)) {
    console.log(`Seeding ${key} (postgres)...`);

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`No data to seed for ${key}.`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const modelName = idNameToEntityName(key);

    // Skip Configuration - it uses S3 storage
    if (modelName === 'Configuration') {
      console.log(`Skipping ${key} - uses S3 storage.`);
      // eslint-disable-next-line no-continue
      continue;
    }

    // Skip KeyEvent - deprecated in v3
    if (modelName === 'KeyEvent') {
      console.log(`Skipping ${key} - deprecated in v3.`);
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
      console.error(
        `Error seeding ${key}: ${JSON.stringify(result.errorItems, null, 2)}`,
      );
      throw new Error(`Error seeding ${key}`);
    }

    console.log(`Successfully seeded ${key}.`);
  }

  return sampleData;
};

export const seedPostgresDatabase = async () => {
  await resetPostgresDatabase();
  return seedPostgresFixtures();
};
