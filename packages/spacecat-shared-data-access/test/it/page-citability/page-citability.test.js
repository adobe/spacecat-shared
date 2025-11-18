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

use(chaiAsPromised);

function checkPageReadability(pr) {
  expect(pr).to.be.an('object');
  expect(pr.getUrl()).to.be.a('string');
  expect(pr.getSiteId()).to.be.a('string');
  expect(pr.getCreatedAt()).to.be.a('string');
  expect(pr.getUpdatedAt()).to.be.a('string');

  // Optional numeric fields - can be number or undefined
  const citabilityScore = pr.getCitabilityScore();
  if (citabilityScore !== undefined) {
    expect(citabilityScore).to.be.a('number');
  }

  const contentRatio = pr.getContentRatio();
  if (contentRatio !== undefined) {
    expect(contentRatio).to.be.a('number');
  }

  const wordDifference = pr.getWordDifference();
  if (wordDifference !== undefined) {
    expect(wordDifference).to.be.a('number');
  }

  const botWords = pr.getBotWords();
  if (botWords !== undefined) {
    expect(botWords).to.be.a('number');
  }

  const normalWords = pr.getNormalWords();
  if (normalWords !== undefined) {
    expect(normalWords).to.be.a('number');
  }
}

describe('PageReadability IT', async () => {
  let PageReadability;

  before(async () => {
    const dataAccess = getDataAccess();
    PageReadability = dataAccess.PageReadability;
  });

  it('adds a new page readability record', async () => {
    const data = {
      url: 'https://www.example.com/test-page',
      siteId: '1c86ba81-f3cc-48d8-8b06-1f9ac958e72d',
      citabilityScore: 0.85,
      contentRatio: 1.25,
      wordDifference: 150,
      botWords: 500,
      normalWords: 650,
    };
    const pr = await PageReadability.create(data);

    checkPageReadability(pr);

    expect(pr.getUrl()).to.equal(data.url);
    expect(pr.getSiteId()).to.equal(data.siteId);
    expect(pr.getCitabilityScore()).to.equal(data.citabilityScore);
    expect(pr.getContentRatio()).to.equal(data.contentRatio);
    expect(pr.getWordDifference()).to.equal(data.wordDifference);
    expect(pr.getBotWords()).to.equal(data.botWords);
    expect(pr.getNormalWords()).to.equal(data.normalWords);
  });

  it('finds page readability by URL', async () => {
    const testUrl = 'https://www.example.com/findable-page';
    const data = {
      url: testUrl,
      siteId: '1c86ba81-f3cc-48d8-8b06-1f9ac958e72d',
      citabilityScore: 0.75,
      contentRatio: 1.15,
      wordDifference: 100,
      botWords: 400,
      normalWords: 500,
    };

    await PageReadability.create(data);
    const pr = await PageReadability.findByUrl(testUrl);

    checkPageReadability(pr);
    expect(pr.getUrl()).to.equal(testUrl);
  });

  it('returns null when page readability is not found by URL', async () => {
    const pr = await PageReadability.findByUrl('https://no-such-page.example.com');
    expect(pr).to.be.null;
  });

  it('updates a page readability record', async () => {
    const testUrl = 'https://www.example.com/updatable-page';
    const data = {
      url: testUrl,
      siteId: '1c86ba81-f3cc-48d8-8b06-1f9ac958e72d',
      citabilityScore: 0.60,
      contentRatio: 1.05,
      wordDifference: 50,
      botWords: 300,
      normalWords: 350,
    };

    await PageReadability.create(data);
    const pr = await PageReadability.findByUrl(testUrl);

    const updates = {
      citabilityScore: 0.90,
      contentRatio: 1.40,
      wordDifference: 200,
      botWords: 600,
      normalWords: 800,
      updatedBy: 'test-user',
    };

    pr.setCitabilityScore(updates.citabilityScore);
    pr.setContentRatio(updates.contentRatio);
    pr.setWordDifference(updates.wordDifference);
    pr.setBotWords(updates.botWords);
    pr.setNormalWords(updates.normalWords);
    pr.setUpdatedBy(updates.updatedBy);

    await pr.save();

    checkPageReadability(pr);

    expect(pr.getCitabilityScore()).to.equal(updates.citabilityScore);
    expect(pr.getContentRatio()).to.equal(updates.contentRatio);
    expect(pr.getWordDifference()).to.equal(updates.wordDifference);
    expect(pr.getBotWords()).to.equal(updates.botWords);
    expect(pr.getNormalWords()).to.equal(updates.normalWords);
    expect(pr.getUpdatedBy()).to.equal(updates.updatedBy);
  });

  it('handles missing stats gracefully', async () => {
    const data = {
      url: 'https://www.example.com/partial-stats',
      siteId: '1c86ba81-f3cc-48d8-8b06-1f9ac958e72d',
      citabilityScore: 0.75,
      // contentRatio intentionally missing
      // wordDifference intentionally missing
      botWords: 300,
      // normalWords intentionally missing
    };

    const pr = await PageReadability.create(data);

    checkPageReadability(pr);

    expect(pr.getCitabilityScore()).to.equal(0.75);
    expect(pr.getContentRatio()).to.be.undefined;
    expect(pr.getWordDifference()).to.be.undefined;
    expect(pr.getBotWords()).to.equal(300);
    expect(pr.getNormalWords()).to.be.undefined;
  });
});
