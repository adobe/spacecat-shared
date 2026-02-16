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

import Consumer from '../../../../src/models/consumer/consumer.model.js';
import consumerFixtures from '../../../fixtures/consumers.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleConsumer = consumerFixtures[0];

describe('ConsumerModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleConsumer;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Consumer, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Consumer instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('static constants', () => {
    it('has ENTITY_NAME', () => {
      expect(Consumer.ENTITY_NAME).to.equal('Consumer');
    });

    it('has STATUS constants', () => {
      expect(Consumer.STATUS).to.deep.equal({
        ACTIVE: 'ACTIVE',
        SUSPENDED: 'SUSPENDED',
        REVOKED: 'REVOKED',
      });
    });

    it('has CAPABILITIES', () => {
      expect(Consumer.CAPABILITIES).to.deep.equal(['read', 'write', 'delete']);
    });

    it('has TECHNICAL_ACCOUNT_ID_REGEX', () => {
      expect(Consumer.TECHNICAL_ACCOUNT_ID_REGEX).to.be.instanceOf(RegExp);
      expect(Consumer.TECHNICAL_ACCOUNT_ID_REGEX.test('09132356697B3F170A495EE8@techacct.adobe.com')).to.be.true;
      expect(Consumer.TECHNICAL_ACCOUNT_ID_REGEX.test('invalid-id')).to.be.false;
      expect(Consumer.TECHNICAL_ACCOUNT_ID_REGEX.test('09132356697B3F170A495EE8@AdobeOrg')).to.be.false;
      expect(Consumer.TECHNICAL_ACCOUNT_ID_REGEX.test('prefix09132356697B3F170A495EE8@techacct.adobe.com')).to.be.false;
    });

    it('has IMS_ORG_ID_REGEX', () => {
      expect(Consumer.IMS_ORG_ID_REGEX).to.be.instanceOf(RegExp);
      expect(Consumer.IMS_ORG_ID_REGEX.test('1234567890ABCDEF12345678@AdobeOrg')).to.be.true;
      expect(Consumer.IMS_ORG_ID_REGEX.test('invalid-id')).to.be.false;
      // Test that it doesn't match substrings
      expect(Consumer.IMS_ORG_ID_REGEX.test('prefix1234567890ABCDEF12345678@AdobeOrg')).to.be.false;
      expect(Consumer.IMS_ORG_ID_REGEX.test('1234567890ABCDEF12345678@AdobeOrgsuffix')).to.be.false;
    });
  });

  describe('getters', () => {
    it('gets clientId', () => {
      expect(instance.getClientId()).to.equal(sampleConsumer.clientId);
    });

    it('gets technicalAccountId', () => {
      expect(instance.getTechnicalAccountId()).to.equal(sampleConsumer.technicalAccountId);
    });

    it('gets consumerName', () => {
      expect(instance.getConsumerName()).to.equal(sampleConsumer.consumerName);
    });

    it('gets status', () => {
      expect(instance.getStatus()).to.equal(sampleConsumer.status);
    });

    it('gets capabilities', () => {
      expect(instance.getCapabilities()).to.deep.equal(sampleConsumer.capabilities);
    });

    it('gets imsOrgId', () => {
      expect(instance.getImsOrgId()).to.equal(sampleConsumer.imsOrgId);
    });

    it('gets revokedAt', () => {
      expect(instance.getRevokedAt()).to.be.undefined;
    });
  });

  describe('isRevoked', () => {
    it('returns false when status is ACTIVE and no revokedAt', () => {
      expect(instance.isRevoked()).to.be.false;
    });

    it('returns true when status is REVOKED', () => {
      instance.record.status = 'REVOKED';
      expect(instance.isRevoked()).to.be.true;
    });

    it('returns true when revokedAt is in the past', () => {
      instance.record.revokedAt = '2020-01-01T00:00:00.000Z';
      expect(instance.isRevoked()).to.be.true;
    });

    it('returns false when revokedAt is in the future and status is not REVOKED', () => {
      instance.record.status = 'ACTIVE';
      instance.record.revokedAt = '2099-01-01T00:00:00.000Z';
      expect(instance.isRevoked()).to.be.false;
    });
  });

  describe('save', () => {
    it('validates capabilities before saving', async () => {
      instance.collection.validateCapabilities = stub();
      instance.patcher = { save: stub().resolves() };

      await instance.save();

      expect(instance.collection.validateCapabilities).to.have.been.calledOnceWith(
        sampleConsumer.capabilities,
      );
      expect(instance.patcher.save).to.have.been.calledOnce;
    });

    it('rejects save when capabilities are invalid', async () => {
      instance.collection.validateCapabilities = stub().throws(
        new Error('Invalid capabilities: [admin:nuke]'),
      );
      instance.patcher = { save: stub().resolves() };

      instance.record.capabilities = ['admin:nuke'];

      await expect(instance.save()).to.be.rejectedWith('Invalid capabilities: [admin:nuke]');
      expect(instance.patcher.save).to.not.have.been.called;
    });
  });

  describe('setters', () => {
    it('sets consumerName', () => {
      const newConsumerName = 'new-consumer-name';
      const result = instance.setConsumerName(newConsumerName);
      expect(result).to.equal(instance);
    });

    it('sets status', () => {
      const newStatus = 'SUSPENDED';
      const result = instance.setStatus(newStatus);
      expect(result).to.equal(instance);
    });

    it('sets capabilities', () => {
      const newCapabilities = ['read', 'write'];
      const result = instance.setCapabilities(newCapabilities);
      expect(result).to.equal(instance);
    });

    it('sets revokedAt', () => {
      const revokedAt = new Date().toISOString();
      const result = instance.setRevokedAt(revokedAt);
      expect(result).to.equal(instance);
    });
  });
});
