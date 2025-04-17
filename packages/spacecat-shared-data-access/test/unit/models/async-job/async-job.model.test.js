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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import AsyncJob from '../../../../src/models/async-job/async-job.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AsyncJobModel', () => {
  let instance;
  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      asyncJobId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
      status: 'IN_PROGRESS',
      resultLocation: '',
      resultType: null,
      result: null,
      error: null,
      metadata: { submittedBy: 'user1', jobType: 'test', tags: ['tag1', 'tag2'] },
      startedAt: '2025-01-01T00:00:00.000Z',
      endedAt: '',
      recordExpiresAt: 1767225600,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    ({ mockElectroService, model: instance } = createElectroMocks(AsyncJob, mockRecord));
    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the AsyncJob instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('asyncJobId', () => {
    it('gets asyncJobId', () => {
      expect(instance.getId()).to.equal('b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab');
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal('IN_PROGRESS');
    });
    it('sets status', () => {
      instance.setStatus('COMPLETED');
      expect(instance.getStatus()).to.equal('COMPLETED');
    });
  });

  describe('resultLocation', () => {
    it('gets resultLocation', () => {
      expect(instance.getResultLocation()).to.equal('');
    });
    it('sets resultLocation', () => {
      instance.setResultLocation('s3://bucket/result.json');
      expect(instance.getResultLocation()).to.equal('s3://bucket/result.json');
    });
  });

  describe('resultType', () => {
    it('gets resultType', () => {
      expect(instance.getResultType()).to.be.null;
    });
    it('sets resultType', () => {
      instance.setResultType('S3');
      expect(instance.getResultType()).to.equal('S3');
    });
  });

  describe('result', () => {
    it('gets result', () => {
      expect(instance.getResult()).to.be.null;
    });
    it('sets result', () => {
      instance.setResult({ value: 42 });
      expect(instance.getResult()).to.deep.equal({ value: 42 });
    });
  });

  describe('error', () => {
    it('gets error', () => {
      expect(instance.getError()).to.be.null;
    });
    it('sets error', () => {
      const error = { code: 'ERR', message: 'fail', details: { foo: 'bar' } };
      instance.setError(error);
      expect(instance.getError()).to.deep.equal(error);
    });
  });

  describe('metadata', () => {
    it('gets metadata', () => {
      expect(instance.getMetadata()).to.deep.equal({ submittedBy: 'user1', jobType: 'test', tags: ['tag1', 'tag2'] });
    });
    it('sets metadata', () => {
      const meta = { submittedBy: 'user2', jobType: 'other', tags: ['x'] };
      instance.setMetadata(meta);
      expect(instance.getMetadata()).to.deep.equal(meta);
    });
  });

  describe('startedAt', () => {
    it('gets startedAt', () => {
      expect(instance.getStartedAt()).to.equal('2025-01-01T00:00:00.000Z');
    });
  });

  describe('endedAt', () => {
    it('gets endedAt', () => {
      expect(instance.getEndedAt()).to.equal('');
    });
    it('sets endedAt', () => {
      const newEndedAt = '2025-01-02T00:00:00.000Z';
      instance.setEndedAt(newEndedAt);
      expect(instance.getEndedAt()).to.equal(newEndedAt);
    });
  });

  describe('recordExpiresAt', () => {
    it('gets recordExpiresAt', () => {
      expect(instance.getRecordExpiresAt()).to.equal(1767225600);
    });
  });

  describe('createdAt', () => {
    it('gets createdAt', () => {
      expect(instance.getCreatedAt()).to.equal('2025-01-01T00:00:00.000Z');
    });
  });

  describe('updatedAt', () => {
    it('gets updatedAt', () => {
      expect(instance.getUpdatedAt()).to.equal('2025-01-01T00:00:00.000Z');
    });
  });
});
