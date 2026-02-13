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

// eslint-disable-next-line import/no-extraneous-dependencies
import { spawn } from 'dynamo-db-local';

import { sleep } from '../unit/util.js';

const backend = process.env.DATA_ACCESS_BACKEND || 'dynamodb';

let dynamoDbLocalProcess = null;

async function waitForDynamoDBStartup(url, timeout = 20000, interval = 500) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url);
      if (response.status === 400) {
        return;
      }
    } catch (error) {
      console.log('DynamoDB Local not yet started', error.message);
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(interval);
  }
  throw new Error('DynamoDB Local did not start within the expected time');
}

async function waitForPostgREST(url, timeout = 30000, interval = 1000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      console.log('PostgREST not yet ready', error.message);
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(interval);
  }
  throw new Error('PostgREST did not start within the expected time');
}

/**
 * This function is called once before any tests are executed. It is used to start
 * any services that are required for the tests, such as a local DynamoDB instance.
 * See https://mochajs.org/#global-fixtures
 * @return {Promise<void>}
 */
export async function mochaGlobalSetup() {
  console.log(`mochaGlobalSetup (backend: ${backend})`);

  if (backend === 'postgresql') {
    const postgrestUrl = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
    console.log(`Waiting for PostgREST at ${postgrestUrl}...`);
    await waitForPostgREST(postgrestUrl);
    console.log('PostgREST is ready.');
  } else {
    process.env.AWS_REGION = 'local';
    process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://127.0.0.1:8000';
    process.env.AWS_DEFAULT_REGION = 'local';
    process.env.AWS_ACCESS_KEY_ID = 'dummy';
    process.env.AWS_SECRET_ACCESS_KEY = 'dummy';

    dynamoDbLocalProcess = spawn({
      detached: true,
      stdio: 'inherit',
      port: 8000,
      sharedDb: true,
    });

    await waitForDynamoDBStartup('http://127.0.0.1:8000');

    process.on('SIGINT', () => {
      if (dynamoDbLocalProcess) {
        dynamoDbLocalProcess.kill();
      }
      process.exit();
    });
  }
}

/**
 * This function is called once after all tests are executed. It is used to clean up
 * any services that were started in mochaGlobalSetup.
 * See: https://mochajs.org/#global-fixtures
 * @return {Promise<void>}
 */
export async function mochaGlobalTeardown() {
  console.log(`mochaGlobalTeardown (backend: ${backend})`);

  if (backend === 'postgresql') {
    // Docker Compose lifecycle is managed externally (start/stop outside of tests)
    console.log('PostgreSQL teardown: no-op (managed externally).');
  } else {
    dynamoDbLocalProcess.kill();
    dynamoDbLocalProcess = null;
  }
}
