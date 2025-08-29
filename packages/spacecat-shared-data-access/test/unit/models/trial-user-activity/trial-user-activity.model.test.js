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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import TrialUserActivity from '../../../../src/models/trial-user-activity/trial-user-activity.model.js';
import trialUserActivityFixtures from '../../../fixtures/trial-user-activities.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleTrialUserActivity = trialUserActivityFixtures[0];

describe('TrialUserActivityModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleTrialUserActivity;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(TrialUserActivity, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the TrialUserActivity instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('trialUserActivityId', () => {
    it('gets trialUserActivityId', () => {
      expect(instance.getId()).to.equal('abfa40c3-e8da-43dd-bd05-a2e1715d4b6e');
    });
  });

  describe('trialUserId', () => {
    it('gets trialUserId', () => {
      expect(instance.getTrialUserId()).to.equal('9b4f4013-63eb-44f7-9a3a-726930b923b5');
    });

    it('sets trialUserId', () => {
      instance.setTrialUserId('9b4f4013-63eb-44f7-9a3a-726930b923b6');
      expect(instance.getTrialUserId()).to.equal('9b4f4013-63eb-44f7-9a3a-726930b923b6');
    });
  });

  describe('entitlementId', () => {
    it('gets entitlementId', () => {
      expect(instance.getEntitlementId()).to.equal('3fe5ca60-4850-431c-97b3-f88a80f07e9b');
    });

    it('sets entitlementId', () => {
      instance.setEntitlementId('3fe5ca60-4850-431c-97b3-f88a80f07e9c');
      expect(instance.getEntitlementId()).to.equal('3fe5ca60-4850-431c-97b3-f88a80f07e9c');
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('48656b02-62cb-46c0-b271-ee99c940e89e');
    });

    it('sets siteId', () => {
      instance.setSiteId('48656b02-62cb-46c0-b271-ee99c940e89f');
      expect(instance.getSiteId()).to.equal('48656b02-62cb-46c0-b271-ee99c940e89f');
    });
  });

  describe('type', () => {
    it('gets type', () => {
      expect(instance.getType()).to.equal('SIGN_UP');
    });

    it('sets type', () => {
      instance.setType('SIGN_IN');
      expect(instance.getType()).to.equal('SIGN_IN');
    });
  });

  describe('details', () => {
    it('gets details', () => {
      expect(instance.getDetails()).to.deep.equal({
        signupMethod: 'email',
        referrer: 'google_search',
      });
    });

    it('sets details', () => {
      const newDetails = { signupMethod: 'google', referrer: 'direct' };
      instance.setDetails(newDetails);
      expect(instance.getDetails()).to.deep.equal(newDetails);
    });
  });

  describe('productCode', () => {
    it('gets productCode', () => {
      expect(instance.getProductCode()).to.equal('LLMO');
    });

    it('sets productCode', () => {
      instance.setProductCode('ASO');
      expect(instance.getProductCode()).to.equal('ASO');
    });
  });
});
