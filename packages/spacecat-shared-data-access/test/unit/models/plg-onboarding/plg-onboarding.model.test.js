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
      completedAt: null,
      createdAt: '2026-03-09T12:00:00.000Z',
      updatedAt: '2026-03-09T12:00:00.000Z',
      updatedBy: 'system',
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

    it('gets completedAt', () => {
      expect(instance.getCompletedAt()).to.be.null;
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

    it('sets completedAt', () => {
      instance.setCompletedAt('2026-03-09T15:00:00.000Z');
      expect(instance.getCompletedAt()).to.equal('2026-03-09T15:00:00.000Z');
    });
  });
});
