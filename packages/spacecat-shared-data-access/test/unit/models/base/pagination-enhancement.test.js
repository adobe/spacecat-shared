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

import { expect } from 'chai';
import sinon from 'sinon';

import BaseCollection from '../../../../src/models/base/base.collection.js';

describe('BaseCollection Pagination Enhancement', () => {
  let collection;
  let mockElectroService;
  let mockEntityRegistry;
  let mockSchema;
  let mockLog;
  let mockEntity;

  beforeEach(() => {
    mockLog = {
      warn: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
    };

    mockEntity = {
      query: {
        byTest: sinon.stub().returns({
          go: sinon.stub(),
        }),
      },
    };

    mockElectroService = {
      entities: {
        TestEntity: mockEntity,
      },
    };

    mockSchema = {
      getModelClass: sinon.stub().returns(class TestModel {}),
      getEntityName: sinon.stub().returns('TestEntity'),
      getIdName: sinon.stub().returns('testId'),
      findIndexNameByKeys: sinon.stub().returns('byTest'),
      toAccessorConfigs: sinon.stub().returns([]),
    };

    mockEntityRegistry = {};

    collection = new BaseCollection(mockElectroService, mockEntityRegistry, mockSchema, mockLog);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('pagination options validation', () => {
    it('should validate returnMetadata option in queryByIndexKeys', async () => {
      // Mock the query to return data
      mockEntity.query.byTest.returns({
        go: sinon.stub().resolves({
          data: [{ id: 'test-1' }],
          cursor: null,
        }),
      });

      try {
        await collection.allByIndexKeys({ testKey: 'value' }, { returnMetadata: 'invalid' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('returnMetadata must be a boolean');
      }
    });

    it('should validate fetchAllPages option in queryByIndexKeys', async () => {
      // Mock the query to return data
      mockEntity.query.byTest.returns({
        go: sinon.stub().resolves({
          data: [{ id: 'test-1' }],
          cursor: null,
        }),
      });

      try {
        await collection.allByIndexKeys({ testKey: 'value' }, { fetchAllPages: 'invalid' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('fetchAllPages must be a boolean');
      }
    });

    it('should return metadata when returnMetadata is true', async () => {
      // Mock the query to return data with cursor
      mockEntity.query.byTest.returns({
        go: sinon.stub().resolves({
          data: [{ id: 'test-1' }, { id: 'test-2' }],
          cursor: 'next-page-cursor',
        }),
      });

      const result = await collection.allByIndexKeys(
        { testKey: 'value' },
        { returnMetadata: true },
      );

      expect(result).to.have.property('data');
      expect(result).to.have.property('metadata');
      expect(result.metadata).to.have.property('totalFetched', 2);
      expect(result.metadata).to.have.property('wasTruncated', true);
      expect(result.metadata).to.have.property('hasMore', true);
      expect(result.metadata).to.have.property('cursor', 'next-page-cursor');
      expect(result.metadata).to.have.property('pagesRetrieved', 1);
    });

    it('should log truncation warning when data is truncated', async () => {
      // Mock the query to return data with cursor (truncated)
      mockEntity.query.byTest.returns({
        go: sinon.stub().resolves({
          data: [{ id: 'test-1' }, { id: 'test-2' }],
          cursor: 'next-page-cursor',
        }),
      });

      await collection.allByIndexKeys({ testKey: 'value' });

      expect(mockLog.warn.calledOnce).to.be.true;
      expect(mockLog.warn.firstCall.args[0]).to.include('Query returned truncated results');
      expect(mockLog.warn.firstCall.args[0]).to.include('Consider using fetchAllPages: true');
    });

    it('should not log warning when fetchAllPages is true', async () => {
      // Mock the query to return multiple pages
      let callCount = 0;
      const mockGo = sinon.stub().callsFake(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve({
            data: [{ id: 'test-1' }],
            cursor: 'page-2-cursor',
          });
        }
        return Promise.resolve({
          data: [{ id: 'test-2' }],
          cursor: null,
        });
      });

      mockEntity.query.byTest.returns({ go: mockGo });

      await collection.allByIndexKeys({ testKey: 'value' }, { fetchAllPages: true });

      expect(mockLog.warn.called).to.be.false;
    });
  });
});
