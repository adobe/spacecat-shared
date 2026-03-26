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

import { expect } from 'chai';
import AuthInfo from '../../src/auth/auth-info.js';

describe('AuthInfo', () => {
  describe('isLLMOAdministrator', () => {
    it('should return undefined if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.isLLMOAdministrator()).to.be.undefined;
    });

    it('should return undefined if is_llmo_administrator is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.isLLMOAdministrator()).to.be.undefined;
    });

    it('should return true if is_llmo_administrator is true', () => {
      const authInfo = new AuthInfo().withProfile({ is_llmo_administrator: true });
      expect(authInfo.isLLMOAdministrator()).to.be.true;
    });

    it('should return false if is_llmo_administrator is false', () => {
      const authInfo = new AuthInfo().withProfile({ is_llmo_administrator: false });
      expect(authInfo.isLLMOAdministrator()).to.be.false;
    });
  });

  describe('isS2SAdmin', () => {
    it('should return undefined if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.isS2SAdmin()).to.be.undefined;
    });

    it('should return undefined if is_s2s_admin is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.isS2SAdmin()).to.be.undefined;
    });

    it('should return true if is_s2s_admin is true', () => {
      const authInfo = new AuthInfo().withProfile({ is_s2s_admin: true });
      expect(authInfo.isS2SAdmin()).to.be.true;
    });

    it('should return false if is_s2s_admin is false', () => {
      const authInfo = new AuthInfo().withProfile({ is_s2s_admin: false });
      expect(authInfo.isS2SAdmin()).to.be.false;
    });
  });

  describe('isS2SConsumer', () => {
    it('should return undefined if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.isS2SConsumer()).to.be.undefined;
    });

    it('should return undefined if is_s2s_consumer is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.isS2SConsumer()).to.be.undefined;
    });

    it('should return true if is_s2s_consumer is true', () => {
      const authInfo = new AuthInfo().withProfile({ is_s2s_consumer: true });
      expect(authInfo.isS2SConsumer()).to.be.true;
    });

    it('should return false if is_s2s_consumer is false', () => {
      const authInfo = new AuthInfo().withProfile({ is_s2s_consumer: false });
      expect(authInfo.isS2SConsumer()).to.be.false;
    });
  });

  describe('getDelegatedTenant', () => {
    it('should return undefined when imsOrgId is null', () => {
      const authInfo = new AuthInfo().withProfile({
        delegated_tenants: [{ id: 'ABC123', productCode: 'LLMO' }],
      });
      expect(authInfo.getDelegatedTenant(null)).to.be.undefined;
    });

    it('should return undefined when imsOrgId is undefined', () => {
      const authInfo = new AuthInfo().withProfile({
        delegated_tenants: [{ id: 'ABC123', productCode: 'LLMO' }],
      });
      expect(authInfo.getDelegatedTenant(undefined)).to.be.undefined;
    });

    it('should return undefined when imsOrgId is empty string', () => {
      const authInfo = new AuthInfo().withProfile({
        delegated_tenants: [{ id: 'ABC123', productCode: 'LLMO' }],
      });
      expect(authInfo.getDelegatedTenant('')).to.be.undefined;
    });

    it('should return undefined if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.getDelegatedTenant('ABC123@AdobeOrg')).to.be.undefined;
    });

    it('should return undefined if delegated_tenants is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.getDelegatedTenant('ABC123@AdobeOrg')).to.be.undefined;
    });

    it('should return undefined if no matching tenant', () => {
      const authInfo = new AuthInfo().withProfile({
        delegated_tenants: [{ id: 'OTHER', productCode: 'LLMO' }],
      });
      expect(authInfo.getDelegatedTenant('ABC123@AdobeOrg')).to.be.undefined;
    });

    it('should find matching tenant by imsOrgId stripping @AdobeOrg', () => {
      const dt = { id: 'ABC123', productCode: 'LLMO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt] });
      expect(authInfo.getDelegatedTenant('ABC123@AdobeOrg')).to.deep.equal(dt);
    });

    it('should find matching tenant by bare imsOrgId', () => {
      const dt = { id: 'ABC123', productCode: 'LLMO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt] });
      expect(authInfo.getDelegatedTenant('ABC123')).to.deep.equal(dt);
    });

    it('should filter by productCode when provided', () => {
      const dt1 = { id: 'ABC123', productCode: 'LLMO' };
      const dt2 = { id: 'ABC123', productCode: 'ASO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt1, dt2] });
      expect(authInfo.getDelegatedTenant('ABC123', 'ASO')).to.deep.equal(dt2);
    });

    it('should return undefined when productCode does not match', () => {
      const dt = { id: 'ABC123', productCode: 'LLMO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt] });
      expect(authInfo.getDelegatedTenant('ABC123', 'ASO')).to.be.undefined;
    });

    it('should match without productCode filter', () => {
      const dt = { id: 'ABC123', productCode: 'LLMO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt] });
      expect(authInfo.getDelegatedTenant('ABC123')).to.deep.equal(dt);
    });

    it('should return a shallow copy, not the original reference', () => {
      const dt = { id: 'ABC123', productCode: 'LLMO' };
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: [dt] });
      const result = authInfo.getDelegatedTenant('ABC123');
      expect(result).to.deep.equal(dt);
      expect(result).to.not.equal(dt);
    });
  });

  describe('getDelegatedTenants', () => {
    it('should return empty array if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.getDelegatedTenants()).to.deep.equal([]);
    });

    it('should return empty array if delegated_tenants is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.getDelegatedTenants()).to.deep.equal([]);
    });

    it('should return delegated tenants array', () => {
      const delegated = [{ id: 'ABC123', productCode: 'LLMO' }];
      const authInfo = new AuthInfo().withProfile({ delegated_tenants: delegated });
      expect(authInfo.getDelegatedTenants()).to.deep.equal(delegated);
    });
  });

  describe('getTenantIds', () => {
    it('should return empty array if profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.getTenantIds()).to.deep.equal([]);
    });

    it('should return empty array if tenants is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.getTenantIds()).to.deep.equal([]);
    });

    it('should return array of tenant IDs', () => {
      const authInfo = new AuthInfo().withProfile({
        tenants: [{ id: 'T1' }, { id: 'T2' }, { id: 'T3' }],
      });
      expect(authInfo.getTenantIds()).to.deep.equal(['T1', 'T2', 'T3']);
    });

    it('should filter out tenant objects without an id', () => {
      const authInfo = new AuthInfo().withProfile({
        tenants: [{ id: 'T1' }, {}, { id: 'T3' }],
      });
      expect(authInfo.getTenantIds()).to.deep.equal(['T1', 'T3']);
    });
  });

  describe('isDelegatedTenantsComplete', () => {
    it('should return true when profile is not set', () => {
      const authInfo = new AuthInfo();
      expect(authInfo.isDelegatedTenantsComplete()).to.be.true;
    });

    it('should return true when delegated_tenants_complete is not in profile', () => {
      const authInfo = new AuthInfo().withProfile({});
      expect(authInfo.isDelegatedTenantsComplete()).to.be.true;
    });

    it('should return true when delegated_tenants_complete is true', () => {
      const authInfo = new AuthInfo().withProfile({ delegated_tenants_complete: true });
      expect(authInfo.isDelegatedTenantsComplete()).to.be.true;
    });

    it('should return false when delegated_tenants_complete is false', () => {
      const authInfo = new AuthInfo().withProfile({ delegated_tenants_complete: false });
      expect(authInfo.isDelegatedTenantsComplete()).to.be.false;
    });

    it('should return true when delegated_tenants_complete is absent but delegated_tenants is present', () => {
      const authInfo = new AuthInfo().withProfile({
        delegated_tenants: [{ id: 'ABC123', productCode: 'LLMO' }],
      });
      expect(authInfo.isDelegatedTenantsComplete()).to.be.true;
    });
  });
});
