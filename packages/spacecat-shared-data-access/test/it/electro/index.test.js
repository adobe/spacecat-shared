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

/* eslint-env mocha */
/* eslint-disable no-console */

import AWSXRay from 'aws-xray-sdk';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spawn } from 'dynamo-db-local';
import { v4 as uuid, validate as uuidValidate } from 'uuid';

import { isIsoDate } from '@adobe/spacecat-shared-utils';
import SCHEMA from '../../../docs/schema.json' with { type: 'json' };
import { sleep } from '../../unit/util.js';
import { dbClient } from '../db.js';
import { createTable, deleteTable } from '../tableOperations.js';
import { createDataAccess } from '../../../src/service/index.js';

use(chaiAsPromised);

const DATA_TABLE_NAME = 'spacecat-services-data';

const setupDb = async (client, table) => {
  await deleteTable(client, table);

  const schema = SCHEMA.DataModel.find((model) => model.TableName === table);
  await createTable(client, schema);
};

const generateSampleData = async (dataAccess, siteId) => {
  const { Opportunity } = dataAccess;
  const sampleData = [];

  for (let i = 0; i < 10; i += 1) {
    const type = i % 2 === 0 ? 'broken-backlinks' : 'broken-internal-links';
    const status = i % 2 === 0 ? 'NEW' : 'IN_PROGRESS';
    const data = type === 'broken-backlinks'
      ? { brokenLinks: [`https://another-example-${i}.com`] }
      : { brokenInternalLinks: [`https://another-example-${i}.com`] };

    // eslint-disable-next-line no-await-in-loop
    const opportunity = await Opportunity.create({
      siteId,
      auditId: uuid(),
      title: `Opportunity ${i}`,
      description: `Description ${i}`,
      runbook: `https://example${i}.com`,
      type,
      origin: 'AI',
      status,
      data,
    });

    sampleData.push(opportunity);
  }

  return sampleData;
};

describe('ElectroDB Integration Test', () => {
  // AWSXRay.enableManualMode();
  const siteId = uuid();

  let dynamoDbLocalProcess;
  let dataAccess;
  let sampleData;

  before(async function beforeSuite() {
    this.timeout(30000);

    AWSXRay.setContextMissingStrategy(() => {});
    AWSXRay.enableAutomaticMode();

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

    await sleep(2000); // give db time to start up

    await setupDb(dbClient, DATA_TABLE_NAME);

    dataAccess = createDataAccess({ tableNameData: DATA_TABLE_NAME }, console);

    sampleData = await generateSampleData(dataAccess, siteId);
  });

  after(() => {
    dynamoDbLocalProcess.kill();
  });

  it('finds one opportunity by id', async () => {
    const { Opportunity } = dataAccess;

    const opportunity = await Opportunity.findById(sampleData[0].getId());

    expect(opportunity).to.be.an('object');
    expect(opportunity.record).to.eql(sampleData[0].record);
  });

  it('finds all opportunities by siteId', async () => {
    const { Opportunity } = dataAccess;

    const opportunities = await Opportunity.allBySiteId(siteId);

    expect(opportunities).to.be.an('array').with.length(10);
  });

  it('creates a new opportunity', async () => {
    const { Opportunity } = dataAccess;
    const data = {
      siteId,
      auditId: uuid(),
      title: 'New Opportunity',
      description: 'Description',
      runbook: 'https://example.com',
      type: 'broken-backlinks',
      origin: 'AI',
      status: 'NEW',
      data: { brokenLinks: ['https://example.com'] },
    };

    const opportunity = await Opportunity.create(data);

    expect(opportunity).to.be.an('object');

    expect(uuidValidate(opportunity.getId())).to.be.true;
    expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
    expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

    delete opportunity.record.opportunityId;
    delete opportunity.record.createdAt;
    delete opportunity.record.updatedAt;
    expect(opportunity.record).to.eql(data);
  });
});
