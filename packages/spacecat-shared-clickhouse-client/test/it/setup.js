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

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE_FILE = path.join(PACKAGE_ROOT, 'docker-compose.test.yml');

export const IT_CH_URL = 'http://127.0.0.1:18123';
export const IT_CH_CONFIG = {
  url: IT_CH_URL,
  username: 'default',
  password: '',
  database: 'default',
};

const runCompose = (args) => new Promise((resolve, reject) => {
  const child = spawn('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`docker compose ${args.join(' ')} exited with code ${code}`));
    }
  });
});

// Use raw HTTP for DDL — the @clickhouse/client query() method appends FORMAT which
// is invalid for DDL statements like CREATE TABLE / TRUNCATE TABLE.
export const executeSql = async (sql) => {
  const response = await fetch(`${IT_CH_URL}/?user=default`, {
    method: 'POST',
    body: sql,
  });
  if (!response.ok) {
    throw new Error(`ClickHouse DDL failed (${response.status}): ${await response.text()}`);
  }
};

export async function mochaGlobalSetup() {
  await runCompose(['down', '-v']).catch(() => {});
  await runCompose(['up', '-d', '--wait']);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS brand_presence_executions (
      site_id                         String,
      platform                        String,
      week                            String,
      execution_date                  String,
      category                        String,
      topic                           String,
      prompt                          String,
      origin                          String DEFAULT '',
      region                          String,
      volume                          Int32 DEFAULT 0,
      user_intent                     String DEFAULT '',
      answer                          String,
      sources                         Array(String) DEFAULT [],
      citations                       Bool DEFAULT false,
      answer_contains_brandname       Bool DEFAULT false,
      sentiment                       String DEFAULT '',
      business_competitors            Array(String) DEFAULT [],
      is_answered                     Bool DEFAULT false,
      position                        Int32 DEFAULT 0,
      visibility_score                Int32 DEFAULT 0,
      detected_brand_mentions         Array(String) DEFAULT [],
      error_code                      Nullable(String),
      citation_sample_size            Nullable(Int32),
      citation_answers_with_citations Nullable(Int32),
      citation_potential              Nullable(String),
      updated_at                      String DEFAULT ''
    ) ENGINE = MergeTree()
    ORDER BY (site_id, week, execution_date)
  `);

  await executeSql(`
    CREATE TABLE IF NOT EXISTS brand_presence_competitor_data (
      site_id    String,
      platform   String,
      week       String,
      category   String,
      competitor String,
      region     String
    ) ENGINE = MergeTree()
    ORDER BY (site_id, week, competitor)
  `);
}

export async function mochaGlobalTeardown() {
  await runCompose(['down', '-v']).catch(() => {});
}
