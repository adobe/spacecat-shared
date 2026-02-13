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

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { createDataAccess } from '../../../src/service/index.js';

const filePath = fileURLToPath(import.meta.url);
const directoryPath = path.dirname(filePath);
const REPO_ROOT = path.resolve(directoryPath, '..', '..', '..');
const COMPOSE_FILE = path.resolve(REPO_ROOT, 'test', 'it', 'postgrest', 'docker-compose.yml');

const run = (cmd, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, {
    cwd: REPO_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve({ stdout, stderr });
      return;
    }

    reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}\n${stderr || stdout}`));
  });

  if (options.input) {
    child.stdin.write(options.input);
  }
  child.stdin.end();
});

const runCompose = async (args, options = {}) => run(
  'docker',
  ['compose', '-f', COMPOSE_FILE, ...args],
  options,
);

export const resetPostgresDatabase = async () => {
  const resetSql = `
DO $$
DECLARE
  stmt text;
BEGIN
  SELECT 'TRUNCATE TABLE '
    || string_agg(format('%I.%I', schemaname, tablename), ', ')
    || ' RESTART IDENTITY CASCADE'
    INTO stmt
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> 'schema_migrations';

  IF stmt IS NOT NULL THEN
    EXECUTE stmt;
  END IF;
END $$;
`;

  await runCompose([
    'exec',
    '-T',
    'db',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'mysticat',
  ], { input: resetSql });
};

export const setPostgresTriggersEnabled = async (enabled) => {
  const action = enabled ? 'ENABLE' : 'DISABLE';
  const triggerSql = `
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ${action} TRIGGER ALL', rec.schemaname, rec.tablename);
  END LOOP;
END $$;
`;

  await runCompose([
    'exec',
    '-T',
    'db',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'mysticat',
  ], { input: triggerSql });
};

export const getDataAccess = (config = {}, logger = console) => {
  // eslint-disable-next-line no-param-reassign
  logger.debug = () => {};

  const postgrestUrl = config.postgrestUrl || process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
  const postgrestSchema = config.postgrestSchema || process.env.POSTGREST_SCHEMA || 'public';

  return createDataAccess({
    postgrestUrl,
    postgrestSchema,
    postgrestApiKey: config.postgrestApiKey || process.env.POSTGREST_API_KEY,
    s3Bucket: config.s3Bucket || process.env.S3_CONFIG_BUCKET,
    region: config.region || process.env.AWS_REGION,
  }, logger);
};
