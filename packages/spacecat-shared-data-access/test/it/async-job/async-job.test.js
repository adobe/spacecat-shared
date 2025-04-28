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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ElectroValidationError } from 'electrodb';
import AsyncJobModel from '../../../src/models/async-job/async-job.model.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { DataAccessError } from '../../../src/index.js';

use(chaiAsPromised);

function checkAsyncJob(asyncJob) {
  expect(asyncJob).to.be.an('object');
  expect(asyncJob.getStatus()).to.be.a('string');
  expect(asyncJob.getCreatedAt()).to.be.a('string');
  expect(asyncJob.getUpdatedAt()).to.be.a('string');
  expect(asyncJob.getRecordExpiresAt()).to.be.a('number');
  expect(asyncJob.getMetadata()).to.be.an('object');
}

describe('AsyncJob IT', async () => {
  let sampleData;
  let AsyncJob;
  let newJobData;

  before(async () => {
    sampleData = await seedDatabase();
    const dataAccess = getDataAccess();
    AsyncJob = dataAccess.AsyncJob;
    newJobData = {
      status: 'IN_PROGRESS',
      metadata: { submittedBy: 'it-user', jobType: 'test', tags: ['it'] },
    };
  });

  it('adds a new async job', async () => {
    const asyncJob = await AsyncJob.create(newJobData);
    checkAsyncJob(asyncJob);
    expect(asyncJob.getStatus()).to.equal(newJobData.status);
    expect(asyncJob.getMetadata()).to.eql(newJobData.metadata);
  });

  it('updates an existing async job', async () => {
    const sampleAsyncJob = sampleData.asyncJobs[0];
    const asyncJob = await AsyncJob.findById(sampleAsyncJob.getId());
    await asyncJob.setStatus('COMPLETED').setResultType('INLINE').setResult({ value: 123 }).save();
    const updatedAsyncJob = await AsyncJob.findById(asyncJob.getId());
    checkAsyncJob(updatedAsyncJob);
    expect(updatedAsyncJob.getStatus()).to.equal('COMPLETED');
    expect(updatedAsyncJob.getResultType()).to.equal('INLINE');
    expect(updatedAsyncJob.getResult()).to.eql({ value: 123 });
  });

  it('finds an async job by its id', async () => {
    const sampleAsyncJob = sampleData.asyncJobs[0];
    const asyncJob = await AsyncJob.findById(sampleAsyncJob.getId());
    checkAsyncJob(asyncJob);
    expect(asyncJob.getId()).to.equal(sampleAsyncJob.getId());
  });

  it('gets all async jobs by status', async () => {
    const asyncJobs = await AsyncJob.allByStatus(AsyncJobModel.Status.COMPLETED);
    expect(asyncJobs).to.be.an('array');
    asyncJobs.forEach((asyncJob) => {
      checkAsyncJob(asyncJob);
      expect(asyncJob.getStatus()).to.equal(AsyncJobModel.Status.COMPLETED);
    });
  });

  it('throws an error when adding a job with invalid status', async () => {
    const data = { ...newJobData, status: 'INVALID_STATUS' };
    await AsyncJob.create(data).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid value');
    });
  });
});
