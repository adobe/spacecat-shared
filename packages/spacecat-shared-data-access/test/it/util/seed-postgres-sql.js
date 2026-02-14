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
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE = path.join(__dirname, 'seed', 'seed-data.sql');

// Container name matches the docker-compose project name + service name.
const CONTAINER_NAME = 'spacecat-data-access-it-db-1';

/**
 * Seeds the test database using a pre-generated SQL file.
 * Faster than JS seeding but bypasses the application layer.
 *
 * Uses `docker exec` to run psql inside the container, consistent
 * with how seed-postgres.js runs schema alterations.
 *
 * @param {object} options
 * @param {object} options.log - Logger
 */
export async function seedFromSQL({ log }) {
  if (!existsSync(SEED_FILE)) {
    throw new Error(
      `SQL seed file not found at ${SEED_FILE}. `
      + 'Generate it with: node test/it/util/seed/generate-seed-sql.js',
    );
  }

  log.info(`Seeding database from SQL: ${SEED_FILE}`);

  const sql = readFileSync(SEED_FILE, 'utf8');

  execSync(
    `docker exec -i ${CONTAINER_NAME} psql -U postgres -d mysticat`,
    {
      input: sql,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    },
  );

  log.info('SQL seeding complete');
}
