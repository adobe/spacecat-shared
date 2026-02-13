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
import { sanitizeTimestamps } from '../../../src/util/util.js';

use(chaiAsPromised);

function checkPageIntent(pi) {
  expect(pi).to.be.an('object');
  expect(pi.getUrl()).to.be.a('string');
  expect(pi.getSiteId()).to.be.a('string');
  expect(pi.getPageIntent()).to.be.a('string');
  expect(pi.getTopic()).to.be.a('string');
  expect(pi.getCreatedAt()).to.be.a('string');
  expect(pi.getUpdatedAt()).to.be.a('string');
}

describe('PageIntent IT', async () => {
  let sampleData;
  let PageIntent;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    PageIntent = dataAccess.PageIntent;
  });

  it('finds one page intent by URL', async () => {
    const sample = sampleData.pageIntents[3];

    const pi = await PageIntent.findByUrl(sample.getUrl());

    checkPageIntent(pi);

    expect(
      sanitizeTimestamps(pi.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sample.toJSON()),
    );
  });

  it('returns null when page intent is not found by URL', async () => {
    const pi = await PageIntent.findByUrl('https://no-such-page.example.com');

    expect(pi).to.be.null;
  });

  it('adds a new page intent', async () => {
    const data = {
      url: 'https://www.example.com/new-page',
      siteId: '1c86ba81-f3cc-48d8-8b06-1f9ac958e72d',
      pageIntent: 'INFORMATIONAL',
      topic: 'example-topic',
    };
    const pi = await PageIntent.create(data);

    checkPageIntent(pi);

    expect(pi.getUrl()).to.equal(data.url);
    expect(pi.getSiteId()).to.equal(data.siteId);
    expect(pi.getPageIntent()).to.equal(data.pageIntent);
    expect(pi.getTopic()).to.equal(data.topic);
  });

  it('updates a page intent', async () => {
    const sample = sampleData.pageIntents[0];
    const updates = {
      url: 'https://www.updated.com/page',
      siteId: '45508663-a89b-44ea-9a89-a216f8086212',
      pageIntent: 'TRANSACTIONAL',
      topic: 'updated-topic',
      updatedBy: 'test-user',
    };

    const pi = await PageIntent.findByUrl(sample.getUrl());

    pi.setUrl(updates.url);
    pi.setSiteId(updates.siteId);
    pi.setPageIntent(updates.pageIntent);
    pi.setTopic(updates.topic);
    pi.setUpdatedBy(updates.updatedBy);

    await pi.save();

    checkPageIntent(pi);

    expect(pi.getUrl()).to.equal(updates.url);
    expect(pi.getSiteId()).to.equal(updates.siteId);
    expect(pi.getPageIntent()).to.equal(updates.pageIntent);
    expect(pi.getTopic()).to.equal(updates.topic);
    expect(pi.getUpdatedBy()).to.equal(updates.updatedBy);
  });
});
