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
      subPrompts: ['What about hybrid performance?', 'Interior quality?'],
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

  describe('addSubPrompt', () => {
    it('adds sub-prompt to the list', () => {
      instance.addSubPrompt('New question about pricing?');
      expect(instance.getSubPrompts()).to.include('New question about pricing?');
    });

    it('allows duplicate sub-prompts (list behavior)', () => {
      const originalLength = instance.getSubPrompts().length;
      instance.addSubPrompt('What about hybrid performance?'); // Already exists
      expect(instance.getSubPrompts().length).to.equal(originalLength + 1);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.addSubPrompt('New prompt');
      expect(result).to.equal(instance);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentTopic.prototype);
      plainObj.subPrompts = [];
      plainObj.addSubPrompt('First prompt');
      expect(plainObj.subPrompts).to.deep.equal(['First prompt']);
    });
  });

  describe('removeSubPrompt', () => {
    it('removes sub-prompt when present', () => {
      instance.removeSubPrompt('What about hybrid performance?');
      expect(instance.getSubPrompts()).to.not.include('What about hybrid performance?');
    });

    it('does nothing if sub-prompt is not in the list', () => {
      const originalLength = instance.getSubPrompts().length;
      instance.removeSubPrompt('Non-existent prompt');
      expect(instance.getSubPrompts().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.removeSubPrompt('What about hybrid performance?');
      expect(result).to.equal(instance);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentTopic.prototype);
      plainObj.subPrompts = ['Prompt 1', 'Prompt 2'];
      plainObj.removeSubPrompt('Prompt 1');
      expect(plainObj.subPrompts).to.deep.equal(['Prompt 2']);
    });
  });

  describe('method chaining', () => {
    it('allows chaining multiple methods', () => {
      instance
        .addSubPrompt('New prompt')
        .removeSubPrompt('Interior quality?');

      expect(instance.getSubPrompts()).to.include('New prompt');
      expect(instance.getSubPrompts()).to.not.include('Interior quality?');
    });
  });
});
