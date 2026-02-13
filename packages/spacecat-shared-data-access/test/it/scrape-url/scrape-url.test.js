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

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { ScrapeJob } from '../../../src/index.js';

use(chaiAsPromised);

function checkScrapeUrl(scrapeUrl) {
  expect(scrapeUrl).to.be.an('object');
  expect(scrapeUrl.getRecordExpiresAt()).to.be.a('number');
  expect(scrapeUrl.getScrapeJobId()).to.be.a('string');
  expect(scrapeUrl.getStatus()).to.be.a('string');
  expect(scrapeUrl.getUrl()).to.be.a('string');
}

describe('ScrapeUrl IT', async () => {
  let sampleData;
  let ScrapeUrl;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    ScrapeUrl = dataAccess.ScrapeUrl;
  });

  it('adds a new scrape url', async () => {
    const sampleScrapeJob = sampleData.scrapeJobs[0];
    const data = {
      scrapeJobId: sampleScrapeJob.getId(),
      url: 'https://example-some.com/cars',
      status: 'RUNNING',
      processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,

    };

    const scrapeUrl = await ScrapeUrl.create(data);

    checkScrapeUrl(scrapeUrl);
  });

  it('updates an scrape url', async () => {
    const data = {
      url: 'https://example-some.com/cars',
      status: 'RUNNING',
      file: 'some-file',
      reason: 'some-reason',
    };

    const scrapeUrl = await ScrapeUrl.findById(sampleData.scrapeUrls[0].getId());
    await scrapeUrl
      .setUrl(data.url)
      .setStatus(data.status)
      .setFile(data.file)
      .setReason(data.reason)
      .save();

    const updatedScrapeUrl = await ScrapeUrl.findById(sampleData.scrapeUrls[0].getId());

    checkScrapeUrl(updatedScrapeUrl);

    expect(updatedScrapeUrl.getStatus()).to.equal(data.status);
    expect(updatedScrapeUrl.getUrl()).to.equal(data.url);
    expect(updatedScrapeUrl.getFile()).to.equal(data.file);
    expect(updatedScrapeUrl.getReason()).to.equal(data.reason);
  });

  it('it gets all scrape urls by scrape job id', async () => {
    const scrapeJob = sampleData.scrapeJobs[0];
    const scrapeUrls = await ScrapeUrl.allByScrapeJobId(scrapeJob.getId());

    expect(scrapeUrls).to.be.an('array');
    expect(scrapeUrls.length).to.equal(6);

    scrapeUrls.forEach((scrapeUrl) => {
      expect(scrapeUrl.getScrapeJobId()).to.equal(scrapeJob.getId());
      checkScrapeUrl(scrapeUrl);
    });
  });

  it('it gets all scrape urls by job id and status', async () => {
    const scrapeJob = sampleData.scrapeJobs[0];
    const scrapeUrls = await ScrapeUrl.allByScrapeJobIdAndStatus(scrapeJob.getId(), 'RUNNING');

    expect(scrapeUrls).to.be.an('array');
    expect(scrapeUrls.length).to.equal(2);

    scrapeUrls.forEach((scrapeUrl) => {
      expect(scrapeUrl.getScrapeJobId()).to.equal(scrapeJob.getId());
      expect(scrapeUrl.getStatus()).to.equal('RUNNING');
      checkScrapeUrl(scrapeUrl);
    });
  });

  it('it gets all scrape urls for a given job by the URL status', async () => {
    const scrapeJob = sampleData.scrapeJobs[0];
    const scrapeUrls = await scrapeJob.getScrapeUrlsByStatus('FAILED');

    expect(scrapeUrls).to.be.an('array');
    expect(scrapeUrls.length).to.equal(1);
    expect(scrapeUrls[0].getReason()).to.equal('Failed to scrape the URL: Something went wrong. Oops!');
    expect(scrapeUrls[0].getScrapeJobId()).to.equal(scrapeJob.getId());
    expect(scrapeUrls[0].getStatus()).to.equal('FAILED');
  });

  it('finds an scrape url by its id', async () => {
    const sampleScrapeUrl = sampleData.scrapeUrls[0];
    const scrapeUrl = await ScrapeUrl.findById(sampleScrapeUrl.getId());

    checkScrapeUrl(scrapeUrl);
    expect(scrapeUrl.getId()).to.equal(sampleScrapeUrl.getId());
  });

  it('removes an scrape url', async () => {
    const sampleScrapeUrl = sampleData.scrapeUrls[0];
    const scrapeUrl = await ScrapeUrl.findById(sampleScrapeUrl.getId());

    await scrapeUrl.remove();

    const removedScrapeUrl = await ScrapeUrl.findById(sampleScrapeUrl.getId());
    expect(removedScrapeUrl).to.be.null;
  });
});
