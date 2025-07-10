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

import { ElectroValidationError } from 'electrodb';
import ImportJobModel from '../../../src/models/import-job/import-job.model.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { DataAccessError } from '../../../src/index.js';

use(chaiAsPromised);

function checkImportJob(importJob) {
  expect(importJob).to.be.an('object');
  expect(importJob.getBaseURL()).to.be.a('string');
  expect(importJob.getDuration()).to.be.a('number');
  expect(importJob.getFailedCount()).to.be.a('number');
  expect(importJob.getHasCustomHeaders()).to.be.a('boolean');
  expect(importJob.getHasCustomImportJs()).to.be.a('boolean');
  expect(importJob.getHashedApiKey()).to.be.a('string');
  expect(importJob.getImportQueueId()).to.be.a('string');
  expect(importJob.getInitiatedBy()).to.be.an('object');
  expect(importJob.getRedirectCount()).to.be.an('number');
  expect(importJob.getStartedAt()).to.be.a('string');
  expect(importJob.getStatus()).to.be.a('string');
  expect(importJob.getSuccessCount()).to.be.an('number');
  expect(importJob.getUrlCount()).to.be.an('number');
}

describe('ImportJob IT', async () => {
  let sampleData;
  let ImportJob;
  let newJobData;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    ImportJob = dataAccess.ImportJob;

    newJobData = {
      importQueueId: 'some-queue-id',
      hashedApiKey: 'some-hashed-api-key',
      baseURL: 'https://example-some.com/cars',
      startedAt: '2023-12-15T01:22:05.000Z',
      status: 'RUNNING',
      initiatedBy: {
        apiKeyName: 'K-321',
      },
      hasCustomImportJs: false,
      hasCustomHeaders: true,
    };
  });

  it('adds a new import job', async () => {
    const importJob = await ImportJob.create(newJobData);

    checkImportJob(importJob);

    expect(importJob.getImportQueueId()).to.equal(newJobData.importQueueId);
    expect(importJob.getHashedApiKey()).to.equal(newJobData.hashedApiKey);
    expect(importJob.getBaseURL()).to.equal(newJobData.baseURL);
    expect(importJob.getStartedAt()).to.equal(newJobData.startedAt);
    expect(importJob.getStatus()).to.equal(newJobData.status);
    expect(importJob.getInitiatedBy()).to.eql(newJobData.initiatedBy);
    expect(importJob.getHasCustomImportJs()).to.equal(newJobData.hasCustomImportJs);
    expect(importJob.getHasCustomHeaders()).to.equal(newJobData.hasCustomHeaders);
  });

  it('adds a new import job with valid options', async () => {
    const options = {
      type: 'xwalk',
      data: {
        siteName: 'xwalk',
        assetFolder: 'xwalk',
      },
    };

    let data = { ...newJobData, options };
    let importJob = await ImportJob.create(data);

    checkImportJob(importJob);
    expect(importJob.getOptions()).to.equal(data.options);

    data = { ...newJobData, options: { type: 'doc' } };
    importJob = await ImportJob.create(data);

    checkImportJob(importJob);
    expect(importJob.getOptions()).to.eql({ type: 'doc' });

    // Add test for da type
    data = { ...newJobData, options: { type: 'da' } };
    importJob = await ImportJob.create(data);

    checkImportJob(importJob);
    expect(importJob.getOptions()).to.eql({ type: 'da' });

    // test to make sure data error is thrown if data is not an object
    data = { ...newJobData, options: { data: 'not-an-object' } };
    await ImportJob.create(data).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid value for data: not-an-object');
    });

    // test to make sure data is not an empty object
    data = { ...newJobData, options: { data: { } } };
    await ImportJob.create(data).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid value for data');
    });
  });

  it('throws an error when adding a new import job with invalid options', async () => {
    const data = { ...newJobData, options: { type: 'invalid' } };

    await ImportJob.create(data).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid value for type: invalid');
    });
  });

  it('updates an existing import job', async () => {
    const sampleImportJob = sampleData.importJobs[0];
    const importJob = await ImportJob.findById(sampleImportJob.getId());

    const updates = {
      status: 'COMPLETE',
      endedAt: '2023-11-15T03:49:13.000Z',
      successCount: 86,
      failedCount: 4,
      redirectCount: 10,
      urlCount: 100,
      duration: 188000,
    };

    await importJob
      .setStatus(updates.status)
      .setEndedAt(updates.endedAt)
      .setSuccessCount(updates.successCount)
      .setFailedCount(updates.failedCount)
      .setRedirectCount(updates.redirectCount)
      .setUrlCount(updates.urlCount)
      .setDuration(updates.duration)
      .save();

    const updatedImportJob = await ImportJob.findById(importJob.getId());

    checkImportJob(updatedImportJob);

    expect(updatedImportJob.getStatus()).to.equal(updates.status);
    expect(updatedImportJob.getEndedAt()).to.equal(updates.endedAt);
    expect(updatedImportJob.getSuccessCount()).to.equal(updates.successCount);
    expect(updatedImportJob.getFailedCount()).to.equal(updates.failedCount);
    expect(updatedImportJob.getRedirectCount()).to.equal(updates.redirectCount);
    expect(updatedImportJob.getUrlCount()).to.equal(updates.urlCount);
    expect(updatedImportJob.getDuration()).to.equal(updates.duration);
  });

  it('finds an import job by its id', async () => {
    const sampleImportJob = sampleData.importJobs[0];
    const importJob = await ImportJob.findById(sampleImportJob.getId());

    checkImportJob(importJob);
    expect(importJob.getId()).to.equal(sampleImportJob.getId());
  });

  it('gets all import jobs by status', async () => {
    const importJobs = await ImportJob.allByStatus(ImportJobModel.ImportJobStatus.COMPLETE);

    expect(importJobs).to.be.an('array');
    expect(importJobs.length).to.equal(2);
    expect(importJobs[0].getId()).to.equal(sampleData.importJobs[0].getId());
    importJobs.forEach((importJob) => {
      checkImportJob(importJob);
      expect(importJob.getStatus()).to.equal(ImportJobModel.ImportJobStatus.COMPLETE);
    });
  });

  it('gets all import jobs by date range', async () => {
    const importJobs = await ImportJob.allByDateRange(
      '2023-11-14T00:00:00.000Z',
      '2023-11-16T00:00:00.000Z',
    );

    expect(importJobs).to.be.an('array');
    expect(importJobs.length).to.equal(2);

    importJobs.forEach((importJob) => {
      checkImportJob(importJob);
    });
  });

  it('removes an import job', async () => {
    const sampleImportJob = sampleData.importJobs[0];
    const importJob = await ImportJob.findById(sampleImportJob.getId());

    const importUrls = await importJob.getImportUrls();

    expect(importUrls).to.be.an('array');
    expect(importUrls.length).to.equal(5);

    await importJob.remove();

    const removedImportJob = await ImportJob.findById(sampleImportJob.getId());
    expect(removedImportJob).to.be.null;

    // todo: verify import urls are removed when base collection is implemented
  });
});
