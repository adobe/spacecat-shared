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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spawn } from 'dynamo-db-local';
import { Service } from 'electrodb';
import { v4 as uuid } from 'uuid';

import SCHEMA from '../../../docs/schema.json' with { type: 'json' };
import OpportunitySchema from '../../../src/schema/opportunity.schema.js';
import SuggestionSchema from '../../../src/schema/suggestion.schema.js';
import { sleep } from '../../unit/util.js';
import { dbClient, docClient } from '../db.js';
import { createTable, deleteTable } from '../tableOperations.js';

use(chaiAsPromised);

const DATA_TABLE_NAME = 'spacecat-services-data';

const setupDb = async (client, table) => {
  await deleteTable(client, table);

  const schema = SCHEMA.DataModel.find((model) => model.TableName === table);
  await createTable(client, schema);
};

const generateSampleData = async (dataService, siteId) => {
  for (let i = 0; i < 10; i += 1) {
    const type = i % 2 === 0 ? 'broken-backlinks' : 'broken-internal-links';
    const status = i % 2 === 0 ? 'NEW' : 'IN_PROGRESS';
    const data = type === 'broken-backlinks'
      ? { brokenLinks: [`https://another-example-${i}.com`] }
      : { brokenInternalLinks: [`https://another-example-${i}.com`] };
    // eslint-disable-next-line no-await-in-loop
    await dataService.entities.opportunity
      .create({
        siteId,
        auditId: uuid(),
        title: `Opportunity ${i}`,
        description: `Description ${i}`,
        runbook: `https://example${i}.com`,
        type,
        origin: 'AI',
        status,
        data,
      }).go();
  }
};

const createDataService = (client, table) => new Service(
  {
    opportunity: OpportunitySchema,
    suggestion: SuggestionSchema,
  },
  {
    client,
    table,
  },
);

describe('ElectroDB Integration Test', async () => {
  const siteId = uuid();

  let dynamoDbLocalProcess;
  let dataService;

  before(async function beforeSuite() {
    this.timeout(30000);

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

    dataService = createDataService(docClient, DATA_TABLE_NAME);
    await generateSampleData(dataService, siteId);
  });

  after(() => {
    dynamoDbLocalProcess.kill();
  });

  it('works', async () => {
    const Opportunity = dataService.entities.opportunity;

    const all = await Opportunity.query.bySiteId({ siteId }).go();
    const byStatus = await Opportunity.query.bySiteIdAndStatus({ siteId, status: 'NEW' }).go();

    expect(all.data).to.to.be.an('array').with.length(10);
    expect(byStatus.data).to.to.be.an('array').with.length(5);
  });
});
