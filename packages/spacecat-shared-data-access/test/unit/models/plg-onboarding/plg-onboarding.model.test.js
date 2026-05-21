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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import PlgOnboarding from '../../../../src/models/plg-onboarding/plg-onboarding.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('PlgOnboardingModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      plgOnboardingId: 'e0491f53-0688-40f7-a443-7d585d79b471',
      imsOrgId: '1234567890abcdef12345678@AdobeOrg',
      domain: 'example.com',
      baseURL: 'https://www.example.com',
      status: 'IN_PROGRESS',
      siteId: null,
      organizationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      steps: { orgResolved: true, siteCreated: false },
      error: null,
      botBlocker: null,
      waitlistReason: null,
      reviews: null,
      completedAt: null,
      createdAt: '2026-03-09T12:00:00.000Z',
      updatedAt: '2026-03-09T12:00:00.000Z',
      updatedBy: 'system',
      createdBy: 'ese@adobe.com',
    };

    ({
      model: instance,
    } = createElectroMocks(PlgOnboarding, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the PlgOnboarding instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('ENTITY_NAME', () => {
    it('has the correct entity name', () => {
      expect(PlgOnboarding.ENTITY_NAME).to.equal('PlgOnboarding');
    });
  });

  describe('STATUSES', () => {
    it('defines all expected statuses', () => {
      expect(PlgOnboarding.STATUSES).to.deep.equal({
        PRE_ONBOARDING: 'PRE_ONBOARDING',
        IN_PROGRESS: 'IN_PROGRESS',
        ONBOARDED: 'ONBOARDED',
        ERROR: 'ERROR',
        WAITING_FOR_IP_ALLOWLISTING: 'WAITING_FOR_IP_ALLOWLISTING',
        WAITLISTED: 'WAITLISTED',
        INACTIVE: 'INACTIVE',
        REJECTED: 'REJECTED',
        OUTDATED: 'OUTDATED',
      });
    });
  });

  describe('DOMAIN_PATTERN', () => {
    const { DOMAIN_PATTERN } = PlgOnboarding;

    describe('valid values', () => {
      [
        'nba.com',
        'www.nba.com',
        'sub.domain.example.com',
        'nba.com/kings',
        'nba.com/us/kings',
        'example.com/path/with-hyphens',
        'example.com/path.with.dots',
        'example.io/a/b/c',
        'example.com/en-us',
        'example.com/case_studies',
        'xn--nba-6na.com',
      ].forEach((value) => {
        it(`accepts "${value}"`, () => {
          expect(DOMAIN_PATTERN.test(value)).to.be.true;
        });
      });
    });

    describe('invalid values', () => {
      [
        ['empty string', ''],
        ['scheme prefix', 'https://nba.com'],
        ['scheme prefix http', 'http://nba.com'],
        ['IPv4 address', '127.0.0.1'],
        ['IPv4 address 8.8.8.8', '8.8.8.8'],
        ['IPv4 with path', '127.0.0.1/path'],
        ['query string', 'nba.com?foo=bar'],
        ['fragment', 'nba.com#section'],
        ['path with query string', 'nba.com/kings?q=1'],
        ['path with fragment', 'nba.com/kings#top'],
        ['trailing hyphen in label', 'nba-.com'],
        ['trailing hyphen in subdomain', 'foo-.nba.com'],
        ['trailing slash', 'nba.com/'],
        ['trailing slash after path', 'nba.com/kings/'],
        ['double slash', 'nba.com//kings'],
        ['port number', 'nba.com:8080'],
        ['path traversal dot-dot', 'nba.com/../etc'],
        ['path traversal dot', 'nba.com/./x'],
        ['path traversal dot-dot at end', 'nba.com/..'],
        ['path traversal dot at end', 'nba.com/.'],
        ['leading dot in path segment', 'nba.com/.hidden'],
        ['leading double-dot prefix in segment', 'nba.com/..foo'],
        ['trailing dot fqdn', 'nba.com.'],
        ['single-label hostname', 'localhost'],
        ['single-label intranet hostname', 'intranet'],
        ['uppercase hostname', 'NBA.COM'],
        ['uppercase path segment', 'nba.com/Kings'],
        ['uppercase locale path', 'example.com/en-US'],
        ['IPv6 bracketed', '[::1]'],
        ['IPv6 unbracketed', '2001:db8::1'],
        ['percent-encoded path', 'nba.com/path%20with%20space'],
      ].forEach(([label, value]) => {
        it(`rejects ${label}: "${value}"`, () => {
          expect(DOMAIN_PATTERN.test(value)).to.be.false;
        });
      });
    });
  });

  describe('isValidDomain', () => {
    describe('valid values', () => {
      [
        'nba.com',
        'www.nba.com',
        'nba.com/kings',
        'nba.com/us/kings',
        'example.com/en-us',
        'example.com/case_studies',
        'xn--nba-6na.com',
      ].forEach((value) => {
        it(`accepts "${value}"`, () => {
          expect(PlgOnboarding.isValidDomain(value)).to.be.true;
        });
      });
    });

    describe('invalid values', () => {
      [
        ['empty string', ''],
        ['scheme prefix', 'https://nba.com'],
        ['IPv4 address', '127.0.0.1'],
        ['short-form IPv4', '127.1'],
        ['decimal IPv4', '2130706433'],
        ['uppercase hostname', 'NBA.COM'],
        ['uppercase path segment', 'nba.com/Kings'],
        ['null byte in domain', 'nba.com\x00/evil'],
        ['control character in path', 'nba.com/ki\x01ngs'],
        ['trailing dot path segment', 'nba.com/foo.'],
        ['trailing dot fqdn', 'nba.com.'],
        ['consecutive dots mid path segment', 'nba.com/v1..0'],
        ['consecutive dots mid path segment 2', 'nba.com/foo..bar'],
      ].forEach(([label, value]) => {
        it(`rejects ${label}`, () => {
          expect(PlgOnboarding.isValidDomain(value)).to.be.false;
        });
      });
    });

    describe('non-string inputs', () => {
      [
        ['null', null],
        ['undefined', undefined],
        ['number', 123],
        ['boolean', true],
        ['object', { domain: 'nba.com' }],
        ['array', ['nba.com']],
      ].forEach(([label, value]) => {
        it(`rejects ${label}`, () => {
          expect(PlgOnboarding.isValidDomain(value)).to.be.false;
        });
      });
    });

    describe('length boundaries', () => {
      it('accepts a hostname of exactly 253 chars', () => {
        const hostname = `${'a'.repeat(249)}.com`;
        expect(hostname.length).to.equal(253);
        expect(PlgOnboarding.isValidDomain(hostname)).to.be.true;
      });

      it('rejects a hostname exceeding 253 chars', () => {
        const hostname = `${'a'.repeat(250)}.com`;
        expect(hostname.length).to.equal(254);
        expect(PlgOnboarding.isValidDomain(hostname)).to.be.false;
      });

      it('accepts a domain of exactly 2048 chars', () => {
        const value = `nba.com/${'a'.repeat(2040)}`;
        expect(value.length).to.equal(2048);
        expect(PlgOnboarding.isValidDomain(value)).to.be.true;
      });

      it('rejects a domain exceeding 2048 chars', () => {
        const value = `nba.com/${'a'.repeat(2041)}`;
        expect(value.length).to.equal(2049);
        expect(PlgOnboarding.isValidDomain(value)).to.be.false;
      });
    });

    describe('regression: DOMAIN_PATTERN alone is insufficient', () => {
      // Pinning tests: these inputs pass the bare regex but are correctly rejected
      // by the full validator. They exist to prevent regressions if a future caller
      // is tempted to import DOMAIN_PATTERN directly instead of isValidDomain.
      it('DOMAIN_PATTERN accepts short-form IPv4 "127.1" but isValidDomain rejects it', () => {
        expect(PlgOnboarding.DOMAIN_PATTERN.test('127.1')).to.be.true;
        expect(PlgOnboarding.isValidDomain('127.1')).to.be.false;
      });

      it('DOMAIN_PATTERN accepts trailing-dot path segment but isValidDomain rejects it', () => {
        expect(PlgOnboarding.DOMAIN_PATTERN.test('nba.com/foo.')).to.be.true;
        expect(PlgOnboarding.isValidDomain('nba.com/foo.')).to.be.false;
      });

      it('DOMAIN_PATTERN has no length cap but isValidDomain enforces 2048', () => {
        const tooLong = `nba.com/${'a'.repeat(2041)}`;
        expect(tooLong.length).to.equal(2049);
        expect(PlgOnboarding.DOMAIN_PATTERN.test(tooLong)).to.be.true;
        expect(PlgOnboarding.isValidDomain(tooLong)).to.be.false;
      });
    });
  });

  describe('normalizeDomain', () => {
    it('lowercases a string value', () => {
      expect(PlgOnboarding.normalizeDomain('NBA.COM/Kings')).to.equal('nba.com/kings');
    });

    it('returns non-string values unchanged', () => {
      expect(PlgOnboarding.normalizeDomain(null)).to.be.null;
      expect(PlgOnboarding.normalizeDomain(undefined)).to.be.undefined;
    });
  });

  describe('REVIEW_DECISIONS', () => {
    it('defines all expected review decisions', () => {
      expect(PlgOnboarding.REVIEW_DECISIONS).to.deep.equal({
        BYPASSED: 'BYPASSED',
        UPHELD: 'UPHELD',
        CLOSED: 'CLOSED',
        REOPENED: 'REOPENED',
        OFFBOARDED: 'OFFBOARDED',
      });
    });
  });

  describe('getters', () => {
    it('gets plgOnboardingId', () => {
      expect(instance.getId()).to.equal(mockRecord.plgOnboardingId);
    });

    it('gets imsOrgId', () => {
      expect(instance.getImsOrgId()).to.equal('1234567890abcdef12345678@AdobeOrg');
    });

    it('gets domain', () => {
      expect(instance.getDomain()).to.equal('example.com');
    });

    it('gets baseURL', () => {
      expect(instance.getBaseURL()).to.equal('https://www.example.com');
    });

    it('gets status', () => {
      expect(instance.getStatus()).to.equal('IN_PROGRESS');
    });

    it('gets siteId', () => {
      expect(instance.getSiteId()).to.be.null;
    });

    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('gets steps', () => {
      expect(instance.getSteps()).to.deep.equal({
        orgResolved: true,
        siteCreated: false,
      });
    });

    it('gets error', () => {
      expect(instance.getError()).to.be.null;
    });

    it('gets botBlocker', () => {
      expect(instance.getBotBlocker()).to.be.null;
    });

    it('gets waitlistReason', () => {
      expect(instance.getWaitlistReason()).to.be.null;
    });

    it('gets reviews', () => {
      expect(instance.getReviews()).to.be.null;
    });

    it('gets completedAt', () => {
      expect(instance.getCompletedAt()).to.be.null;
    });

    it('gets createdBy', () => {
      expect(instance.getCreatedBy()).to.equal('ese@adobe.com');
    });
  });

  describe('setters', () => {
    it('sets status', () => {
      instance.setStatus('ONBOARDED');
      expect(instance.getStatus()).to.equal('ONBOARDED');
    });

    it('sets siteId', () => {
      instance.setSiteId('b2c3d4e5-f6a7-8901-bcde-f12345678901');
      expect(instance.getSiteId()).to.equal('b2c3d4e5-f6a7-8901-bcde-f12345678901');
    });

    it('sets organizationId', () => {
      instance.setOrganizationId('c3d4e5f6-a7b8-9012-cdef-123456789012');
      expect(instance.getOrganizationId()).to.equal('c3d4e5f6-a7b8-9012-cdef-123456789012');
    });

    it('sets steps', () => {
      const newSteps = {
        orgResolved: true,
        siteCreated: true,
        entitlementCreated: true,
      };
      instance.setSteps(newSteps);
      expect(instance.getSteps()).to.deep.equal(newSteps);
    });

    it('sets error', () => {
      const error = {
        code: 'SITE_CREATION_FAILED',
        message: 'Failed to create site',
        retryable: true,
      };
      instance.setError(error);
      expect(instance.getError()).to.deep.equal(error);
    });

    it('sets botBlocker', () => {
      const botBlocker = {
        type: 'cloudflare',
        ipsToAllowlist: ['1.2.3.4'],
        userAgent: 'SpaceCat/1.0',
      };
      instance.setBotBlocker(botBlocker);
      expect(instance.getBotBlocker()).to.deep.equal(botBlocker);
    });

    it('sets waitlistReason', () => {
      instance.setWaitlistReason('Domain owned by another organization');
      expect(instance.getWaitlistReason()).to.equal(
        'Domain owned by another organization',
      );
    });

    it('sets reviews', () => {
      const reviews = [
        {
          reason: 'AEM_SITE_CHECK',
          decision: 'BYPASSED',
          reviewedBy: 'ese@adobe.com',
          reviewedAt: '2026-04-07T12:00:00.000Z',
          justification: 'AEM migration confirmed',
        },
      ];
      instance.setReviews(reviews);
      expect(instance.getReviews()).to.deep.equal(reviews);
    });

    it('sets completedAt', () => {
      instance.setCompletedAt('2026-03-09T15:00:00.000Z');
      expect(instance.getCompletedAt()).to.equal('2026-03-09T15:00:00.000Z');
    });
  });
});
