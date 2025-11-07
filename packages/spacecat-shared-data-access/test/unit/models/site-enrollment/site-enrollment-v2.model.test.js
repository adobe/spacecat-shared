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

import SiteEnrollmentV2 from '../../../../src/models/site-enrollment/site-enrollment-v2.model.js';
import siteEnrollmentFixtures from '../../../fixtures/site-enrollments.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleSiteEnrollment = siteEnrollmentFixtures[0];

describe('SiteEnrollmentV2Model', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleSiteEnrollment;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(SiteEnrollmentV2, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the SiteEnrollmentV2 instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });

    it('is read-only since it is part of the primary key', () => {
      // siteId is part of the composite primary key, so it should be read-only
      expect(() => instance.setSiteId('5d6d4439-6659-46c2-b646-92d110fa5a53'))
        .to.throw('The property siteId is read-only and cannot be updated');
    });
  });

  describe('entitlementId', () => {
    it('gets entitlementId', () => {
      expect(instance.getEntitlementId()).to.equal('3fe5ca60-4850-431c-97b3-f88a80f07e9b');
    });

    it('is read-only since it is part of the primary key', () => {
      // entitlementId is part of the composite primary key, so it should be read-only
      expect(() => instance.setEntitlementId('3fe5ca60-4850-431c-97b3-f88a80f07e9c'))
        .to.throw('The property entitlementId is read-only and cannot be updated');
    });
  });

  describe('composite key behavior', () => {
    it('has entitlementId as partition key and siteId as sort key', () => {
      // V2 uses composite primary key instead of siteEnrollmentId
      expect(instance.getEntitlementId()).to.be.a('string');
      expect(instance.getSiteId()).to.be.a('string');
    });
  });

  describe('generateCompositeKeys', () => {
    it('generates composite keys with entitlementId and siteId', () => {
      const compositeKeys = instance.generateCompositeKeys();

      expect(compositeKeys).to.be.an('object');
      expect(compositeKeys).to.have.property('entitlementId');
      expect(compositeKeys).to.have.property('siteId');
      expect(compositeKeys.entitlementId).to.equal('3fe5ca60-4850-431c-97b3-f88a80f07e9b');
      expect(compositeKeys.siteId).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });
  });
});
