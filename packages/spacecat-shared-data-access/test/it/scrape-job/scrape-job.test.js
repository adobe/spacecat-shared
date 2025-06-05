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
import ScrapeJobModel from '../../../src/models/scrape-job/scrape-job.model.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { DataAccessError } from '../../../src/index.js';

use(chaiAsPromised);

function checkScrapeJob(scrapeJob) {
  expect(scrapeJob).to.be.an('object');
  expect(scrapeJob.getBaseURL()).to.be.a('string');
  expect(scrapeJob.getDuration()).to.be.a('number');
  expect(scrapeJob.getFailedCount()).to.be.a('number');
  expect(scrapeJob.getCustomHeaders()).to.be.a('object');
  expect(scrapeJob.getHashedApiKey()).to.be.a('string');
  expect(scrapeJob.getScrapeQueueId()).to.be.a('string');
  expect(scrapeJob.getInitiatedBy()).to.be.an('object');
  expect(scrapeJob.getRedirectCount()).to.be.an('number');
  expect(scrapeJob.getStartedAt()).to.be.a('string');
  expect(scrapeJob.getStatus()).to.be.a('string');
  expect(scrapeJob.getSuccessCount()).to.be.an('number');
  expect(scrapeJob.getUrlCount()).to.be.an('number');
  expect(scrapeJob.getProcessingType()).to.be.a('string');
  expect(scrapeJob.getOptions()).to.be.an('object');
  expect(scrapeJob.getProcessingType()).to.be.a('string');
  if (scrapeJob.getResults()) {
    expect(scrapeJob.getResults()).to.be.an('object');
  }
}

describe('ScrapeJob IT', async () => {
  let sampleData;
  let ScrapeJob;
  let newJobData;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    ScrapeJob = dataAccess.ScrapeJob;

    newJobData = {
      scrapeQueueId: 'some-queue-id',
      hashedApiKey: 'some-hashed-api-key',
      baseURL: 'https://example-some.com/cars',
      startedAt: '2023-12-15T01:22:05.000Z',
      status: ScrapeJobModel.ScrapeJobStatus.RUNNING,
      initiatedBy: {
        apiKeyName: 'K-321',
      },
      processingType: ScrapeJobModel.ScrapeProcessingType.DEFAULT,
      customHeaders: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      options: {
        enableJavascript: true,
        pageLoadTimeout: 10000,
        hideConsentBanner: false,
        waitForSelector: 'body',
        screenshotTypes: [
          ScrapeJobModel.ScrapeScreenshotType.FULL_PAGE,
          ScrapeJobModel.ScrapeScreenshotType.THUMBNAIL,
        ],
      },
    };
  });

  it('adds a new scrape job', async () => {
    const scrapeJob = await ScrapeJob.create(newJobData);

    checkScrapeJob(scrapeJob);

    expect(scrapeJob.getScrapeQueueId()).to.equal(newJobData.scrapeQueueId);
    expect(scrapeJob.getHashedApiKey()).to.equal(newJobData.hashedApiKey);
    expect(scrapeJob.getBaseURL()).to.equal(newJobData.baseURL);
    expect(scrapeJob.getStartedAt()).to.equal(newJobData.startedAt);
    expect(scrapeJob.getStatus()).to.equal(newJobData.status);
    expect(scrapeJob.getInitiatedBy()).to.eql(newJobData.initiatedBy);
    expect(scrapeJob.getCustomHeaders()).to.equal(newJobData.customHeaders);
    expect(scrapeJob.getProcessingType()).to.equal(newJobData.processingType);
    expect(scrapeJob.getOptions()).to.eql(newJobData.options);
  });

  it('adds a new scrape job with valid options', async () => {
    const options = {
      enableJavascript: true,
      pageLoadTimeout: 5000,
      hideConsentBanner: true,
      waitForSelector: 'body',
      screenshotTypes: [
        ScrapeJobModel.ScrapeScreenshotType.SCROLL,
        ScrapeJobModel.ScrapeScreenshotType.BLOCK,
      ],
    };

    let validJobData = { ...newJobData, options };
    let scrapeJob = await ScrapeJob.create(validJobData);

    checkScrapeJob(scrapeJob);
    expect(scrapeJob.getOptions()).to.eql(validJobData.options);

    validJobData = { ...newJobData, options: { processingType: 'screenshot' } };
    scrapeJob = await ScrapeJob.create(validJobData);

    checkScrapeJob(scrapeJob);
    expect(scrapeJob.getOptions()).to.eql({ processingType: 'screenshot' });

    // test to make sure error is thrown if options attribute is not an object
    validJobData = { ...newJobData, options: 'not-an-object' };
    await ScrapeJob.create(validJobData).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid options. Options must be an object');
    });

    // test to make sure data is not an empty object
    validJobData = { ...newJobData, options: { } };
    await ScrapeJob.create(validJobData).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid options. Options cannot be empty');
    });
  });

  it('it fetches all scrape jobs by a url', async () => {
    const scrapeJobs = await ScrapeJob.allByBaseURLAndProcessingType('https://example-1.com/cars', ScrapeJobModel.ScrapeProcessingType.DEFAULT);

    expect(scrapeJobs).to.be.an('array');
    expect(scrapeJobs.length).to.equal(1);
    expect(scrapeJobs[0].getId()).to.equal(sampleData.scrapeJobs[0].getId());
    scrapeJobs.forEach((scrapeJob) => {
      checkScrapeJob(scrapeJob);
    });
  });

  it('throws an error when adding a new scrape job with invalid options', async () => {
    const data = { ...newJobData, options: { invalidOption: 'invalid' } };

    await ScrapeJob.create(data).catch((err) => {
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.cause).to.be.instanceOf(ElectroValidationError);
      expect(err.cause.message).to.contain('Invalid options: ');
    });
  });

  it('updates an existing scrape job', async () => {
    const sampleScrapeJob = sampleData.scrapeJobs[0];
    const scrapeJob = await ScrapeJob.findById(sampleScrapeJob.getId());

    const updates = {
      status: 'COMPLETE',
      endedAt: '2023-11-15T03:49:13.000Z',
      successCount: 86,
      failedCount: 4,
      redirectCount: 10,
      urlCount: 100,
      duration: 188000,
      results: {
        test: 'test',
      },
    };

    await scrapeJob
      .setStatus(updates.status)
      .setEndedAt(updates.endedAt)
      .setSuccessCount(updates.successCount)
      .setFailedCount(updates.failedCount)
      .setRedirectCount(updates.redirectCount)
      .setUrlCount(updates.urlCount)
      .setDuration(updates.duration)
      .setResults(updates.results)
      .save();

    const updatedScrapeJob = await ScrapeJob.findById(scrapeJob.getId());

    checkScrapeJob(updatedScrapeJob);

    expect(updatedScrapeJob.getStatus()).to.equal(updates.status);
    expect(updatedScrapeJob.getEndedAt()).to.equal(updates.endedAt);
    expect(updatedScrapeJob.getSuccessCount()).to.equal(updates.successCount);
    expect(updatedScrapeJob.getFailedCount()).to.equal(updates.failedCount);
    expect(updatedScrapeJob.getRedirectCount()).to.equal(updates.redirectCount);
    expect(updatedScrapeJob.getUrlCount()).to.equal(updates.urlCount);
    expect(updatedScrapeJob.getDuration()).to.equal(updates.duration);
    expect(updatedScrapeJob.getResults()).to.eql(updates.results);
  });

  it('finds a scrape job by its id', async () => {
    const sampleScrapeJob = sampleData.scrapeJobs[0];
    const scrapeJob = await ScrapeJob.findById(sampleScrapeJob.getId());

    checkScrapeJob(scrapeJob);
    expect(scrapeJob.getId()).to.equal(sampleScrapeJob.getId());
  });

  it('gets all scrape jobs by status', async () => {
    const scrapeJobs = await ScrapeJob.allByStatus(ScrapeJobModel.ScrapeJobStatus.COMPLETE);

    expect(scrapeJobs).to.be.an('array');
    expect(scrapeJobs.length).to.equal(1);
    expect(scrapeJobs[0].getId()).to.equal(sampleData.scrapeJobs[0].getId());
    scrapeJobs.forEach((scrapeJob) => {
      checkScrapeJob(scrapeJob);
      expect(scrapeJob.getStatus()).to.equal(ScrapeJobModel.ScrapeJobStatus.COMPLETE);
    });
  });

  it('gets all scrape jobs by date range', async () => {
    const scrapeJobs = await ScrapeJob.allByDateRange(
      '2023-11-14T00:00:00.000Z',
      '2023-11-16T00:00:00.000Z',
    );

    expect(scrapeJobs).to.be.an('array');
    expect(scrapeJobs.length).to.equal(1);

    scrapeJobs.forEach((scrapeJob) => {
      checkScrapeJob(scrapeJob);
    });
  });

  it('removes a scrape job', async () => {
    const sampleScrapeJob = sampleData.scrapeJobs[0];
    const scrapeJob = await ScrapeJob.findById(sampleScrapeJob.getId());

    const scrapeUrls = await scrapeJob.getScrapeUrls();

    expect(scrapeUrls).to.be.an('array');
    expect(scrapeUrls.length).to.equal(5);

    await scrapeJob.remove();

    const removedScrapeJob = await ScrapeJob.findById(sampleScrapeJob.getId());
    expect(removedScrapeJob).to.be.null;
  });
});
