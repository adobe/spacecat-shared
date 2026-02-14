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

import { execSync } from 'child_process';

import { PostgrestClient } from '@supabase/postgrest-js';

import { idNameToEntityName } from '../../../src/util/util.js';
import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from './db.js';

const psql = (sql) => {
  execSync(
    `docker exec spacecat-data-access-it-db-1 psql -U postgres -d mysticat -c ${JSON.stringify(sql)}`,
    { stdio: 'pipe' },
  );
};

// Tables in reverse dependency order for deletion.
// Only include tables that actually exist in the Postgres schema.
// fix_entity_suggestions uses composite key (no id column).
const TABLES_REVERSE_ORDER = [
  { table: 'fix_entity_suggestions', filter: { col: 'suggestion_id', op: 'not.is.null' } },
  { table: 'fix_entities' },
  { table: 'suggestions' },
  { table: 'opportunities' },
  { table: 'audits' },
  { table: 'audit_urls' },
  { table: 'experiments' },
  { table: 'site_top_pages' },
  { table: 'site_top_forms' },
  { table: 'site_candidates' },
  { table: 'site_enrollments' },
  { table: 'page_intents' },
  { table: 'page_citabilities' },
  { table: 'scrape_urls' },
  { table: 'scrape_jobs' },
  { table: 'import_urls' },
  { table: 'import_jobs' },
  { table: 'api_keys' },
  { table: 'async_jobs' },
  { table: 'entitlements' },
  { table: 'trial_user_activities' },
  { table: 'trial_users' },
  { table: 'reports' },
  { table: 'projects' },
  { table: 'sites' },
  { table: 'organizations' },
];

const resetPostgresDatabase = async () => {
  // Delete through PostgREST (same connection pool as inserts) to avoid
  // lock conflicts that TRUNCATE via psql can cause with PostgREST's
  // connection pool.
  const postgrestUrl = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
  const client = new PostgrestClient(postgrestUrl);

  for (const { table, filter } of TABLES_REVERSE_ORDER) {
    // Use 'id is not null' to delete all rows. This works for UUID columns
    // (unlike neq('id', '') which fails with "invalid input syntax for type uuid").
    // For tables without an 'id' column (e.g. fix_entity_suggestions), use
    // a custom filter column.
    const col = filter ? filter.col : 'id';
    // eslint-disable-next-line no-await-in-loop
    const { error } = await client.from(table).delete().not(col, 'is', null);
    if (error) {
      // Table may not exist or have different structure - that's OK
      console.log(`Warning clearing ${table}: ${error.message}`);
    }
  }
};

// Fixture keys in FK-safe insertion order (parents before children).
const SEED_ORDER = [
  'organizations',
  'projects',
  'sites',
  'entitlements',
  'trialUsers',
  'asyncJobs',
  'apiKeys',
  'importJobs',
  'scrapeJobs',
  'siteCandidates',
  'siteEnrollments',
  'experiments',
  'audits',
  'auditUrls',
  'siteTopPages',
  'siteTopForms',
  'pageIntents',
  'pageCitabilities',
  'reports',
  'importUrls',
  'scrapeUrls',
  'trialUserActivities',
  'opportunities',
  'suggestions',
  'fixEntities',
  'fixEntitySuggestions',
];

// Entities to skip in Postgres seeding.
const SKIP_ENTITIES = new Set([
  'Configuration', // uses S3 storage
  'KeyEvent', // deprecated in v3
  'LatestAudit', // derived from Audit in v3
  'SentimentGuideline', // no IT tests yet
  'SentimentTopic', // no IT tests yet
]);

const seedPostgresFixtures = async () => {
  const dataAccess = getDataAccess();
  const sampleData = {};

  for (const key of SEED_ORDER) {
    const data = fixtures[key];

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`No data to seed for ${key}.`);
      // eslint-disable-next-line no-continue
      continue;
    }

    const modelName = idNameToEntityName(key);

    if (SKIP_ENTITIES.has(modelName)) {
      console.log(`Skipping ${key} (postgres).`);
      // eslint-disable-next-line no-continue
      continue;
    }

    console.log(`Seeding ${key} (postgres)...`);

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

// All tables in the schema (used to disable/enable FK triggers during seeding).
const ALL_TABLES = TABLES_REVERSE_ORDER.map(({ table }) => table);

// Non-PK unique constraints/indexes that DynamoDB does not enforce.
// Tests create records with duplicate values that DynamoDB tolerates; Postgres rejects them.
// Dropping these during the test run mirrors DynamoDB's lack of unique enforcement.
const NON_PK_UNIQUE_CONSTRAINTS = [
  // Unique constraint: organizations.ims_org_id
  { table: 'organizations', constraint: 'organizations_ims_org_id_key' },
  // Unique constraint: site_candidates.base_url
  { table: 'site_candidates', constraint: 'site_candidates_base_url_key' },
  // Unique constraint: sites.base_url
  { table: 'sites', constraint: 'sites_base_url_key' },
  // Unique constraint: site_enrollments (site_id, entitlement_id)
  { table: 'site_enrollments', constraint: 'unique_site_entitlement' },
  // Unique constraint: experiments (site_id, exp_id)
  { table: 'experiments', constraint: 'unique_site_exp' },
  // Unique constraint: audit_urls (site_id, url)
  { table: 'audit_urls', constraint: 'unique_site_url' },
  // Unique index: api_keys.hashed_api_key
  { index: 'idx_api_keys_hashed' },
  // Unique index: page_citabilities.url
  { index: 'idx_page_citabilities_url_unique' },
  // Unique index: page_intents.url
  { index: 'idx_page_intents_url_unique' },
  // Unique index: trial_users (organization_id, email_id)
  { index: 'idx_trial_users_org_email' },
];

let schemaAltered = false;

export const alterSchemaOnce = () => {
  if (schemaAltered) return;

  // Disable FK trigger checks for the entire test run - test fixtures and test code
  // create records with random UUIDs as FK references, which DynamoDB tolerates.
  // Keeping triggers disabled mirrors DynamoDB's lack of FK enforcement.
  ALL_TABLES.forEach((table) => psql(`ALTER TABLE ${table} DISABLE TRIGGER ALL;`));

  // Drop non-PK unique constraints/indexes that DynamoDB does not enforce.
  // Tests create duplicate values that DynamoDB tolerates but Postgres rejects.
  NON_PK_UNIQUE_CONSTRAINTS.forEach(({ table, constraint, index }) => {
    if (constraint) {
      psql(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${constraint};`);
    } else if (index) {
      psql(`DROP INDEX IF EXISTS ${index};`);
    }
  });

  // Notify PostgREST to reload its schema cache after altering triggers/constraints.
  psql("NOTIFY pgrst, 'reload schema';");

  schemaAltered = true;
};

export const seedPostgresDatabase = async () => {
  alterSchemaOnce();
  await resetPostgresDatabase();
  return seedPostgresFixtures();
};
