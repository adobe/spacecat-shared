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

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { OaeValidationJobs } from '../src/oae-validation-job.js';

use(sinonChai);

describe('OaeValidationJobs', () => {
  const sandbox = sinon.createSandbox();
  const siteId = '123e4567-e89b-12d3-a456-426614174000';
  const suggestionId1 = '223e4567-e89b-12d3-a456-426614174001';
  const suggestionId2 = '323e4567-e89b-12d3-a456-426614174002';
  const jobId = '423e4567-e89b-12d3-a456-426614174003';

  let log;
  let sqs;
  let dataAccess;
  let configuration;
  let context;

  beforeEach(() => {
    log = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
    };
    sqs = { sendMessage: sandbox.stub().resolves() };
    configuration = { getQueues: () => ({ imports: 'https://sqs.example.com/imports' }) };
    dataAccess = {
      Configuration: { findLatest: sandbox.stub().resolves(configuration) },
      OaeValidation: { allByJobId: sandbox.stub() },
    };
    context = { dataAccess, sqs, log };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createFrom', () => {
    it('creates and memoizes an instance on the context', () => {
      const instance = OaeValidationJobs.createFrom(context);

      expect(instance).to.be.instanceOf(OaeValidationJobs);
      expect(OaeValidationJobs.createFrom(context)).to.equal(instance);
    });

    it('defaults to console when no logger is provided in context', () => {
      const instance = OaeValidationJobs.createFrom({ dataAccess, sqs });

      expect(instance.log).to.equal(console);
    });
  });

  describe('createJob', () => {
    it('sends one SQS message and returns a generated jobId', async () => {
      const instance = OaeValidationJobs.createFrom(context);

      const result = await instance.createJob({
        siteId, type: 'routing', suggestionIds: [suggestionId1, suggestionId2],
      });

      expect(result.jobId).to.be.a('string');
      expect(sqs.sendMessage).to.have.been.calledOnceWith(
        'https://sqs.example.com/imports',
        {
          type: 'oae-validation',
          jobId: result.jobId,
          siteId,
          validationType: 'routing',
          suggestionIds: [suggestionId1, suggestionId2],
        },
      );
      expect(log.info).to.have.been.called;
    });

    it('uses the instance logger when no per-call logger is provided', async () => {
      const instance = new OaeValidationJobs({ dataAccess, sqs }, log);

      const result = await instance.createJob({
        siteId, type: 'routing', suggestionIds: [suggestionId1],
      });

      expect(result.jobId).to.be.a('string');
      expect(log.info).to.have.been.called;
    });

    it('propagates an error when sending the SQS message fails', async () => {
      sqs.sendMessage.rejects(new Error('SQS unavailable'));
      const instance = OaeValidationJobs.createFrom(context);

      let thrown;
      try {
        await instance.createJob({
          siteId, type: 'routing', suggestionIds: [suggestionId1],
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown.message).to.equal('SQS unavailable');
    });

    it('throws a clear error when no configuration exists', async () => {
      dataAccess.Configuration.findLatest.resolves(null);
      const instance = OaeValidationJobs.createFrom(context);

      let thrown;
      try {
        await instance.createJob({
          siteId, type: 'routing', suggestionIds: [suggestionId1],
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown.message).to.equal('No configuration found -- cannot determine import queue URL');
      expect(sqs.sendMessage.called).to.be.false;
    });
  });

  describe('getJob', () => {
    it('returns null when no rows exist for the job', async () => {
      dataAccess.OaeValidation.allByJobId.resolves([]);
      const instance = OaeValidationJobs.createFrom(context);

      const result = await instance.getJob(jobId);

      expect(result).to.be.null;
    });

    it('returns the per-suggestion data for the job', async () => {
      const row1 = {
        getSuggestionId: () => suggestionId1,
        getStatus: () => 'COMPLETE',
        getOutcome: () => 'true',
        getCompletedAt: () => '2026-01-01T00:00:00.000Z',
        getMetadata: () => ({}),
      };
      const row2 = {
        getSuggestionId: () => suggestionId2,
        getStatus: () => 'IN_PROGRESS',
        getOutcome: () => null,
        getCompletedAt: () => null,
        getMetadata: () => null,
      };
      dataAccess.OaeValidation.allByJobId.resolves([row1, row2]);
      const instance = OaeValidationJobs.createFrom(context);

      const result = await instance.getJob(jobId);

      expect(result).to.deep.equal({
        jobId,
        suggestions: [
          {
            suggestionId: suggestionId1, status: 'COMPLETE', outcome: 'true', completedAt: '2026-01-01T00:00:00.000Z', metadata: {},
          },
          {
            suggestionId: suggestionId2, status: 'IN_PROGRESS', outcome: null, completedAt: null, metadata: null,
          },
        ],
      });
    });

    it('propagates an error when the query fails', async () => {
      dataAccess.OaeValidation.allByJobId.rejects(new Error('DB unavailable'));
      const instance = OaeValidationJobs.createFrom(context);

      let thrown;
      try {
        await instance.getJob(jobId);
      } catch (error) {
        thrown = error;
      }
      expect(thrown.message).to.equal('DB unavailable');
    });
  });
});
