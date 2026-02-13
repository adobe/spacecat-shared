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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Consumer IT', async () => {
  let sampleData;
  let Consumer;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Consumer = dataAccess.Consumer;
  });

  it('gets a consumer by id', async () => {
    const sampleConsumer = sampleData.consumers[0];
    const consumer = await Consumer.findById(sampleConsumer.getId());

    expect(consumer).to.be.an('object');
    expect(
      sanitizeTimestamps(consumer.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleConsumer.toJSON()),
    );
  });

  it('gets all consumers by imsOrgId', async () => {
    const sampleConsumer = sampleData.consumers[0];
    const imsOrgId = sampleConsumer.getImsOrgId();

    const consumers = await Consumer.allByImsOrgId(imsOrgId);

    expect(consumers).to.be.an('array');
    expect(consumers.length).to.be.greaterThan(0);

    for (const consumer of consumers) {
      expect(consumer.getImsOrgId()).to.equal(imsOrgId);
    }
  });

  it('gets all consumers by clientId', async () => {
    const sampleConsumer = sampleData.consumers[0];
    const clientId = sampleConsumer.getClientId();

    const consumers = await Consumer.allByClientId(clientId);

    expect(consumers).to.be.an('array');
    expect(consumers.length).to.be.greaterThan(0);

    for (const consumer of consumers) {
      expect(consumer.getClientId()).to.equal(clientId);
    }
  });

  it('adds a new consumer', async () => {
    const data = {
      clientId: 'client-new-test',
      technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
      consumerName: 'consumer-new-test',
      status: 'ACTIVE',
      capabilities: ['site:read', 'site:write'],
      imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
    };

    const consumer = await Consumer.create(data);

    expect(consumer).to.be.an('object');
    expect(consumer.getClientId()).to.equal(data.clientId);
    expect(consumer.getConsumerName()).to.equal(data.consumerName);
    expect(consumer.getStatus()).to.equal(data.status);
    expect(consumer.getCapabilities()).to.eql(data.capabilities);
    expect(consumer.getTechnicalAccountId()).to.equal(data.technicalAccountId);
    expect(consumer.getImsOrgId()).to.equal(data.imsOrgId);
  });

  it('updates the status of a consumer', async () => {
    const consumer = await Consumer.findById(sampleData.consumers[0].getId());

    const newStatus = 'SUSPENDED';
    const expectedConsumer = {
      ...consumer.toJSON(),
      status: newStatus,
    };
    consumer.setStatus(newStatus);
    await consumer.save();

    const updatedConsumer = await Consumer.findById(consumer.getId());
    expect(updatedConsumer.getId()).to.equal(consumer.getId());
    expect(updatedConsumer.record.createdAt).to.equal(consumer.record.createdAt);
    expect(updatedConsumer.record.updatedAt).to.not.equal(consumer.record.updatedAt);
    expect(
      sanitizeIdAndAuditFields('Consumer', updatedConsumer.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Consumer', expectedConsumer),
    );
  });

  it('updates the capabilities of a consumer', async () => {
    const consumer = await Consumer.findById(sampleData.consumers[0].getId());

    const newCapabilities = ['site:read'];
    const expectedConsumer = {
      ...consumer.toJSON(),
      capabilities: newCapabilities,
    };
    consumer.setCapabilities(newCapabilities);
    await consumer.save();

    const updatedConsumer = await Consumer.findById(consumer.getId());

    expect(updatedConsumer.getId()).to.equal(consumer.getId());
    expect(updatedConsumer.record.createdAt).to.equal(consumer.record.createdAt);
    expect(updatedConsumer.record.updatedAt).to.not.equal(consumer.record.updatedAt);
    expect(
      sanitizeIdAndAuditFields('Consumer', updatedConsumer.toJSON()),
    ).to.eql(
      sanitizeIdAndAuditFields('Consumer', expectedConsumer),
    );
  });

  it('removes a consumer', async () => {
    const consumer = await Consumer.findById(sampleData.consumers[0].getId());

    await consumer.remove();

    const notFound = await Consumer.findById(sampleData.consumers[0].getId());
    expect(notFound).to.be.null;
  });

  it('rejects creation with a disallowed imsOrgId', async () => {
    const disallowedData = {
      clientId: 'client-disallowed',
      technicalAccountId: 'CCDD00112233445566778899@techacct.adobe.com',
      consumerName: 'consumer-disallowed',
      status: 'ACTIVE',
      capabilities: ['site:read'],
      imsOrgId: 'FEDCBA0987654321FEDCBA09@AdobeOrg',
    };

    await expect(Consumer.create(disallowedData)).to.be.rejectedWith(
      'is not in the list of allowed IMS Org IDs',
    );
  });

  it('rejects creation with invalid capabilities', async () => {
    const invalidCapData = {
      clientId: 'client-invalid-cap',
      technicalAccountId: 'AABB00112233445566778899@techacct.adobe.com',
      consumerName: 'consumer-invalid-cap',
      status: 'ACTIVE',
      capabilities: ['site:read', 'admin', 'bogus:execute'],
      imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
    };

    await expect(Consumer.create(invalidCapData)).to.be.rejectedWith(
      'Invalid capabilities',
    );
  });

  it('validates imsOrgId format', async () => {
    const invalidFormatData = {
      clientId: 'client-invalid',
      technicalAccountId: 'EEFF00112233445566778899@techacct.adobe.com',
      consumerName: 'consumer-invalid',
      status: 'ACTIVE',
      capabilities: ['site:read'],
      imsOrgId: 'invalid-issuer-id',
    };

    await expect(Consumer.create(invalidFormatData)).to.be.rejected;
  });

  it('validates status enum values', async () => {
    const invalidStatusData = {
      clientId: 'client-invalid-status',
      technicalAccountId: 'FF0011223344556677889900@techacct.adobe.com',
      consumerName: 'consumer-invalid-status',
      status: 'INVALID_STATUS',
      capabilities: ['site:read'],
      imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
    };

    await expect(Consumer.create(invalidStatusData)).to.be.rejected;
  });
});
