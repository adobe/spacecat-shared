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

import AccessGrantLog from '../../../../src/models/access-grant-log/access-grant-log.model.js';
import accessGrantLogFixtures from '../../../fixtures/access-grant-logs.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleLog = accessGrantLogFixtures[0];

describe('AccessGrantLogModel', () => {
  let instance;
  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleLog;
    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(AccessGrantLog, mockRecord));
    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the AccessGrantLog instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('ENTITY_NAME', () => {
    it('has the correct entity name', () => {
      expect(AccessGrantLog.ENTITY_NAME).to.equal('AccessGrantLog');
    });
  });

  describe('GRANT_ACTIONS', () => {
    it('has the correct actions', () => {
      expect(AccessGrantLog.GRANT_ACTIONS).to.deep.equal({
        GRANT: 'grant',
        REVOKE: 'revoke',
      });
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('5d6d4439-6659-46c2-b646-92d110fa5a52');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('757ceb98-05c8-4e07-bb23-bc722115b2b0');
    });
  });

  describe('productCode', () => {
    it('gets productCode', () => {
      expect(instance.getProductCode()).to.equal('LLMO');
    });
  });

  describe('action', () => {
    it('gets action', () => {
      expect(instance.getAction()).to.equal('grant');
    });
  });

  describe('role', () => {
    it('gets role', () => {
      expect(instance.getRole()).to.equal('agency');
    });
  });

  describe('performedBy', () => {
    it('gets performedBy', () => {
      expect(instance.getPerformedBy()).to.equal('ims:user123');
    });
  });
});
