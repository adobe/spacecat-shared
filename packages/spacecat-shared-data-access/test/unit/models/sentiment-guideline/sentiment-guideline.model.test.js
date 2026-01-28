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
      audits: ['wikipedia-analysis', 'reddit-analysis'],
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

  describe('isAuditEnabled', () => {
    it('returns true when audit is enabled', () => {
      expect(instance.isAuditEnabled('wikipedia-analysis')).to.be.true;
      expect(instance.isAuditEnabled('reddit-analysis')).to.be.true;
    });

    it('returns false when audit is not enabled', () => {
      expect(instance.isAuditEnabled('youtube-analysis')).to.be.false;
    });

    it('handles empty audits array', () => {
      instance.record.audits = [];
      expect(instance.isAuditEnabled('wikipedia-analysis')).to.be.false;
    });

    it('handles undefined audits', () => {
      instance.record.audits = undefined;
      expect(instance.isAuditEnabled('wikipedia-analysis')).to.be.false;
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentGuideline.prototype);
      plainObj.audits = ['wikipedia-analysis'];
      expect(plainObj.isAuditEnabled('wikipedia-analysis')).to.be.true;
    });
  });

  describe('enableAudit', () => {
    it('adds audit to the list when not present', () => {
      instance.enableAudit('youtube-analysis');
      expect(instance.getAudits()).to.include('youtube-analysis');
    });

    it('does not add duplicate audits', () => {
      const originalLength = instance.getAudits().length;
      instance.enableAudit('wikipedia-analysis'); // Already exists
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.enableAudit('youtube-analysis');
      expect(result).to.equal(instance);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentGuideline.prototype);
      plainObj.audits = [];
      plainObj.enableAudit('wikipedia-analysis');
      expect(plainObj.audits).to.deep.equal(['wikipedia-analysis']);
    });
  });

  describe('disableAudit', () => {
    it('removes audit from the list when present', () => {
      instance.disableAudit('wikipedia-analysis');
      expect(instance.getAudits()).to.not.include('wikipedia-analysis');
    });

    it('does nothing if audit is not in the list', () => {
      const originalLength = instance.getAudits().length;
      instance.disableAudit('youtube-analysis'); // Not in list
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.disableAudit('wikipedia-analysis');
      expect(result).to.equal(instance);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(SentimentGuideline.prototype);
      plainObj.audits = ['wikipedia-analysis', 'reddit-analysis'];
      plainObj.disableAudit('wikipedia-analysis');
      expect(plainObj.audits).to.deep.equal(['reddit-analysis']);
    });
  });
});
