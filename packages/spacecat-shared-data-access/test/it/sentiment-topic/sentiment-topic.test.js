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

use(chaiAsPromised);

function checkSentimentTopic(topic) {
  expect(topic).to.be.an('object');
  expect(topic.getSiteId()).to.be.a('string');
  expect(topic.getTopicId()).to.be.a('string');
  expect(topic.getName()).to.be.a('string');
  expect(topic.getSubPrompts()).to.be.an('array');
  expect(topic.getEnabled()).to.be.a('boolean');
  expect(topic.getCreatedAt()).to.be.a('string');
  expect(topic.getCreatedBy()).to.be.a('string');
}

// eslint-disable-next-line prefer-arrow-callback
describe('SentimentTopic IT', function () {
  let sampleData;
  let SentimentTopic;

  // eslint-disable-next-line prefer-arrow-callback
  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SentimentTopic = dataAccess.SentimentTopic;
  });

  it('gets all sentiment topics for a site', async () => {
    const site = sampleData.sites[0];

    const result = await SentimentTopic.allBySiteId(site.getId());

    expect(result).to.be.an('object');
    expect(result.data).to.be.an('array');
    expect(result.data.length).to.equal(3);

    result.data.forEach((topic) => {
      checkSentimentTopic(topic);
      expect(topic.getSiteId()).to.equal(site.getId());
    });
  });

  it('finds a sentiment topic by site ID and topic ID', async () => {
    const site = sampleData.sites[0];
    const topicId = sampleData.sentimentTopics[0].getTopicId();

    const topic = await SentimentTopic.findById(site.getId(), topicId);

    expect(topic).to.be.an('object');
    checkSentimentTopic(topic);
    expect(topic.getSiteId()).to.equal(site.getId());
    expect(topic.getTopicId()).to.equal(topicId);
  });

  it('returns null when sentiment topic not found', async () => {
    const site = sampleData.sites[0];
    const nonExistentId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

    const topic = await SentimentTopic.findById(site.getId(), nonExistentId);

    expect(topic).to.be.null;
  });

  it('creates a new sentiment topic', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'New Topic',
      description: 'A new test topic',
      subPrompts: ['prompt1', 'prompt2'],
      enabled: true,
      createdBy: 'test@example.com',
    };

    const topic = await SentimentTopic.create(data);

    checkSentimentTopic(topic);
    expect(topic.getSiteId()).to.equal(data.siteId);
    expect(topic.getName()).to.equal(data.name);
    expect(topic.getDescription()).to.equal(data.description);
    expect(topic.getSubPrompts()).to.deep.equal(data.subPrompts);
    expect(topic.getEnabled()).to.equal(data.enabled);
    expect(topic.getCreatedBy()).to.equal(data.createdBy);
  });

  it('creates a sentiment topic with default values', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'Minimal Topic',
      createdBy: 'test@example.com',
    };

    const topic = await SentimentTopic.create(data);

    checkSentimentTopic(topic);
    expect(topic.getEnabled()).to.equal(true); // Default
    expect(topic.getSubPrompts()).to.deep.equal([]); // Default
  });

  it('updates a sentiment topic', async () => {
    const site = sampleData.sites[0];
    const topicId = sampleData.sentimentTopics[0].getTopicId();
    const topic = await SentimentTopic.findById(site.getId(), topicId);

    topic.setName('Updated Name');
    topic.setDescription('Updated description');
    topic.setUpdatedBy('updater@example.com');

    const updated = await topic.save();

    expect(updated.getName()).to.equal('Updated Name');
    expect(updated.getDescription()).to.equal('Updated description');
    expect(updated.getUpdatedBy()).to.equal('updater@example.com');
  });

  it('removes a sentiment topic', async () => {
    const site = sampleData.sites[0];
    const data = {
      siteId: site.getId(),
      name: 'Topic to Delete',
      createdBy: 'test@example.com',
    };

    const topic = await SentimentTopic.create(data);
    const siteId = topic.getSiteId();
    const topicId = topic.getTopicId();

    await topic.remove();

    const deleted = await SentimentTopic.findById(siteId, topicId);
    expect(deleted).to.be.null;
  });

  describe('Custom Methods', () => {
    it('adds a sub-prompt', async () => {
      const site = sampleData.sites[0];
      const topicId = sampleData.sentimentTopics[0].getTopicId();
      const topic = await SentimentTopic.findById(site.getId(), topicId);
      const originalLength = topic.getSubPrompts().length;

      topic.addSubPrompt('New sub-prompt');

      expect(topic.getSubPrompts()).to.include('New sub-prompt');
      expect(topic.getSubPrompts().length).to.equal(originalLength + 1);
    });

    it('removes a sub-prompt', async () => {
      const site = sampleData.sites[0];
      const topicId = sampleData.sentimentTopics[0].getTopicId();
      const topic = await SentimentTopic.findById(site.getId(), topicId);

      // Ensure there's a prompt to remove
      const promptToRemove = topic.getSubPrompts()[0];
      if (promptToRemove) {
        topic.removeSubPrompt(promptToRemove);
        expect(topic.getSubPrompts()).to.not.include(promptToRemove);
      }
    });

    it('toggles enabled state', async () => {
      const site = sampleData.sites[0];
      const topicId = sampleData.sentimentTopics[0].getTopicId();
      const topic = await SentimentTopic.findById(site.getId(), topicId);
      const originalState = topic.getEnabled();

      topic.setEnabled(!originalState);

      expect(topic.getEnabled()).to.equal(!originalState);
    });
  });

  describe('Collection Methods', () => {
    it('gets enabled topics for a site', async () => {
      const site = sampleData.sites[0];

      const result = await SentimentTopic.allBySiteIdEnabled(site.getId());

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array');

      result.data.forEach((topic) => {
        expect(topic.getEnabled()).to.be.true;
      });
    });

    it('removes all topics for a site', async () => {
      const site = sampleData.sites[1];

      // Verify topics exist
      let result = await SentimentTopic.allBySiteId(site.getId());
      expect(result.data.length).to.be.greaterThan(0);

      // Remove all
      await SentimentTopic.removeForSiteId(site.getId());

      // Verify removed
      result = await SentimentTopic.allBySiteId(site.getId());
      expect(result.data.length).to.equal(0);
    });
  });

  describe('Validation', () => {
    it('rejects invalid UUID for siteId', async () => {
      const data = {
        siteId: 'invalid-uuid',
        name: 'Test Topic',
        createdBy: 'test@example.com',
      };

      await expect(SentimentTopic.create(data)).to.be.rejected;
    });

    it('requires siteId', async () => {
      const data = {
        name: 'Test Topic',
        createdBy: 'test@example.com',
      };

      await expect(SentimentTopic.create(data)).to.be.rejected;
    });

    it('requires name', async () => {
      const site = sampleData.sites[0];
      const data = {
        siteId: site.getId(),
        createdBy: 'test@example.com',
      };

      await expect(SentimentTopic.create(data)).to.be.rejected;
    });
  });
});
