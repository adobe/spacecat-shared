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

import { expect } from 'chai';
import plgOnboardingSchema from '../../../../src/models/plg-onboarding/plg-onboarding.schema.js';

describe('PlgOnboarding Schema', () => {
  describe('domain attribute', () => {
    let domainAttr;

    before(() => {
      const attributes = plgOnboardingSchema.getAttributes();
      domainAttr = attributes.domain;
    });

    it('is a required read-only string', () => {
      expect(domainAttr.type).to.equal('string');
      expect(domainAttr.required).to.be.true;
      expect(domainAttr.readOnly).to.be.true;
    });

    it('has a validate function', () => {
      expect(domainAttr.validate).to.be.a('function');
    });

    describe('valid values', () => {
      [
        'nba.com',
        'www.nba.com',
        'nba.com/kings',
        'nba.com/us/kings',
        'example.com/path-with-hyphens',
        'example.com/en-us',
        'example.com/case_studies',
        'xn--nba-6na.com',
      ].forEach((value) => {
        it(`accepts "${value}"`, () => {
          expect(domainAttr.validate(value)).to.be.true;
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
        ['query string', 'nba.com?q=1'],
        ['fragment', 'nba.com#top'],
        ['hostname over 253 chars', `${'a'.repeat(250)}.com`],
        ['trailing hyphen in label', 'nba-.com'],
        ['trailing slash', 'nba.com/kings/'],
        ['path traversal', 'nba.com/../etc'],
        ['leading dot in path segment', 'nba.com/.hidden'],
        ['leading double-dot prefix in segment', 'nba.com/..foo'],
        ['trailing dot fqdn', 'nba.com.'],
        ['single-label hostname', 'localhost'],
        ['uppercase hostname', 'NBA.COM'],
        ['uppercase path segment', 'nba.com/Kings'],
        ['uppercase locale path', 'example.com/en-US'],
      ].forEach(([label, value]) => {
        it(`rejects ${label}`, () => {
          expect(domainAttr.validate(value)).to.be.false;
        });
      });
    });

    it('allows a plain hostname of exactly 253 chars', () => {
      const hostname = `${'a'.repeat(249)}.com`;
      expect(hostname.length).to.equal(253);
      expect(domainAttr.validate(hostname)).to.be.true;
    });

    it('rejects a plain hostname exceeding 253 chars', () => {
      const hostname = `${'a'.repeat(250)}.com`;
      expect(hostname.length).to.equal(254);
      expect(domainAttr.validate(hostname)).to.be.false;
    });

    it('allows a subpath domain whose hostname is exactly 253 chars', () => {
      const hostname = `${'a'.repeat(249)}.com`;
      expect(hostname.length).to.equal(253);
      expect(domainAttr.validate(`${hostname}/path`)).to.be.true;
    });

    it('rejects when only the hostname exceeds 253 chars (path does not inflate count)', () => {
      const hostname = `${'a'.repeat(250)}.com`;
      expect(hostname.length).to.equal(254);
      expect(domainAttr.validate(`${hostname}/path`)).to.be.false;
    });

    it('accepts a domain of exactly 2048 chars', () => {
      const longPath = `nba.com/${'a'.repeat(2040)}`;
      expect(longPath.length).to.equal(2048);
      expect(domainAttr.validate(longPath)).to.be.true;
    });

    it('rejects a domain of exactly 2049 chars', () => {
      const longPath = `nba.com/${'a'.repeat(2041)}`;
      expect(longPath.length).to.equal(2049);
      expect(domainAttr.validate(longPath)).to.be.false;
    });

    it('rejects when total domain length exceeds 2048 chars', () => {
      const longPath = `nba.com/${'a'.repeat(2042)}`;
      expect(longPath.length).to.be.above(2048);
      expect(domainAttr.validate(longPath)).to.be.false;
    });
  });

  describe('reviews attribute', () => {
    let reviewsAttr;

    before(() => {
      const attributes = plgOnboardingSchema.getAttributes();
      reviewsAttr = attributes.reviews;
    });

    it('should have reviews as optional list', () => {
      expect(reviewsAttr).to.exist;
      expect(reviewsAttr.required).to.not.be.true;
      expect(reviewsAttr.type).to.equal('list');
    });

    it('should have a validate function', () => {
      expect(reviewsAttr.validate).to.be.a('function');
    });

    it('rejects non-array value', () => {
      expect(reviewsAttr.validate('not an array')).to.be.false;
    });

    it('rejects object value', () => {
      expect(reviewsAttr.validate({ decision: 'BYPASSED' })).to.be.false;
    });

    it('accepts valid reviews with BYPASSED decision', () => {
      const reviews = [{
        reason: 'test reason',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('accepts valid reviews with UPHELD decision', () => {
      const reviews = [{
        reason: 'test reason',
        decision: 'UPHELD',
        reviewedBy: 'admin@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'not ready',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('rejects invalid decision value', () => {
      const reviews = [{
        reason: 'test',
        decision: 'INVALID',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: '2026-04-07T12:00:00.000Z',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('rejects invalid reviewedAt (not ISO date)', () => {
      const reviews = [{
        reason: 'test',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        reviewedAt: 'yesterday',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('rejects missing reviewedAt', () => {
      const reviews = [{
        reason: 'test',
        decision: 'BYPASSED',
        reviewedBy: 'ese@adobe.com',
        justification: 'test',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.false;
    });

    it('accepts valid reviews with CLOSED decision', () => {
      const reviews = [{
        reason: 'superseded by new onboarding',
        decision: 'CLOSED',
        reviewedBy: 'admin@adobe.com',
        reviewedAt: '2026-04-29T10:00:00.000Z',
        justification: 'new domain started for same org',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('accepts valid reviews with REOPENED decision', () => {
      const reviews = [{
        reason: 'Domain example.com manually transitioned from REJECTED to OUTDATED by admin.',
        decision: 'REOPENED',
        reviewedBy: 'admin@adobe.com',
        reviewedAt: '2026-04-29T10:00:00.000Z',
        justification: 'customer reapplied',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('accepts valid reviews with OFFBOARDED decision', () => {
      const reviews = [{
        reason: 'Domain example.com manually transitioned from ONBOARDED to OUTDATED by admin.',
        decision: 'OFFBOARDED',
        reviewedBy: 'admin@adobe.com',
        reviewedAt: '2026-04-29T10:00:00.000Z',
        justification: 'customer request',
      }];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });

    it('accepts multiple reviews', () => {
      const reviews = [
        {
          reason: 'first',
          decision: 'UPHELD',
          reviewedBy: 'admin@adobe.com',
          reviewedAt: '2026-04-07T12:00:00.000Z',
          justification: 'not yet',
        },
        {
          reason: 'second',
          decision: 'BYPASSED',
          reviewedBy: 'ese@adobe.com',
          reviewedAt: '2026-04-08T10:00:00.000Z',
          justification: 'now ready',
        },
      ];
      expect(reviewsAttr.validate(reviews)).to.be.true;
    });
  });

  describe('steps attribute', () => {
    let stepsAttr;

    before(() => {
      const attributes = plgOnboardingSchema.getAttributes();
      stepsAttr = attributes.steps;
    });

    it('should exist as a map type', () => {
      expect(stepsAttr).to.exist;
      expect(stepsAttr.type).to.equal('map');
    });

    it('should define all expected step keys', () => {
      const keys = Object.keys(stepsAttr.properties);
      const expected = [
        'orgResolved',
        'rumVerified',
        'siteCreated',
        'siteResolved',
        'siteOrgReassigned',
        'authorUrlResolved',
        'hlxConfigSet',
        'codeConfigResolved',
        'configUpdated',
        'auditsEnabled',
        'deliveryConfigQueued',
        'entitlementCreated',
        'entitlementFailed',
        'orgResolutionFailed',
        'preOnboarded',
      ];
      expect(keys).to.have.members(expected);
    });

    it('should not contain the removed siteOrgReassignmentFailed key', () => {
      expect(stepsAttr.properties).to.not.have.property('siteOrgReassignmentFailed');
    });

    it('should define entitlementFailed as a boolean', () => {
      expect(stepsAttr.properties.entitlementFailed).to.deep.equal({ type: 'boolean' });
    });

    it('should define all step properties as boolean type', () => {
      Object.values(stepsAttr.properties).forEach((prop) => {
        expect(prop).to.deep.equal({ type: 'boolean' });
      });
    });
  });

  describe('createdBy attribute', () => {
    let createdByAttr;

    before(() => {
      const attributes = plgOnboardingSchema.getAttributes();
      createdByAttr = attributes.createdBy;
    });

    it('should exist as an optional string attribute', () => {
      expect(createdByAttr).to.exist;
      expect(createdByAttr.type).to.equal('string');
      expect(createdByAttr.required).to.not.be.true;
    });

    it('should have a default value of system', () => {
      const defaultValue = typeof createdByAttr.default === 'function'
        ? createdByAttr.default()
        : createdByAttr.default;
      expect(defaultValue).to.equal('system');
    });
  });
});
