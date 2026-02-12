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
        SUSPEND: 'SUSPEND',
      });
    });

    it('has ISSUER_ID_REGEX', () => {
      expect(Consumer.ISSUER_ID_REGEX).to.be.instanceOf(RegExp);
      expect(Consumer.ISSUER_ID_REGEX.test('908936ED5D35CC220A495CD4@AdobeOrg')).to.be.true;
      expect(Consumer.ISSUER_ID_REGEX.test('invalid-id')).to.be.false;
    });

    it('has ALLOWED_ISSUER_IDS', () => {
      expect(Consumer.ALLOWED_ISSUER_IDS).to.be.an('object');
      expect(Consumer.ALLOWED_ISSUER_IDS.PRODUCTION).to.equal('908936ED5D35CC220A495CD4@AdobeOrg');
      expect(Consumer.ALLOWED_ISSUER_IDS.STAGE).to.equal('8C6043F15F43B6390A49401A@AdobeOrg');
    });
  });

  describe('getters', () => {
    it('gets clientId', () => {
      expect(instance.getClientId()).to.equal(sampleConsumer.clientId);
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

    it('gets issuerId', () => {
      expect(instance.getIssuerId()).to.equal(sampleConsumer.issuerId);
    });
  });

  describe('setters', () => {
    it('sets clientId', () => {
      const newClientId = 'new-client-id';
      const result = instance.setClientId(newClientId);
      expect(result).to.equal(instance);
    });

    it('sets consumerName', () => {
      const newConsumerName = 'new-consumer-name';
      const result = instance.setConsumerName(newConsumerName);
      expect(result).to.equal(instance);
    });

    it('sets status', () => {
      const newStatus = 'SUSPEND';
      const result = instance.setStatus(newStatus);
      expect(result).to.equal(instance);
    });

    it('sets capabilities', () => {
      const newCapabilities = ['read', 'write'];
      const result = instance.setCapabilities(newCapabilities);
      expect(result).to.equal(instance);
    });

    it('sets issuerId', () => {
      const newIssuerId = '8C6043F15F43B6390A49401A@AdobeOrg';
      const result = instance.setIssuerId(newIssuerId);
      expect(result).to.equal(instance);
    });
  });
});
