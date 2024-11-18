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

import { expect, use as chaiUse } from 'chai';
import { stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import Patcher from '../../../../src/v2/util/patcher.js';

chaiUse(chaiAsPromised);

/**
 * Mock services and logger for unit testing
 */
const mockRecord = {
  testentityId: '12345',
  siteId: 'site001',
  status: 'NEW',
};

describe('Patcher', () => {
  let patcherInstance;
  let mockEntity;

  beforeEach(() => {
    mockEntity = {
      model: {
        name: 'TestEntity',
        schema: {
          attributes: {
            status: { enumArray: ['NEW', 'IN_PROGRESS', 'COMPLETED'] },
          },
        },
        indexes: {
          mainIndex: {
            pk: { facets: ['siteId'] },
            sk: { facets: ['status'] },
          },
        },
      },
      patch: stub().returns({
        set: stub().returns({
          set: stub(),
        }),
      }),
    };

    patcherInstance = new Patcher(mockEntity, mockRecord);
  });

  describe('constructor', () => {
    it('initializes the Patcher instance correctly', () => {
      expect(patcherInstance).to.be.an('object');
      expect(patcherInstance.entity).to.equal(mockEntity);
      expect(patcherInstance.record).to.equal(mockRecord);
      expect(patcherInstance.idName).to.equal('testentityId');
    });
  });

  describe('getPatchRecord', () => {
    it('initializes patchRecord if not already set', () => {
      expect(patcherInstance.patchRecord).to.be.null;
      patcherInstance.patchString('status', 'IN_PROGRESS');
      expect(patcherInstance.patchRecord).to.not.be.null;
      expect(mockEntity.patch.calledOnceWith({ testentityId: '12345' })).to.be.true;
    });

    it('returns the existing patchRecord if already set', () => {
      patcherInstance.patchString('status', 'IN_PROGRESS');
      expect(patcherInstance.patchRecord).to.not.be.null;
      patcherInstance.patchString('status', 'IN_PROGRESS');
      expect(mockEntity.patch.calledOnceWith({ testentityId: '12345' })).to.be.true;
    });
  });

  describe('patchString', () => {
    it('calls guardString and sets the value', () => {
      patcherInstance.patchString('status', 'IN_PROGRESS');
      expect(patcherInstance.record.status).to.equal('IN_PROGRESS');
    });
  });

  describe('patchEnum', () => {
    it('calls guardEnum and sets the value', () => {
      patcherInstance.patchEnum('status', 'COMPLETED');
      expect(patcherInstance.record.status).to.equal('COMPLETED');
    });
  });

  describe('patchId', () => {
    it('calls guardId and sets the value', () => {
      patcherInstance.patchId('testentityId', 'ef39921f-9a02-41db-b491-02c98987d956');
      expect(patcherInstance.record.testentityId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
    });
  });

  describe('patchMap', () => {
    it('calls guardMap and sets the value', () => {
      patcherInstance.patchMap('metadata', { key: 'value' });
      expect(patcherInstance.record.metadata).to.deep.equal({ key: 'value' });
    });
  });

  describe('patchNumber', () => {
    it('calls guardNumber and sets the value', () => {
      patcherInstance.patchNumber('quantity', 42);
      expect(patcherInstance.record.quantity).to.equal(42);
    });
  });

  describe('patchSet', () => {
    it('calls guardArray and sets the value', () => {
      patcherInstance.patchSet('tags', ['tag1', 'tag2']);
      expect(patcherInstance.record.tags).to.deep.equal(['tag1', 'tag2']);
    });
  });

  describe('save', () => {
    it('saves the patch record and updates updatedAt', async () => {
      const mockPatchRecord = { go: stub().returns(Promise.resolve()) };
      patcherInstance.patchRecord = mockPatchRecord;

      await patcherInstance.save();
      expect(mockPatchRecord.go.calledOnce).to.be.true;
      expect(patcherInstance.record.updatedAt).to.be.a('number');
    });

    it('throws an error if the save operation fails', async () => {
      const mockPatchRecord = { go: stub().returns(Promise.reject(new Error('Save failed'))) };
      patcherInstance.patchRecord = mockPatchRecord;

      await expect(patcherInstance.save()).to.be.rejectedWith('Save failed');
    });
  });
});
