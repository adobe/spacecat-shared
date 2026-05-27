/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Preflight from '../../../../src/models/preflight/preflight.model.js';
import PreflightCollection from '../../../../src/models/preflight/preflight.collection.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('PreflightCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let schema;
  let sandbox;

  const mockRecord = {
    preflightId: 'a1b2c3d4-0001-4000-8000-000000000001',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    asyncJobId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
    url: 'https://www.example.com/page1',
    status: 'IN_PROGRESS',
    createdBy: { email: 'user1@example.com', displayName: 'User One' },
    startedAt: '2025-06-01T10:00:01.000Z',
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      schema,
    } = createElectroMocks(Preflight, mockRecord));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('initializes the PreflightCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
    });
  });

  describe('COLLECTION_NAME', () => {
    it('has the correct collection name', () => {
      expect(PreflightCollection.COLLECTION_NAME).to.equal('PreflightCollection');
    });
  });

  describe('allBySiteIdAndUrl', () => {
    const siteId = '5d6d4439-6659-46c2-b646-92d110fa5a52';

    const makeModel = (url) => ({
      getUrl: () => url,
    });

    const records = [
      makeModel('https://www.example.com/page1'),
      makeModel('https://www.example.com/page2'),
      makeModel('https://www.example.com/page1'),
    ];

    beforeEach(() => {
      sandbox.stub(instance, 'allBySiteId').resolves(records);
    });

    it('returns all records when no url filter provided', async () => {
      const result = await instance.allBySiteIdAndUrl(siteId);
      expect(result).to.have.length(3);
      expect(instance.allBySiteId).to.have.been.calledWith(siteId);
    });

    it('filters records by url when provided', async () => {
      const result = await instance.allBySiteIdAndUrl(siteId, 'https://www.example.com/page1');
      expect(result).to.have.length(2);
      result.forEach((r) => expect(r.getUrl()).to.equal('https://www.example.com/page1'));
    });

    it('returns empty array when no records match the url filter', async () => {
      const result = await instance.allBySiteIdAndUrl(siteId, 'https://www.example.com/not-found');
      expect(result).to.have.length(0);
    });
  });
});
