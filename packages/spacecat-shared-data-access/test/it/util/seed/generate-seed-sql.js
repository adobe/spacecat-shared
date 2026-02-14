#!/usr/bin/env node
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

/**
 * Generates SQL seed file from the current database state.
 *
 * Usage: node test/it/util/seed/generate-seed-sql.js
 *
 * Prerequisites:
 * - Docker Compose stack running (docker compose -f test/it/util/docker-compose.yml up -d)
 * - JS seeding must have populated the database (run the IT suite once first)
 *
 * This script:
 * 1. Dumps the current database state to SQL INSERT statements via docker exec
 * 2. Wraps them with session_replication_role = replica (FK bypass)
 * 3. Writes to seed-data.sql
 */
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, 'seed-data.sql');

// Container name matches the docker-compose project name + service name.
const CONTAINER_NAME = 'spacecat-data-access-it-db-1';

console.log('Dumping database to SQL via docker exec...');

const sql = execSync(
  `docker exec ${CONTAINER_NAME} pg_dump `
  + '--data-only --inserts --no-owner --no-privileges '
  + '--no-comments -U postgres mysticat',
  { maxBuffer: 50 * 1024 * 1024 },
).toString();

const output = [
  '-- Auto-generated SQL seed from JS fixtures.',
  '-- Do not edit manually. Regenerate with:',
  '--   node test/it/util/seed/generate-seed-sql.js',
  '--',
  `-- Generated: ${new Date().toISOString()}`,
  '',
  'SET session_replication_role = replica;',
  '',
  sql.trim(),
  '',
  'SET session_replication_role = DEFAULT;',
  '',
].join('\n');

writeFileSync(OUTPUT_FILE, output);
console.log(`Written to ${OUTPUT_FILE} (${output.length} bytes)`);
