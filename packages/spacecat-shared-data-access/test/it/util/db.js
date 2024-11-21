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

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// eslint-disable-next-line import/no-extraneous-dependencies
import { spawn } from 'dynamo-db-local';

import { sleep } from '../../unit/util.js';

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
      // eslint-disable-next-line no-console
      console.log('DynamoDB Local not yet started', error.message);
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(interval);
  }
  throw new Error('DynamoDB Local did not start within the expected time');
}

let dynamoDbLocalProcess = null;
let dbClient = null;
let docClient = null;

const getDynamoClients = async () => {
  if (dynamoDbLocalProcess === null) {
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

    dbClient = new DynamoDB({
      endpoint: 'http://127.0.0.1:8000',
      region: 'local',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
      },
    });
    docClient = DynamoDBDocument.from(dbClient);
  }

  return { dbClient, docClient };
};

const closeDynamoClients = async () => {
  if (dynamoDbLocalProcess) {
    dynamoDbLocalProcess.kill();
    dynamoDbLocalProcess = null;
    await sleep(2000);
  }
};

export { getDynamoClients, closeDynamoClients };
