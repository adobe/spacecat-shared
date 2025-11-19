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

function checkPageCitability(pc) {
  expect(pc).to.be.an('object');
  expect(pc.getUrl()).to.be.a('string');
  expect(pc.getSiteId()).to.be.a('string');
  expect(pc.getCreatedAt()).to.be.a('string');
  expect(pc.getUpdatedAt()).to.be.a('string');

  // Optional numeric fields - can be number or undefined
  const citabilityScore = pc.getCitabilityScore();
  if (citabilityScore !== undefined) {
    expect(citabilityScore).to.be.a('number');
  }

  const contentRatio = pc.getContentRatio();
  if (contentRatio !== undefined) {
    expect(contentRatio).to.be.a('number');
  }

  const wordDifference = pc.getWordDifference();
  if (wordDifference !== undefined) {
    expect(wordDifference).to.be.a('number');
  }

  const botWords = pc.getBotWords();
  if (botWords !== undefined) {
    expect(botWords).to.be.a('number');
  }

  const normalWords = pc.getNormalWords();
  if (normalWords !== undefined) {
    expect(normalWords).to.be.a('number');
  }
}

describe('PageCitability IT', async () => {
  let PageCitability;

  before(async () => {
    const dataAccess = getDataAccess();
    PageCitability = dataAccess.PageCitability;
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
    const pc = await PageCitability.create(data);

    checkPageCitability(pc);

    expect(pc.getUrl()).to.equal(data.url);
    expect(pc.getSiteId()).to.equal(data.siteId);
    expect(pc.getCitabilityScore()).to.equal(data.citabilityScore);
    expect(pc.getContentRatio()).to.equal(data.contentRatio);
    expect(pc.getWordDifference()).to.equal(data.wordDifference);
    expect(pc.getBotWords()).to.equal(data.botWords);
    expect(pc.getNormalWords()).to.equal(data.normalWords);
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

    await PageCitability.create(data);
    const pc = await PageCitability.findByUrl(testUrl);

    checkPageCitability(pc);
    expect(pc.getUrl()).to.equal(testUrl);
  });

  it('returns null when page readability is not found by URL', async () => {
    const pc = await PageCitability.findByUrl('https://no-such-page.example.com');
    expect(pc).to.be.null;
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

    await PageCitability.create(data);
    const pc = await PageCitability.findByUrl(testUrl);

    const updates = {
      citabilityScore: 0.90,
      contentRatio: 1.40,
      wordDifference: 200,
      botWords: 600,
      normalWords: 800,
      updatedBy: 'test-user',
    };

    pc.setCitabilityScore(updates.citabilityScore);
    pc.setContentRatio(updates.contentRatio);
    pc.setWordDifference(updates.wordDifference);
    pc.setBotWords(updates.botWords);
    pc.setNormalWords(updates.normalWords);
    pc.setUpdatedBy(updates.updatedBy);

    await pc.save();

    checkPageCitability(pc);

    expect(pc.getCitabilityScore()).to.equal(updates.citabilityScore);
    expect(pc.getContentRatio()).to.equal(updates.contentRatio);
    expect(pc.getWordDifference()).to.equal(updates.wordDifference);
    expect(pc.getBotWords()).to.equal(updates.botWords);
    expect(pc.getNormalWords()).to.equal(updates.normalWords);
    expect(pc.getUpdatedBy()).to.equal(updates.updatedBy);
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

    const pc = await PageCitability.create(data);

    checkPageCitability(pc);

    expect(pc.getCitabilityScore()).to.equal(0.75);
    expect(pc.getContentRatio()).to.be.undefined;
    expect(pc.getWordDifference()).to.be.undefined;
    expect(pc.getBotWords()).to.equal(300);
    expect(pc.getNormalWords()).to.be.undefined;
  });
});
