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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import AsyncJob from '../../../../src/models/async-job/async-job.model.js';
import Preflight from '../../../../src/models/preflight/preflight.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('PreflightModel', () => {
  let instance;
  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      preflightId: 'a1b2c3d4-0001-4000-8000-000000000001',
      siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
      asyncJobId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
      url: 'https://www.example.com/page1',
      status: 'IN_PROGRESS',
      createdBy: { email: 'user1@example.com', displayName: 'User One' },
      startedAt: '2025-06-01T10:00:01.000Z',
      endedAt: null,
      result: null,
      error: null,
      createdAt: '2025-06-01T10:00:00.000Z',
      updatedAt: '2025-06-01T10:00:00.000Z',
    };

    ({ mockElectroService, model: instance } = createElectroMocks(Preflight, mockRecord));
    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Preflight instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('Status constants', () => {
    it('exposes Status enum', () => {
      expect(Preflight.Status).to.deep.equal({
        IN_PROGRESS: 'IN_PROGRESS',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED',
        CANCELLED: 'CANCELLED',
      });
    });

    it('matches AsyncJob.Status to prevent enum drift', () => {
      expect(Preflight.Status).to.deep.equal(AsyncJob.Status);
    });
  });

  describe('preflightId', () => {
    it('gets preflightId via getId()', () => {
      expect(instance.getId()).to.equal('a1b2c3d4-0001-4000-8000-000000000001');
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });
  });

  describe('asyncJobId', () => {
    it('gets asyncJobId', () => {
      expect(instance.getAsyncJobId()).to.equal('b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab');
    });

    it('is hidden from toJSON()', () => {
      const json = instance.toJSON();
      expect(json).to.not.have.property('asyncJobId');
    });
  });

  describe('url', () => {
    it('gets url', () => {
      expect(instance.getUrl()).to.equal('https://www.example.com/page1');
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

  describe('createdBy', () => {
    it('gets createdBy', () => {
      expect(instance.getCreatedBy()).to.deep.equal({ email: 'user1@example.com', displayName: 'User One' });
    });
  });

  describe('startedAt', () => {
    it('gets startedAt', () => {
      expect(instance.getStartedAt()).to.equal('2025-06-01T10:00:01.000Z');
    });

    it('sets startedAt', () => {
      instance.setStartedAt('2025-06-01T10:00:05.000Z');
      expect(instance.getStartedAt()).to.equal('2025-06-01T10:00:05.000Z');
    });
  });

  describe('endedAt', () => {
    it('gets endedAt', () => {
      expect(instance.getEndedAt()).to.be.null;
    });

    it('sets endedAt', () => {
      instance.setEndedAt('2025-06-01T10:05:00.000Z');
      expect(instance.getEndedAt()).to.equal('2025-06-01T10:05:00.000Z');
    });
  });

  describe('result', () => {
    it('gets result', () => {
      expect(instance.getResult()).to.be.null;
    });

    it('sets result', () => {
      const result = { opportunities: [{ type: 'broken-backlinks', count: 3 }] };
      instance.setResult(result);
      expect(instance.getResult()).to.deep.equal(result);
    });
  });

  describe('error', () => {
    it('gets error', () => {
      expect(instance.getError()).to.be.null;
    });

    it('sets error', () => {
      const error = { code: 'ERR_SCAN_TIMEOUT', message: 'Scan timed out after 60s' };
      instance.setError(error);
      expect(instance.getError()).to.deep.equal(error);
    });
  });

  describe('createdAt', () => {
    it('gets createdAt', () => {
      expect(instance.getCreatedAt()).to.equal('2025-06-01T10:00:00.000Z');
    });
  });

  describe('updatedAt', () => {
    it('gets updatedAt', () => {
      expect(instance.getUpdatedAt()).to.equal('2025-06-01T10:00:00.000Z');
    });
  });
});
