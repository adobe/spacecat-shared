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

import SentimentGuideline from '../../../../src/models/sentiment-guideline/sentiment-guideline.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SentimentGuidelineModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      guidelineId: 'guideline-12345',
      siteId: 'site-12345',
      name: 'Product Quality Focus',
      instruction: 'Analyze sentiment around build quality, materials, reliability, and durability.',
      enabled: true,
      createdAt: '2026-01-21T12:00:00.000Z',
      createdBy: 'user@example.com',
      updatedAt: '2026-01-21T12:00:00.000Z',
      updatedBy: 'user@example.com',
    };

    ({
      model: instance,
    } = createElectroMocks(SentimentGuideline, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SentimentGuideline instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('isEnabled', () => {
    it('returns true when guideline is enabled', () => {
      instance.record.enabled = true;
      expect(instance.isEnabled()).to.be.true;
    });

    it('returns false when guideline is disabled', () => {
      instance.record.enabled = false;
      expect(instance.isEnabled()).to.be.false;
    });

    it('defaults to true when enabled is undefined', () => {
      instance.record.enabled = undefined;
      expect(instance.isEnabled()).to.be.true;
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentGuideline.prototype);
      plainObj.enabled = true;
      expect(plainObj.isEnabled()).to.be.true;

      plainObj.enabled = false;
      expect(plainObj.isEnabled()).to.be.false;
    });
  });
});
