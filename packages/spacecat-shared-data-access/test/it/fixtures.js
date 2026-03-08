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

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const filePath = fileURLToPath(import.meta.url);
const directoryPath = path.dirname(filePath);
const REPO_ROOT = path.resolve(directoryPath, '..', '..');
const COMPOSE_FILE = path.resolve(directoryPath, 'postgrest', 'docker-compose.yml');
const TENANT_SEED_DIR = path.resolve(directoryPath, 'seed', 'tenants');
const IT_POSTGREST_PORT = process.env.IT_POSTGREST_PORT || '3300';
const POSTGREST_URL = `http://127.0.0.1:${IT_POSTGREST_PORT}`;
const DBMATE_URL = 'postgres://postgres:postgres@db:5432/mysticat?sslmode=disable';
const IT_SEED_MODE = process.env.IT_SEED_MODE || 'none';

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

const runCompose = async (args, options = {}) => run('docker', ['compose', '-f', COMPOSE_FILE, ...args], options);

const waitForPostgrest = async (timeoutMs = 120_000, intervalMs = 1_000) => {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(`${POSTGREST_URL}/`);
      if (response.ok) {
        return;
      }
    } catch (e) {
      // ignore while booting
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`PostgREST did not become ready at ${POSTGREST_URL} within ${timeoutMs}ms`);
};

const runSql = async (sql, sourceLabel) => {
  if (!sql || !sql.trim()) {
    return;
  }

  try {
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
    ], { input: `${sql}\n` });
  } catch (error) {
    throw new Error(`Failed running SQL from ${sourceLabel}: ${error.message}`);
  }
};

const applyMigrations = async () => {
  await runCompose([
    'run',
    '--rm',
    'data-service',
    'dbmate',
    '-d',
    'db/migrations',
    '--url',
    DBMATE_URL,
    'up',
  ]);
};

const seedTenantData = async () => {
  const seedFiles = (await fs.readdir(TENANT_SEED_DIR))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of seedFiles) {
    const absolutePath = path.resolve(TENANT_SEED_DIR, file);
    // eslint-disable-next-line no-await-in-loop
    const sql = await fs.readFile(absolutePath, 'utf-8');
    const seedSql = [
      'BEGIN;',
      'SET LOCAL session_replication_role = replica;',
      sql,
      'COMMIT;',
    ].join('\n');
    // eslint-disable-next-line no-await-in-loop
    await runSql(seedSql, absolutePath);
  }
};

export async function mochaGlobalSetup() {
  process.env.POSTGREST_URL = POSTGREST_URL;
  process.env.POSTGREST_SCHEMA = 'public';
  process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  process.env.AWS_XRAY_SDK_ENABLED = 'false';

  await runCompose(['down', '-v']).catch(() => {});
  await runCompose(['up', '-d', '--wait', 'db']);
  await applyMigrations();
  if (IT_SEED_MODE === 'tenant-sql') {
    await seedTenantData();
  } else if (IT_SEED_MODE !== 'none') {
    throw new Error(`Invalid IT_SEED_MODE: ${IT_SEED_MODE}. Expected one of: none, tenant-sql`);
  }
  await runCompose(['up', '-d', '--wait', 'data-service']);
  await waitForPostgrest();
}

export async function mochaGlobalTeardown() {
  await runCompose(['down', '-v']).catch(() => {});
}
