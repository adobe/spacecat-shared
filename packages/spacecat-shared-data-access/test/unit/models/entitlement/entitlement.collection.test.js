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
import sinonChai from 'sinon-chai';

import Entitlement from '../../../../src/models/entitlement/entitlement.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('EntitlementCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    entitlementId: 'af1b8f87-83d1-4072-ad34-dade6c6195a7',
    tier: 'PAID',
    productCode: 'LLMO',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Entitlement, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the EntitlementCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('schema references', () => {
    it('has SiteEnrollments reference with removeDependents set to true', () => {
      const siteEnrollmentsRef = schema.references.find(
        (ref) => ref.getTarget() === 'SiteEnrollments',
      );

      expect(siteEnrollmentsRef).to.exist;
      expect(siteEnrollmentsRef.getType()).to.equal('has_many');
      expect(siteEnrollmentsRef.isRemoveDependents()).to.be.true;
    });

    it('has TrialUserActivities reference with removeDependents set to false', () => {
      const trialUserActivitiesRef = schema.references.find(
        (ref) => ref.getTarget() === 'TrialUserActivities',
      );

      expect(trialUserActivitiesRef).to.exist;
      expect(trialUserActivitiesRef.getType()).to.equal('has_many');
      expect(trialUserActivitiesRef.isRemoveDependents()).to.be.false;
    });
  });

  describe('isFreemium', () => {
    const FREEMIUM_ORGANIZATION_ID = 'ed79490b-4248-4b86-9536-b35e122772f4';

    it('throws if organizationId is not provided', () => {
      expect(() => instance.isFreemium()).to.throw('organizationId is required');
      expect(() => instance.isFreemium('')).to.throw('organizationId is required');
    });

    it('returns true when organizationId is the freemium org', () => {
      expect(instance.isFreemium(FREEMIUM_ORGANIZATION_ID)).to.be.true;
    });

    it('returns false for any other organizationId', () => {
      expect(instance.isFreemium('org-123')).to.be.false;
      expect(instance.isFreemium('00000000-0000-0000-0000-000000000000')).to.be.false;
    });
  });
});
