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

  it('gets all consumers by issuerId', async () => {
    const sampleConsumer = sampleData.consumers[0];
    const issuerId = sampleConsumer.getIssuerId();

    const consumers = await Consumer.allByIssuerId(issuerId);

    expect(consumers).to.be.an('array');
    expect(consumers.length).to.be.greaterThan(0);

    for (const consumer of consumers) {
      expect(consumer.getIssuerId()).to.equal(issuerId);
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
      consumerName: 'consumer-new-test',
      status: 'ACTIVE',
      capabilities: ['read', 'write'],
      issuerId: '908936ED5D35CC220A495CD4@AdobeOrg',
    };

    const consumer = await Consumer.create(data);

    expect(consumer).to.be.an('object');
    expect(consumer.getClientId()).to.equal(data.clientId);
    expect(consumer.getConsumerName()).to.equal(data.consumerName);
    expect(consumer.getStatus()).to.equal(data.status);
    expect(consumer.getCapabilities()).to.eql(data.capabilities);
    expect(consumer.getIssuerId()).to.equal(data.issuerId);
  });

  it('updates the status of a consumer', async () => {
    const consumer = await Consumer.findById(sampleData.consumers[0].getId());

    const newStatus = 'SUSPEND';
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

    const newCapabilities = ['read'];
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

  it('validates issuerId format and allowed values', async () => {
    const invalidFormatData = {
      clientId: 'client-invalid',
      consumerName: 'consumer-invalid',
      status: 'ACTIVE',
      capabilities: ['read'],
      issuerId: 'invalid-issuer-id',
    };

    await expect(Consumer.create(invalidFormatData)).to.be.rejected;
  });

  it('validates status enum values', async () => {
    const invalidStatusData = {
      clientId: 'client-invalid-status',
      consumerName: 'consumer-invalid-status',
      status: 'INVALID_STATUS',
      capabilities: ['read'],
      issuerId: '908936ED5D35CC220A495CD4@AdobeOrg',
    };

    await expect(Consumer.create(invalidStatusData)).to.be.rejected;
  });
});
