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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import { stub } from 'sinon';
import Audit from '../../../../../src/v2/models/audit/audit.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AuditCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    auditId: 's12345',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Audit, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the AuditCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('onCreate', () => {
    /*
    // create a copy of the audit as a LatestAudit entity
  async _onCreate(item) {
    const collection = this.entityRegistry.getCollection('LatestAuditCollection');
    await collection.create(item.toJSON());
  }

  // of the created audits, find the latest per site and auditType
  // and create a LatestAudit copy for each
  async _onCreateMany(items) {
    const collection = this.entityRegistry.getCollection('LatestAuditCollection');
    const latestAudits = items.createdItems.reduce((acc, audit) => {
      const siteId = audit.getSiteId();
      const auditType = audit.getAuditType();
      const auditedAt = audit.getAuditedAt();
      const key = `${siteId}-${auditType}`;

      if (!acc[key] || acc[key].getAuditedAt() < auditedAt) {
        acc[key] = audit;
      }

      return acc;
    }, {});

    await collection.createMany(Object.values(latestAudits).map((audit) => audit.toJSON()));
  }

  create tests for the above methods
     */

    it('creates a LatestAudit entity', async () => {
      const collection = {
        create: stub().resolves(),
      };
      mockEntityRegistry.getCollection.withArgs('LatestAuditCollection').returns(collection);

      // eslint-disable-next-line no-underscore-dangle
      await instance._onCreate(model);

      expect(collection.create).to.have.been.calledOnce;
      expect(collection.create).to.have.been.calledWithExactly(model.toJSON());
    });

    it('creates a LatestAudit entity for each site and auditType', async () => {
      const collection = {
        createMany: stub().resolves(),
      };
      mockEntityRegistry.getCollection.withArgs('LatestAuditCollection').returns(collection);

      // eslint-disable-next-line no-underscore-dangle
      await instance._onCreateMany({
        createdItems: [model, model, model],
      });

      expect(collection.createMany).to.have.been.calledOnce;
    });
  });
});
