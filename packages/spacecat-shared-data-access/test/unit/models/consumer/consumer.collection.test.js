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

describe('ConsumerCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      collection: instance,
    } = createElectroMocks(Consumer, sampleConsumer));

    // Set up allowed IMS Org IDs in config
    mockEntityRegistry.config = {
      s2sAllowedImsOrgIds: [
        '1234567890ABCDEF12345678@AdobeOrg',
        'ABCDEF1234567890ABCDEF12@AdobeOrg',
      ],
    };

    // Mock getEntityNames to return a representative set of entity names
    mockEntityRegistry.getEntityNames = () => ['site', 'organization', 'consumer', 'configuration'];
  });

  describe('static constants', () => {
    it('has COLLECTION_NAME', () => {
      expect(instance.constructor.COLLECTION_NAME).to.equal('ConsumerCollection');
    });
  });

  describe('create', () => {
    it('creates a consumer with valid imsOrgId and capabilities', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read', 'organization:write'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      stub(instance, 'findByClientId').resolves(null);
      mockElectroService.entities.consumer.create.returns({
        go: () => Promise.resolve({ data: sampleConsumer }),
      });

      const result = await instance.create(item);

      expect(result).to.not.be.null;
      expect(mockElectroService.entities.consumer.create).to.have.been.calledOnce;
      instance.findByClientId.restore();
    });

    it('throws ValidationError when clientId already exists', async () => {
      const item = {
        clientId: 'client-existing',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      stub(instance, 'findByClientId').resolves({ getId: () => 'existing-id' });

      await expect(instance.create(item)).to.be.rejectedWith(
        'A consumer with clientId "client-existing" already exists',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
      instance.findByClientId.restore();
    });

    it('throws ValidationError when imsOrgId is not in the allowed list', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read'],
        imsOrgId: 'NOTALLOWED123456789012AB@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'The imsOrgId "NOTALLOWED123456789012AB@AdobeOrg" is not in the list of allowed IMS Org IDs',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
    });

    it('throws ValidationError when capabilities contain invalid entries', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read', 'admin', '*'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'Invalid capabilities: [admin, *]',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
    });

    it('throws ValidationError for unknown entity in capability', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['unknownEntity:read'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'Invalid capabilities: [unknownEntity:read]',
      );
    });

    it('throws ValidationError for unknown operation in capability', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:execute'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'Invalid capabilities: [site:execute]',
      );
    });

    it('skips capability validation when capabilities is empty', async () => {
      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: [],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      stub(instance, 'findByClientId').resolves(null);
      mockElectroService.entities.consumer.create.returns({
        go: () => Promise.resolve({ data: sampleConsumer }),
      });

      const result = await instance.create(item);
      expect(result).to.not.be.null;
      instance.findByClientId.restore();
    });

    it('throws ValidationError when clientId is not provided', async () => {
      const item = {
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read'],
        imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'clientId is required to create a consumer',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
    });

    it('throws ValidationError when no allowed IMS Org IDs are configured', async () => {
      mockEntityRegistry.config = { s2sAllowedImsOrgIds: [] };

      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read'],
        imsOrgId: 'ANYORGID1234567890ABCDEF@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'S2S_ALLOWED_IMS_ORG_IDS is not configured',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
    });

    it('throws ValidationError when s2sAllowedImsOrgIds is undefined', async () => {
      mockEntityRegistry.config = {};

      const item = {
        clientId: 'client-new',
        technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
        consumerName: 'consumer-new',
        status: 'ACTIVE',
        capabilities: ['site:read'],
        imsOrgId: 'ANYORGID1234567890ABCDEF@AdobeOrg',
      };

      await expect(instance.create(item)).to.be.rejectedWith(
        'S2S_ALLOWED_IMS_ORG_IDS is not configured',
      );

      expect(mockElectroService.entities.consumer.create).to.not.have.been.called;
    });
  });
});
