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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import SentimentTopic from '../../../../src/models/sentiment-topic/sentiment-topic.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SentimentTopicModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      topicId: 'topic-12345',
      siteId: 'site-12345',
      name: 'BMW XM Latest',
      description: 'Track sentiment around the BMW XM luxury SUV',
      enabled: true,
      createdAt: '2026-01-21T12:00:00.000Z',
      createdBy: 'user@example.com',
      updatedAt: '2026-01-21T12:00:00.000Z',
      updatedBy: 'user@example.com',
    };

    ({
      model: instance,
    } = createElectroMocks(SentimentTopic, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SentimentTopic instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('generateCompositeKeys', () => {
    it('returns composite keys with siteId and topicId', () => {
      const result = instance.generateCompositeKeys();

      expect(result).to.be.an('object');
      expect(result).to.have.property('siteId');
      expect(result).to.have.property('topicId');
      expect(result.siteId).to.equal(mockRecord.siteId);
      expect(result.topicId).to.equal(mockRecord.topicId);
    });

    it('returns the same values as getSiteId and getTopicId methods', () => {
      const result = instance.generateCompositeKeys();

      expect(result.siteId).to.equal(instance.getSiteId());
      expect(result.topicId).to.equal(instance.getTopicId());
    });
  });
});
