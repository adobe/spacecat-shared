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

import SiteEnrollment from '../../../../src/models/site-enrollment/site-enrollment.model.js';
import SiteEnrollmentSchema from '../../../../src/models/site-enrollment/site-enrollment.schema.js';
import siteEnrollmentFixtures from '../../../fixtures/site-enrollments.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleSiteEnrollment = siteEnrollmentFixtures[0];

describe('SiteEnrollmentModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleSiteEnrollment;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(SiteEnrollment, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the SiteEnrollment instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('siteEnrollmentId', () => {
    it('gets siteEnrollmentId', () => {
      expect(instance.getId()).to.equal('0e07949e-8845-4fac-b903-24a42c5533b9');
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });

    it('sets siteId', () => {
      instance.setSiteId('5d6d4439-6659-46c2-b646-92d110fa5a53');
      expect(instance.getSiteId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a53');
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

  describe('config', () => {
    it('gets config', () => {
      const expectedConfig = {
        feature1: 'enabled',
        theme: 'dark',
      };
      expect(instance.getConfig()).to.deep.equal(expectedConfig);
    });

    it('gets empty config when not set', () => {
      const instanceWithoutConfig = createElectroMocks(SiteEnrollment, {
        siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
        siteEnrollmentId: '0e07949e-8845-4fac-b903-24a42c5533b9',
        entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
      }).model;

      expect(instanceWithoutConfig.getConfig()).to.deep.equal({});
    });

    it('sets config', () => {
      const newConfig = {
        newFeature: 'active',
        environment: 'production',
      };

      const result = instance.setConfig(newConfig);
      expect(result).to.equal(instance); // should return this for chaining
      expect(instance.getConfig()).to.deep.equal(newConfig);
    });

    it('sets empty config when null is passed', () => {
      instance.setConfig(null);
      expect(instance.getConfig()).to.deep.equal({});
    });

    it('sets empty config when undefined is passed', () => {
      instance.setConfig(undefined);
      expect(instance.getConfig()).to.deep.equal({});
    });
  });

  describe('config validation', () => {
    it('validates config with valid string key-value pairs', () => {
      const validConfig = {
        feature1: 'enabled',
        environment: 'production',
        theme: 'dark',
      };

      // This should not throw an error
      expect(() => {
        instance.setConfig(validConfig);
      }).to.not.throw();

      expect(instance.getConfig()).to.deep.equal(validConfig);
    });

    it('handles null config gracefully', () => {
      // This should not throw an error and should set empty config
      expect(() => {
        instance.setConfig(null);
      }).to.not.throw();

      expect(instance.getConfig()).to.deep.equal({});
    });

    it('handles empty object config', () => {
      const emptyConfig = {};

      expect(() => {
        instance.setConfig(emptyConfig);
      }).to.not.throw();

      expect(instance.getConfig()).to.deep.equal(emptyConfig);
    });

    it('validates schema-level config validation with invalid data', () => {
      // Test the validation function directly by accessing the built schema
      const builtSchema = SiteEnrollmentSchema.toElectroDBSchema();
      const configAttribute = builtSchema.attributes.config;

      // Test with null/undefined (should return true - line 35)
      expect(configAttribute.validate(null)).to.be.true;
      expect(configAttribute.validate(undefined)).to.be.true;
      expect(configAttribute.validate('')).to.be.true;
      expect(configAttribute.validate(false)).to.be.true;

      // Test with valid object (should return true - lines 37-39)
      expect(configAttribute.validate({ key1: 'value1', key2: 'value2' })).to.be.true;
      expect(configAttribute.validate({})).to.be.true;

      // Test with invalid data (should return false - lines 37-39)
      expect(configAttribute.validate({ key1: 123 })).to.be.false; // number value
      expect(configAttribute.validate('not an object')).to.be.false;
      expect(configAttribute.validate(123)).to.be.false;
      expect(configAttribute.validate(['array'])).to.be.false;
    });
  });
});
