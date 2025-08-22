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
import sinon, { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Audit from '../../../../src/models/audit/audit.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AuditModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      auditId: 'a12345',
      auditResult: { foo: 'bar' },
      auditType: 'someAuditType',
      auditedAt: '2024-01-01T00:00:00.000Z',
      fullAuditRef: 'someFullAuditRef',
      isLive: true,
      isError: false,
      siteId: 'site12345',
    };

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Audit, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Audit instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('auditId', () => {
    it('gets auditId', () => {
      expect(instance.getId()).to.equal('a12345');
    });
  });

  describe('auditResult', () => {
    it('gets auditResult', () => {
      expect(instance.getAuditResult()).to.deep.equal({ foo: 'bar' });
    });
  });

  describe('auditType', () => {
    it('gets auditType', () => {
      expect(instance.getAuditType()).to.equal('someAuditType');
    });
  });

  describe('auditedAt', () => {
    it('gets auditedAt', () => {
      expect(instance.getAuditedAt()).to.equal('2024-01-01T00:00:00.000Z');
    });
  });

  describe('fullAuditRef', () => {
    it('gets fullAuditRef', () => {
      expect(instance.getFullAuditRef()).to.equal('someFullAuditRef');
    });
  });

  describe('isLive', () => {
    it('gets isLive', () => {
      expect(instance.getIsLive()).to.be.true;
    });
  });

  describe('isError', () => {
    it('gets isError', () => {
      expect(instance.getIsError()).to.be.false;
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('site12345');
    });
  });

  describe('getScores', () => {
    it('returns the scores from the audit result', () => {
      mockRecord.auditResult = { scores: { foo: 'bar' } };
      expect(instance.getScores()).to.deep.equal({ foo: 'bar' });
    });
  });

  describe('validateAuditResult', () => {
    it('throws an error if auditResult is not an object or array', () => {
      expect(() => Audit.validateAuditResult(null, 'someAuditType'))
        .to.throw('Audit result must be an object or array');
    });

    it('throws an error if auditResult is an object and does not contain scores', () => {
      expect(() => Audit.validateAuditResult({ foo: 'bar' }, 'lhs-mobile'))
        .to.throw("Missing scores property for audit type 'lhs-mobile'");
    });

    it('throws an error if auditResult is an object and does not contain expected properties', () => {
      mockRecord.auditResult = { scores: { foo: 'bar' } };
      expect(() => Audit.validateAuditResult(mockRecord.auditResult, 'lhs-desktop'))
        .to.throw("Missing expected property 'performance' for audit type 'lhs-desktop'");
    });

    it('returns true if the auditResult represents a runtime error', () => {
      mockRecord.auditResult = { runtimeError: { code: 'someErrorCode' } };
      expect(Audit.validateAuditResult(mockRecord.auditResult, 'someAuditType')).to.be.true;
    });

    it('returns true if auditResult is an object and contains expected properties', () => {
      mockRecord.auditResult = {
        scores: {
          performance: 1, seo: 1, accessibility: 1, 'best-practices': 1,
        },
      };
      expect(Audit.validateAuditResult(mockRecord.auditResult, 'lhs-mobile')).to.be.true;
    });

    it('returns true if auditResult is an object and contains all expected properties for lhs-desktop', () => {
      mockRecord.auditResult = {
        scores: {
          performance: 0.95, seo: 0.88, accessibility: 0.92, 'best-practices': 0.85,
        },
      };
      expect(Audit.validateAuditResult(mockRecord.auditResult, 'lhs-desktop')).to.be.true;
    });

    it('returns true if auditResult is an object and contains all expected properties for lhs-mobile with different values', () => {
      mockRecord.auditResult = {
        scores: {
          performance: 0.75, seo: 0.92, accessibility: 0.88, 'best-practices': 0.95,
        },
      };
      expect(Audit.validateAuditResult(mockRecord.auditResult, 'lhs-mobile')).to.be.true;
    });

    it('returns true if auditResult is an object and contains all expected properties for lhs-desktop with all properties present', () => {
      // This test specifically targets the loop execution in lines 170-178
      const auditResult = {
        scores: {
          performance: 0.85,
          seo: 0.90,
          accessibility: 0.95,
          'best-practices': 0.88,
        },
      };

      // Verify that expectedProperties exists for lhs-desktop
      const expectedProperties = Audit.AUDIT_CONFIG.PROPERTIES['lhs-desktop'];
      expect(expectedProperties).to.be.an('array');
      expect(expectedProperties).to.have.lengthOf(4);

      // This should execute the loop and return true
      expect(Audit.validateAuditResult(auditResult, 'lhs-desktop')).to.be.true;
    });

    it('returns true if auditResult is an object and contains all expected properties for lhs-mobile with explicit loop execution', () => {
      // This test specifically targets the loop execution in lines 170-178
      // by ensuring the loop executes for all properties
      const auditResult = {
        scores: {
          performance: 0.75,
          seo: 0.92,
          accessibility: 0.88,
          'best-practices': 0.95,
        },
      };

      // Verify that expectedProperties exists for lhs-mobile
      const expectedProperties = Audit.AUDIT_CONFIG.PROPERTIES['lhs-mobile'];
      expect(expectedProperties).to.be.an('array');
      expect(expectedProperties).to.have.lengthOf(4);

      // Verify each property exists in the scores object
      expectedProperties.forEach((prop) => {
        expect(auditResult.scores).to.have.property(prop);
      });

      // This should execute the loop and return true
      expect(Audit.validateAuditResult(auditResult, 'lhs-mobile')).to.be.true;
    });

    it('returns true when validating lhs-desktop audit with all required properties present (covering loop execution)', () => {
      // This test specifically targets the validation loop that checks each expected property
      const auditResult = {
        scores: {
          performance: 0.85,
          seo: 0.90,
          accessibility: 0.95,
          'best-practices': 0.88,
          // Adding extra properties to ensure we're testing the specific ones
          extraProperty: 0.99,
        },
      };

      // This call should execute the property validation loop in validateAuditResult
      const result = Audit.validateAuditResult(auditResult, 'lhs-desktop');
      expect(result).to.be.true;
    });

    it('validates each expected property exists for lhs-mobile audit type', () => {
      // Create an audit result with all required properties for lhs-mobile
      const auditResult = {
        scores: {
          performance: 0.75,
          seo: 0.92,
          accessibility: 0.88,
          'best-practices': 0.95,
        },
      };

      // This should trigger the validation loop for each property
      const result = Audit.validateAuditResult(auditResult, 'lhs-mobile');
      expect(result).to.be.true;
    });

    it('returns true if auditResult is an array', () => {
      mockRecord.auditResult = [{ scores: { foo: 'bar' } }];
      expect(Audit.validateAuditResult(mockRecord.auditResult, 'experimentation')).to.be.true;
    });
  });

  describe('AuditTypes', () => {
    const auditTypes = Audit.AUDIT_TYPES;
    const expectedAuditTypes = {
      APEX: 'apex',
      CWV: 'cwv',
      LHS_MOBILE: 'lhs-mobile',
      LHS_DESKTOP: 'lhs-desktop',
      404: '404',
      SITEMAP: 'sitemap',
      REDIRECT_CHAINS: 'redirect-chains',
      CANONICAL: 'canonical',
      BROKEN_BACKLINKS: 'broken-backlinks',
      BROKEN_INTERNAL_LINKS: 'broken-internal-links',
      EXPERIMENTATION: 'experimentation',
      CONVERSION: 'conversion',
      ORGANIC_KEYWORDS: 'organic-keywords',
      ORGANIC_TRAFFIC: 'organic-traffic',
      EXPERIMENTATION_ESS_DAILY: 'experimentation-ess-daily',
      EXPERIMENTATION_ESS_MONTHLY: 'experimentation-ess-monthly',
      EXPERIMENTATION_OPPORTUNITIES: 'experimentation-opportunities',
      META_TAGS: 'meta-tags',
      COSTS: 'costs',
      STRUCTURED_DATA: 'structured-data',
      STRUCTURED_DATA_AUTO_SUGGEST: 'structured-data-auto-suggest',
      FORMS_OPPORTUNITIES: 'forms-opportunities',
      SITE_DETECTION: 'site-detection',
      ALT_TEXT: 'alt-text',
      ACCESSIBILITY: 'accessibility',
      SECURITY_CSP: 'security-csp',
      PAID: 'paid',
      HREFLANG: 'hreflang',
      PAID_TRAFFIC_ANALYSIS_WEEKLY: 'paid-traffic-analysis-weekly',
      PAID_TRAFFIC_ANALYSIS_MONTHLY: 'paid-traffic-analysis-monthly',
      READABILITY: 'readability',
    };

    it('should have all audit types present in AUDIT_TYPES', () => {
      expect(auditTypes).to.eql(expectedAuditTypes);
      expect(Object.keys(auditTypes)).to.have.lengthOf(31);
    });

    it('should not have unexpected audit types in AUDIT_TYPES', () => {
      const unexpectedAuditTypes = { UNEXPECTED: 'unexpected', UNEXPECTED2: 'unexpected2' };
      expect(auditTypes).to.eql(expectedAuditTypes);
      expect(auditTypes).to.not.have.keys(unexpectedAuditTypes);
      expect(Object.values(auditTypes)).to.not.have.members(Object.values(unexpectedAuditTypes));
    });
  });

  describe('Audit Destination Configs', () => {
    const auditStepDestinations = Audit.AUDIT_STEP_DESTINATIONS;
    const auditStepDestinationConfigs = Audit.AUDIT_STEP_DESTINATION_CONFIGS;

    it('has all audit step destinations present in AUDIT_STEP_DESTINATIONS', () => {
      const expectedAuditStepDestinations = {
        CONTENT_SCRAPER: 'content-scraper',
        IMPORT_WORKER: 'import-worker',
        SCRAPE_CLIENT: 'scrape-client',
      };

      expect(auditStepDestinations).to.eql(expectedAuditStepDestinations);
      expect(Object.keys(auditStepDestinations)).to.have.lengthOf(3);
    });

    it('does not have unexpected audit step destinations in AUDIT_STEP_DESTINATIONS', () => {
      const unexpectedAuditStepDestinations = { UNEXPECTED: 'unexpected', UNEXPECTED2: 'unexpected2' };
      expect(auditStepDestinations).to.not.have.keys(unexpectedAuditStepDestinations);
      expect(Object.values(auditStepDestinations))
        .to.not.have.members(Object.values(unexpectedAuditStepDestinations));
    });

    it('has all audit step destination configs present in AUDIT_STEP_DESTINATION_CONFIGS', () => {
      const expectedAuditStepDestinationConfigs = {
        [auditStepDestinations.CONTENT_SCRAPER]: {
          queueUrl: process.env.CONTENT_SCRAPER_QUEUE_URL,
          formatPayload: sinon.match.func,
        },
        [auditStepDestinations.IMPORT_WORKER]: {
          queueUrl: process.env.IMPORT_WORKER_QUEUE_URL,
          formatPayload: sinon.match.func,
        },
        [auditStepDestinations.SCRAPE_CLIENT]: {
          formatPayload: sinon.match.func,
        },
      };

      sinon.assert.match(auditStepDestinationConfigs, expectedAuditStepDestinationConfigs);
    });

    it('does not have unexpected audit step destination configs in AUDIT_STEP_DESTINATION_CONFIGS', () => {
      const unexpectedAuditStepDestinationConfigs = { UNEXPECTED: 'unexpected', UNEXPECTED2: 'unexpected2' };
      expect(auditStepDestinationConfigs).to.not.have.keys(unexpectedAuditStepDestinationConfigs);
      expect(Object.values(auditStepDestinationConfigs))
        .to.not.have.members(Object.values(unexpectedAuditStepDestinationConfigs));
    });

    it('formats import worker payload correctly', () => {
      const stepResult = {
        type: 'someType',
        siteId: 'someSiteId',
        endDate: '2025-08-12T15:46:00.000Z',
        urlConfigs: [{ url: 'someUrl', geo: 'someGeo' }],
      };
      const auditContext = { some: 'context' };
      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.IMPORT_WORKER]
        .formatPayload(stepResult, auditContext);

      expect(formattedPayload).to.deep.equal({
        type: 'someType',
        siteId: 'someSiteId',
        pageUrl: undefined,
        startDate: undefined,
        endDate: '2025-08-12T15:46:00.000Z',
        urlConfigs: [{ url: 'someUrl', geo: 'someGeo' }],
        allowCache: true,
        auditContext: { some: 'context' },
      });
    });

    it('formats content scraper payload correctly', () => {
      const stepResult = {
        urls: [{ url: 'someUrl' }],
        siteId: 'someSiteId',
        options: { someOption: 'someValue' },
        processingType: 'someProcessingType',
      };
      const context = {
        env: {
          AUDIT_JOBS_QUEUE_URL: 'audit-jobs-queue-url',
        },
      };
      const auditContext = { some: 'context' };
      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.CONTENT_SCRAPER]
        .formatPayload(stepResult, auditContext, context);

      expect(formattedPayload).to.deep.equal({
        urls: [{ url: 'someUrl' }],
        jobId: 'someSiteId',
        processingType: 'someProcessingType',
        completionQueueUrl: 'audit-jobs-queue-url',
        skipMessage: false,
        allowCache: true,
        options: { someOption: 'someValue' },
        auditContext: { some: 'context' },
      });
    });

    it('formats content scraper payload with default processing type when not provided', () => {
      const stepResult = {
        urls: [{ url: 'someUrl' }],
        siteId: 'someSiteId',
        // processingType is not provided
      };
      const context = {
        env: {
          AUDIT_JOBS_QUEUE_URL: 'audit-jobs-queue-url',
        },
      };
      const auditContext = { some: 'context' };
      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.CONTENT_SCRAPER]
        .formatPayload(stepResult, auditContext, context);

      expect(formattedPayload).to.deep.equal({
        urls: [{ url: 'someUrl' }],
        jobId: 'someSiteId',
        processingType: 'default', // Should use default when not provided
        completionQueueUrl: 'audit-jobs-queue-url',
        skipMessage: false,
        allowCache: true,
        options: {},
        auditContext: { some: 'context' },
      });
    });

    it('formats content scraper payload with explicit allowCache boolean value', () => {
      const stepResult = {
        urls: [{ url: 'someUrl' }],
        siteId: 'someSiteId',
        processingType: 'someProcessingType',
        allowCache: false, // Explicit boolean value
      };
      const context = {
        env: {
          AUDIT_JOBS_QUEUE_URL: 'audit-jobs-queue-url',
        },
      };
      const auditContext = { some: 'context' };
      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.CONTENT_SCRAPER]
        .formatPayload(stepResult, auditContext, context);

      expect(formattedPayload).to.deep.equal({
        urls: [{ url: 'someUrl' }],
        jobId: 'someSiteId',
        processingType: 'someProcessingType',
        completionQueueUrl: 'audit-jobs-queue-url',
        skipMessage: false,
        allowCache: false, // Should use the explicit boolean value
        options: {},
        auditContext: { some: 'context' },
      });
    });

    it('gets import worker queue URL from context', () => {
      const context = {
        env: {
          IMPORT_WORKER_QUEUE_URL: 'import-worker-queue-url',
        },
      };
      const queueUrl = auditStepDestinationConfigs[auditStepDestinations.IMPORT_WORKER]
        .getQueueUrl(context);

      expect(queueUrl).to.equal('import-worker-queue-url');
    });

    it('gets content scraper queue URL from context', () => {
      const context = {
        env: {
          CONTENT_SCRAPER_QUEUE_URL: 'content-scraper-queue-url',
        },
      };
      const queueUrl = auditStepDestinationConfigs[auditStepDestinations.CONTENT_SCRAPER]
        .getQueueUrl(context);

      expect(queueUrl).to.equal('content-scraper-queue-url');
    });

    it('returns undefined when queue URL is not in context', () => {
      const context = {
        env: {},
      };
      const queueUrl = auditStepDestinationConfigs[auditStepDestinations.IMPORT_WORKER]
        .getQueueUrl(context);

      expect(queueUrl).to.be.undefined;
    });

    it('returns undefined when context env is undefined', () => {
      const context = {};
      const queueUrl = auditStepDestinationConfigs[auditStepDestinations.CONTENT_SCRAPER]
        .getQueueUrl(context);

      expect(queueUrl).to.be.undefined;
    });

    it('formats scrape client payload correctly', () => {
      const stepResult = {
        urls: [{ url: 'https://example.com/page1' }, { url: 'https://example.com/page2' }],
        siteId: 'test-site-id',
        processingType: 'custom-processing',
        options: { depth: 2, wait: 1000 },
        maxScrapeAge: 48,
        completionQueueUrl: 'custom-completion-queue-url',
      };
      const context = {
        env: {
          AUDIT_JOBS_QUEUE_URL: 'audit-jobs-queue-url',
        },
      };
      const auditContext = { auditId: 'test-audit-id', auditType: 'test-type' };

      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.SCRAPE_CLIENT]
        .formatPayload(stepResult, auditContext, context);

      expect(formattedPayload).to.deep.equal({
        urls: ['https://example.com/page1', 'https://example.com/page2'],
        processingType: 'custom-processing',
        options: { depth: 2, wait: 1000 },
        maxScrapeAge: 48,
        auditData: {
          siteId: 'test-site-id',
          completionQueueUrl: 'custom-completion-queue-url',
          auditContext: { auditId: 'test-audit-id', auditType: 'test-type' },
        },
      });
    });

    it('formats scrape client payload with default values when not provided', () => {
      const stepResult = {
        urls: [{ url: 'https://example.com/page1' }],
        siteId: 'test-site-id',
        // processingType, options, maxScrapeAge, and completionQueueUrl are not provided
      };
      const context = {
        env: {
          AUDIT_JOBS_QUEUE_URL: 'audit-jobs-queue-url',
        },
      };
      const auditContext = { auditId: 'test-audit-id' };

      const formattedPayload = auditStepDestinationConfigs[auditStepDestinations.SCRAPE_CLIENT]
        .formatPayload(stepResult, auditContext, context);

      expect(formattedPayload).to.deep.equal({
        urls: ['https://example.com/page1'],
        processingType: 'default', // Should use default when not provided
        options: {}, // Should use empty object when not provided
        maxScrapeAge: 24, // Should use default value of 24
        auditData: {
          siteId: 'test-site-id',
          completionQueueUrl: 'audit-jobs-queue-url', // Should use context.env.AUDIT_JOBS_QUEUE_URL when not provided
          auditContext: { auditId: 'test-audit-id' },
        },
      });
    });
  });
});
