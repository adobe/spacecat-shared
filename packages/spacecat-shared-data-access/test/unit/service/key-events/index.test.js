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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { keyEventFunctions } from '../../../../src/service/key-events/index.js';
import { KEY_EVENT_TYPES } from '../../../../src/models/key-event.js';

use(chaiAsPromised);
use(sinonChai);

const TEST_DA_CONFIG = {
  tableNameKeyEvents: 'spacecat-services-key-events',
  indexNameAllKeyEventsBySiteId: 'spacecat-services-key-events-by-site-id',
};

const mockDate = '2023-11-27T12:30:01.124Z';
const sandbox = sinon.createSandbox();

describe('Site Candidate Functions Tests', () => {
  let mockDynamoClient;
  let mockLog = {};
  let exportedFunctions;
  const siteId = 'some-site';

  beforeEach(() => {
    mockDynamoClient = {
      query: sandbox.stub().resolves([]),
      putItem: sandbox.stub().resolves(null),
      removeItem: sandbox.stub().resolves(),
    };

    mockLog = {
      info: sandbox.stub().resolves(),
      error: sandbox.stub().resolves(),
    };

    exportedFunctions = keyEventFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
  });

  before('setup', function () {
    this.clock = sandbox.useFakeTimers({
      now: new Date(mockDate).getTime(),
    });
  });

  after('clean', () => {
    sandbox.restore();
  });

  it('creates a new key event successfully', async () => {
    const keyEventData = { siteId, name: 'some-key-event', type: KEY_EVENT_TYPES.SEO };

    await exportedFunctions.createKeyEvent(keyEventData);

    const [tableName, keyEvent] = mockDynamoClient.putItem.getCall(0).args;

    expect(mockDynamoClient.putItem.calledOnce).to.be.true;
    expect(tableName).to.equal(TEST_DA_CONFIG.tableNameKeyEvents);
    expect(keyEvent).to.not.have.property('getId');
    expect(keyEvent.siteId).to.equal(keyEventData.siteId);
    expect(keyEvent.name).to.equal(keyEventData.name);
    expect(keyEvent.type).to.equal(keyEventData.type);
  });

  it('returns the key event by site id', async () => {
    const id = 'some-id';
    const keyEventData = {
      id, siteId, name: 'some-key-event', type: KEY_EVENT_TYPES.CODE,
    };
    mockDynamoClient.query.returns(Promise.resolve([keyEventData]));

    const result = await exportedFunctions.getKeyEventsForSite(siteId);

    expect(result[0].getId()).to.equal(keyEventData.id);
    expect(result[0].getSiteId()).to.equal(keyEventData.siteId);
    expect(result[0].getName()).to.equal(keyEventData.name);
    expect(result[0].getType()).to.equal(keyEventData.type);
  });

  it('remove the key event by key event id', async () => {
    const id = 'some-id';
    await exportedFunctions.removeKeyEvent(id);

    expect(mockDynamoClient.removeItem).to.have.been.calledWith(
      TEST_DA_CONFIG.tableNameKeyEvents,
      { id },
    );
  });

  it('error handled when key event removal fails', async () => {
    const id = 'some-id';
    mockDynamoClient.removeItem = sandbox.stub().rejects(new Error('some error happened'));

    await expect(exportedFunctions.removeKeyEvent(id))
      .to.be.rejectedWith('some error happened');
  });
});
