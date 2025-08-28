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

import Entitlement from '../../../../src/models/entitlement/entitlement.model.js';
import entitlementFixtures from '../../../fixtures/entitlements.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleEntitlement = entitlementFixtures[0];

describe('EntitlementModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleEntitlement;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Entitlement, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Entitlement instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('entitlementId', () => {
    it('gets entitlementId', () => {
      expect(instance.getId()).to.equal('3fe5ca60-4850-431c-97b3-f88a80f07e9b');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });

    it('sets organizationId', () => {
      instance.setOrganizationId('4854e75e-894b-4a74-92bf-d674abad1424');
      expect(instance.getOrganizationId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1424');
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

  describe('tier', () => {
    it('gets tier', () => {
      expect(instance.getTier()).to.equal('FREE_TRIAL');
    });

    it('sets tier', () => {
      instance.setTier('PAID');
      expect(instance.getTier()).to.equal('PAID');
    });
  });

  describe('quotas', () => {
    it('gets quotas', () => {
      expect(instance.getQuotas()).to.deep.equal({
        llmo_trial_prompts: 100,
      });
    });

    it('sets quotas', () => {
      const newQuotas = { llmo_trial_prompts: 200 };
      instance.setQuotas(newQuotas);
      expect(instance.getQuotas()).to.deep.equal(newQuotas);
    });
  });
});
