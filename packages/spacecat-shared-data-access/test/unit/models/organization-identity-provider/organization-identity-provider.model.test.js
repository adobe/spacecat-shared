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

import OrganizationIdentityProvider from '../../../../src/models/organization-identity-provider/organization-identity-provider.model.js';
import organizationIdentityProviderFixtures from '../../../fixtures/organization-identity-providers.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleOrganizationIdentityProvider = organizationIdentityProviderFixtures[0];

describe('OrganizationIdentityProviderModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleOrganizationIdentityProvider;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(OrganizationIdentityProvider, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the OrganizationIdentityProvider instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('organizationIdentityProviderId', () => {
    it('gets organizationIdentityProviderId', () => {
      expect(instance.getId()).to.equal('0d86eeb9-6052-4355-bf07-4ce91d6682fa');
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

  describe('provider', () => {
    it('gets provider', () => {
      expect(instance.getProvider()).to.equal('IMS');
    });

    it('sets provider', () => {
      instance.setProvider('GOOGLE');
      expect(instance.getProvider()).to.equal('GOOGLE');
    });
  });

  describe('externalId', () => {
    it('gets externalId', () => {
      expect(instance.getExternalId()).to.equal('ims-org-123');
    });

    it('sets externalId', () => {
      instance.setExternalId('new-external-id');
      expect(instance.getExternalId()).to.equal('new-external-id');
    });
  });

  describe('metadata', () => {
    it('gets metadata', () => {
      expect(instance.getMetadata()).to.deep.equal({
        domain: 'example.com',
        ssoEnabled: true,
      });
    });

    it('sets metadata', () => {
      const newMetadata = { domain: 'new-domain.com', ssoEnabled: false };
      instance.setMetadata(newMetadata);
      expect(instance.getMetadata()).to.deep.equal(newMetadata);
    });
  });
});
