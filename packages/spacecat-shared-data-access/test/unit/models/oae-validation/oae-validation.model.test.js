/*
 * Copyright 2026 Adobe. All rights reserved.
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
import sinonChai from 'sinon-chai';

import OaeValidation from '../../../../src/models/oae-validation/oae-validation.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(sinonChai);

describe('OaeValidationModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      oaeValidationId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
      jobId: 'c4c2d3f1-2b3c-5d4e-9f0a-2345678901bc',
      suggestionId: 'd5d3e4f2-3c4d-6e5f-0a1b-3456789012cd',
      status: 'IN_PROGRESS',
      type: 'routing',
      outcome: null,
      completedAt: null,
      metadata: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'system',
    };

    ({ model: instance } = createElectroMocks(OaeValidation, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the OaeValidation instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('Status', () => {
    it('exposes the expected status values', () => {
      expect(OaeValidation.Status).to.deep.equal({
        IN_PROGRESS: 'IN_PROGRESS',
        COMPLETE: 'COMPLETE',
        FAILED: 'FAILED',
      });
    });
  });

  describe('Outcome', () => {
    it('exposes the expected outcome values', () => {
      expect(OaeValidation.Outcome).to.deep.equal({
        PASS: 'pass',
        FAIL: 'fail',
        UNKNOWN: 'unknown',
      });
    });
  });

  describe('jobId', () => {
    it('gets jobId', () => {
      expect(instance.getJobId()).to.equal(mockRecord.jobId);
    });
    it('sets jobId', () => {
      const newJobId = 'e6e4f5a3-4d5e-7f6a-1b2c-4567890123de';
      instance.setJobId(newJobId);
      expect(instance.getJobId()).to.equal(newJobId);
    });
  });

  describe('suggestionId', () => {
    it('gets suggestionId', () => {
      expect(instance.getSuggestionId()).to.equal(mockRecord.suggestionId);
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(instance.getStatus()).to.equal('IN_PROGRESS');
    });
    it('sets status', () => {
      instance.setStatus('COMPLETE');
      expect(instance.getStatus()).to.equal('COMPLETE');
    });
  });

  describe('type', () => {
    it('gets type', () => {
      expect(instance.getType()).to.equal('routing');
    });
    it('sets type', () => {
      instance.setType('prerender');
      expect(instance.getType()).to.equal('prerender');
    });
  });

  describe('outcome', () => {
    it('gets outcome', () => {
      expect(instance.getOutcome()).to.equal(null);
    });
    it('sets outcome', () => {
      instance.setOutcome('pass');
      expect(instance.getOutcome()).to.equal('pass');
    });
  });

  describe('completedAt', () => {
    it('gets completedAt', () => {
      expect(instance.getCompletedAt()).to.equal(null);
    });
    it('sets completedAt', () => {
      const completedAt = '2026-01-02T00:00:00.000Z';
      instance.setCompletedAt(completedAt);
      expect(instance.getCompletedAt()).to.equal(completedAt);
    });
  });

  describe('metadata', () => {
    it('gets metadata', () => {
      expect(instance.getMetadata()).to.deep.equal({});
    });
    it('sets metadata', () => {
      const metadata = { origin_status: 403 };
      instance.setMetadata(metadata);
      expect(instance.getMetadata()).to.deep.equal(metadata);
    });
  });
});
