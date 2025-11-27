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

import ScrapeJobModel from '../../../src/models/scrape-job/scrape-job.model.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

function checkScrapeJob(scrapeJob) {
  expect(scrapeJob).to.be.an('object');
  expect(scrapeJob.getBaseURL()).to.be.a('string');
  expect(scrapeJob.getDuration()).to.be.a('number');
  expect(scrapeJob.getFailedCount()).to.be.a('number');
  if (scrapeJob.getCustomHeaders()) {
    expect(scrapeJob.getCustomHeaders()).to.be.a('object');
  }
  expect(scrapeJob.getScrapeQueueId()).to.be.a('string');
  expect(scrapeJob.getRedirectCount()).to.be.an('number');
  expect(scrapeJob.getStartedAt()).to.be.a('string');
  expect(scrapeJob.getStatus()).to.be.a('string');
  expect(scrapeJob.getSuccessCount()).to.be.an('number');
  expect(scrapeJob.getUrlCount()).to.be.an('number');
  expect(scrapeJob.getProcessingType()).to.be.a('string');
  expect(scrapeJob.getOptions()).to.be.an('object');
}

describe('ScrapeJob IT', async () => {
  let sampleData;
  let ScrapeJob;
  let newJobData;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    ScrapeJob = dataAccess.ScrapeJob;

    newJobData = {
      scrapeQueueId: 'some-queue-id',
      baseURL: 'https://example-some.com/cars',
      startedAt: '2023-12-15T01:22:05.000Z',
      status: ScrapeJobModel.ScrapeJobStatus.RUNNING,
      processingType: ScrapeJobModel.ScrapeProcessingType.DEFAULT,
      customHeader: {},
      options: {
        enableJavascript: true,
        pageLoadTimeout: 10000,
        hideConsentBanners: false,
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
    expect(scrapeJob.getBaseURL()).to.equal(newJobData.baseURL);
    expect(scrapeJob.getStartedAt()).to.equal(newJobData.startedAt);
    expect(scrapeJob.getStatus()).to.equal(newJobData.status);
    expect(scrapeJob.getCustomHeaders()).to.equal(newJobData.customHeaders);
    expect(scrapeJob.getProcessingType()).to.equal(newJobData.processingType);
    expect(scrapeJob.getOptions()).to.eql(newJobData.options);
  });

  it('adds a new scrape job with valid options', async () => {
    const options = {
      enableJavascript: true,
      pageLoadTimeout: 5000,
      hideConsentBanners: true,
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

    validJobData = {
      ...newJobData,
      processingType: ScrapeJobModel.ScrapeProcessingType.ACCESSIBILITY,
    };
    scrapeJob = await ScrapeJob.create(validJobData);

    checkScrapeJob(scrapeJob);
    expect(scrapeJob.getProcessingType()).to.eql(ScrapeJobModel.ScrapeProcessingType.ACCESSIBILITY);
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
    };

    await scrapeJob
      .setStatus(updates.status)
      .setEndedAt(updates.endedAt)
      .setSuccessCount(updates.successCount)
      .setFailedCount(updates.failedCount)
      .setRedirectCount(updates.redirectCount)
      .setUrlCount(updates.urlCount)
      .setDuration(updates.duration)
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
    expect(scrapeJobs.length).to.equal(3);

    scrapeJobs.forEach((scrapeJob) => {
      checkScrapeJob(scrapeJob);
    });
  });

  it('gets all scrape jobs by baseURL', async () => {
    const scrapeJobs = await ScrapeJob.allByBaseURL('https://example-2.com/cars');

    expect(scrapeJobs).to.be.an('array');
    expect(scrapeJobs.length).to.equal(2);
    expect(scrapeJobs[0].getId()).to.equal(sampleData.scrapeJobs[1].getId());
    expect(scrapeJobs[1].getId()).to.equal(sampleData.scrapeJobs[0].getId());
  });

  it('gets all scrape jobs by baseURL and processing type', async () => {
    const scrapeJobs = await ScrapeJob.allByBaseURLAndProcessingType('https://example-2.com/cars', ScrapeJobModel.ScrapeProcessingType.DEFAULT);

    expect(scrapeJobs).to.be.an('array');
    expect(scrapeJobs.length).to.equal(1);
    expect(scrapeJobs[0].getId()).to.equal(sampleData.scrapeJobs[0].getId());
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
