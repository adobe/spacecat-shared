/*
 * Copyright 2024 Adobe. All rights reserved.
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

import AuditUrl from '../../../../src/models/audit-url/audit-url.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AuditUrlModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      auditUrlId: 'au12345',
      siteId: 'site12345',
      url: 'https://example.com/page',
      source: 'manual',
      audits: ['accessibility', 'broken-backlinks'],
      createdAt: '2025-10-27T12:00:00.000Z',
      createdBy: 'user@example.com',
      updatedAt: '2025-10-27T12:00:00.000Z',
      updatedBy: 'user@example.com',
    };

    ({
      model: instance,
    } = createElectroMocks(AuditUrl, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the AuditUrl instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('DEFAULT_SOURCE', () => {
    it('has the correct default source value', () => {
      expect(AuditUrl.DEFAULT_SOURCE).to.equal('manual');
    });
  });

  describe('isAuditEnabled', () => {
    it('returns true when audit is enabled', () => {
      expect(instance.isAuditEnabled('accessibility')).to.be.true;
      expect(instance.isAuditEnabled('broken-backlinks')).to.be.true;
    });

    it('returns false when audit is not enabled', () => {
      expect(instance.isAuditEnabled('lhs-mobile')).to.be.false;
      expect(instance.isAuditEnabled('seo')).to.be.false;
    });

    it('handles empty audits array', () => {
      instance.record.audits = [];
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });

    it('handles undefined audits', () => {
      instance.record.audits = undefined;
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });

    it('works with direct property access when getAudits is not available', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = ['accessibility'];
      expect(plainObj.isAuditEnabled('accessibility')).to.be.true;
    });
  });

  describe('enableAudit', () => {
    it('adds audit to the list when not present', () => {
      instance.enableAudit('lhs-mobile');
      expect(instance.getAudits()).to.include('lhs-mobile');
    });

    it('does not add duplicate audits', () => {
      const originalLength = instance.getAudits().length;
      instance.enableAudit('accessibility'); // Already exists
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.enableAudit('seo');
      expect(result).to.equal(instance);
    });

    it('works when starting with empty audits array', () => {
      instance.record.audits = [];
      instance.enableAudit('accessibility');
      expect(instance.getAudits()).to.deep.equal(['accessibility']);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = [];
      plainObj.enableAudit('accessibility');
      expect(plainObj.audits).to.deep.equal(['accessibility']);
    });
  });

  describe('disableAudit', () => {
    it('removes audit from the list when present', () => {
      instance.disableAudit('accessibility');
      expect(instance.getAudits()).to.not.include('accessibility');
    });

    it('does nothing if audit is not in the list', () => {
      const originalLength = instance.getAudits().length;
      instance.disableAudit('seo'); // Not in list
      expect(instance.getAudits().length).to.equal(originalLength);
    });

    it('returns the instance for method chaining', () => {
      const result = instance.disableAudit('accessibility');
      expect(result).to.equal(instance);
    });

    it('handles removing all audits', () => {
      instance.disableAudit('accessibility');
      instance.disableAudit('broken-backlinks');
      expect(instance.getAudits()).to.deep.equal([]);
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.audits = ['accessibility', 'seo'];
      plainObj.disableAudit('accessibility');
      expect(plainObj.audits).to.deep.equal(['seo']);
    });
  });

  describe('isManualSource', () => {
    it('returns true for manual source', () => {
      instance.record.source = 'manual';
      expect(instance.isManualSource()).to.be.true;
    });

    it('returns false for non-manual source', () => {
      instance.record.source = 'sitemap';
      expect(instance.isManualSource()).to.be.false;
    });

    it('returns false for other sources', () => {
      instance.record.source = 'api';
      expect(instance.isManualSource()).to.be.false;
    });

    it('works with direct property access', () => {
      const plainObj = Object.create(AuditUrl.prototype);
      plainObj.source = 'manual';
      expect(plainObj.isManualSource()).to.be.true;

      plainObj.source = 'sitemap';
      expect(plainObj.isManualSource()).to.be.false;
    });
  });

  describe('method chaining', () => {
    it('allows chaining enableAudit and disableAudit', () => {
      instance
        .enableAudit('seo')
        .enableAudit('lhs-mobile')
        .disableAudit('accessibility');

      expect(instance.isAuditEnabled('seo')).to.be.true;
      expect(instance.isAuditEnabled('lhs-mobile')).to.be.true;
      expect(instance.isAuditEnabled('accessibility')).to.be.false;
    });
  });

  describe('PLATFORM_TYPES', () => {
    it('exposes PLATFORM_TYPES as a static property', () => {
      expect(AuditUrl.PLATFORM_TYPES).to.be.an('object');
      expect(AuditUrl.PLATFORM_TYPES.PRIMARY_SITE).to.equal('primary-site');
      expect(AuditUrl.PLATFORM_TYPES.WIKIPEDIA).to.equal('wikipedia');
      expect(AuditUrl.PLATFORM_TYPES.YOUTUBE_CHANNEL).to.equal('youtube-channel');
    });
  });

  describe('isOffsitePlatform', () => {
    it('returns false for primary-site platform type', () => {
      instance.record.platformType = 'primary-site';
      expect(instance.isOffsitePlatform()).to.be.false;
    });

    it('returns true for youtube-channel platform type', () => {
      instance.record.platformType = 'youtube-channel';
      expect(instance.isOffsitePlatform()).to.be.true;
    });

    it('returns true for wikipedia platform type', () => {
      instance.record.platformType = 'wikipedia';
      expect(instance.isOffsitePlatform()).to.be.true;
    });

    it('returns true for reddit-community platform type', () => {
      instance.record.platformType = 'reddit-community';
      expect(instance.isOffsitePlatform()).to.be.true;
    });

    it('returns false when platformType is undefined', () => {
      delete instance.record.platformType;
      expect(instance.isOffsitePlatform()).to.be.false;
    });

    it('returns false when platformType is null', () => {
      instance.record.platformType = null;
      expect(instance.isOffsitePlatform()).to.be.false;
    });

    it('works with getPlatformType getter', () => {
      instance.getPlatformType = () => 'facebook-page';
      expect(instance.isOffsitePlatform()).to.be.true;
    });
  });

  describe('isPlatformType', () => {
    it('returns true when platform type matches', () => {
      instance.record.platformType = 'youtube-channel';
      expect(instance.isPlatformType('youtube-channel')).to.be.true;
    });

    it('returns false when platform type does not match', () => {
      instance.record.platformType = 'youtube-channel';
      expect(instance.isPlatformType('wikipedia')).to.be.false;
    });

    it('returns false when platformType is undefined', () => {
      delete instance.record.platformType;
      expect(instance.isPlatformType('youtube-channel')).to.be.false;
    });

    it('returns false when platformType is null', () => {
      instance.record.platformType = null;
      expect(instance.isPlatformType('youtube-channel')).to.be.false;
    });

    it('works with getPlatformType getter', () => {
      instance.getPlatformType = () => 'twitter-profile';
      expect(instance.isPlatformType('twitter-profile')).to.be.true;
      expect(instance.isPlatformType('linkedin-company')).to.be.false;
    });

    it('handles all platform types correctly', () => {
      const platformTypes = [
        'primary-site',
        'wikipedia',
        'youtube-channel',
        'reddit-community',
        'facebook-page',
        'twitter-profile',
        'linkedin-company',
        'instagram-account',
        'tiktok-account',
        'github-org',
        'medium-publication',
      ];

      platformTypes.forEach((type) => {
        instance.record.platformType = type;
        expect(instance.isPlatformType(type)).to.be.true;
      });
    });
  });
});
