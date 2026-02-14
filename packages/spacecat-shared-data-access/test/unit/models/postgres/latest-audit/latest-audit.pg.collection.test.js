/*
 * Copyright 2026 Adobe. All rights reserved.
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
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresLatestAuditCollection from '../../../../../src/models/postgres/latest-audit/latest-audit.pg.collection.js';
import PostgresLatestAuditModel from '../../../../../src/models/postgres/latest-audit/latest-audit.pg.model.js';
import Schema from '../../../../../src/models/base/schema.js';

chaiUse(chaiAsPromised);

function createMockPostgrestClient() {
  const chain = {
    select: sinon.stub(),
    eq: sinon.stub(),
    in: sinon.stub(),
    order: sinon.stub(),
    range: sinon.stub(),
    gte: sinon.stub(),
    lte: sinon.stub(),
    insert: sinon.stub(),
    upsert: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    single: sinon.stub(),
    maybeSingle: sinon.stub(),
    then: null,
  };

  Object.keys(chain).forEach((key) => {
    if (key !== 'then' && chain[key]) {
      chain[key].returns(chain);
    }
  });

  chain.then = (resolve) => resolve({ data: [], error: null });
  chain.maybeSingle.returns({
    then: (resolve) => resolve({ data: [], error: null }),
  });

  const client = {
    from: sinon.stub().returns(chain),
    _chain: chain,
  };

  return client;
}

function createLatestAuditSchema() {
  return new Schema(
    PostgresLatestAuditModel,
    PostgresLatestAuditCollection,
    {
      serviceName: 'SpaceCat',
      schemaVersion: 1,
      attributes: {
        siteId: { type: 'string', required: true },
        auditType: { type: 'string', required: true },
        auditResult: { type: 'any', required: true },
        fullAuditRef: { type: 'string', required: true },
        isLive: { type: 'boolean', default: false },
        isError: { type: 'boolean', default: false },
        auditedAt: { type: 'string', required: true },
        createdAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
        updatedAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
      },
      indexes: {
        primary: {
          pk: { facets: ['siteId'] },
          sk: { facets: ['auditType'] },
        },
        byAuditType: {
          index: 'byAuditType',
          pk: { facets: ['auditType'] },
          sk: { facets: [] },
        },
      },
      references: [],
      options: { allowUpdates: true, allowRemove: false },
    },
  );
}

function createMockLog() {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
  };
}

function createMockAuditItem(siteId, auditType, auditedAt) {
  return {
    getSiteId: () => siteId,
    getAuditType: () => auditType,
    getAuditedAt: () => auditedAt,
    record: { siteId, auditType, auditedAt },
  };
}

describe('PostgresLatestAuditCollection', () => {
  let collection;
  let client;
  let schema;
  let registry;
  let log;
  let mockAuditCollection;

  beforeEach(() => {
    log = createMockLog();
    schema = createLatestAuditSchema();
    client = createMockPostgrestClient();

    mockAuditCollection = {
      all: sinon.stub().resolves([]),
      allByIndexKeys: sinon.stub().resolves([]),
      findByIndexKeys: sinon.stub().resolves(null),
    };

    registry = {
      getCollection: sinon.stub(),
      log: createMockLog(),
    };
    collection = new PostgresLatestAuditCollection(client, registry, schema, log);
    registry.getCollection.withArgs('LatestAuditCollection').returns(collection);
    registry.getCollection.withArgs('AuditCollection').returns(mockAuditCollection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('create', () => {
    it('throws - LatestAudit cannot be created directly', async () => {
      await expect(collection.create({ siteId: 'abc', auditType: 'cwv' }))
        .to.be.rejectedWith('LatestAudit is derived from Audit in v3 and cannot be created directly');
    });
  });

  describe('createMany', () => {
    it('throws - LatestAudit cannot be created directly', async () => {
      await expect(collection.createMany([{ siteId: 'abc', auditType: 'cwv' }]))
        .to.be.rejectedWith('LatestAudit is derived from Audit in v3 and cannot be created directly');
    });
  });

  describe('findById', () => {
    it('throws on invalid siteId', async () => {
      await expect(collection.findById('not-a-uuid', 'cwv'))
        .to.be.rejectedWith('siteId must be a valid UUID');
    });

    it('throws on missing auditType', async () => {
      await expect(collection.findById('a1b2c3d4-e5f6-7890-abcd-ef1234567890', ''))
        .to.be.rejectedWith('auditType is required');
    });

    it('delegates to AuditCollection.findByIndexKeys for siteId+auditType', async () => {
      const mockAudit = createMockAuditItem('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'cwv', '2024-01-01T00:00:00Z');
      mockAuditCollection.findByIndexKeys.resolves(mockAudit);

      const result = await collection.findById('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'cwv');

      expect(mockAuditCollection.findByIndexKeys.calledOnce).to.be.true;
      expect(result).to.equal(mockAudit);
    });
  });

  describe('findByIndexKeys', () => {
    it('returns null when no audits found', async () => {
      mockAuditCollection.allByIndexKeys.resolves([]);

      const result = await collection.findByIndexKeys({ siteId: 'site-1' });

      expect(result).to.be.null;
    });

    it('uses fast path for siteId+auditType keys', async () => {
      const mockAudit = createMockAuditItem('site-1', 'cwv', '2024-01-01');
      mockAuditCollection.findByIndexKeys.resolves(mockAudit);

      const result = await collection.findByIndexKeys({ siteId: 'site-1', auditType: 'cwv' });

      expect(mockAuditCollection.findByIndexKeys.calledOnce).to.be.true;
      expect(result).to.equal(mockAudit);
    });

    it('groups by auditType when siteId is provided', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-02'),
        createMockAuditItem('site-1', 'cwv', '2024-01-01'),
        createMockAuditItem('site-1', 'lhs-desktop', '2024-01-03'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.findByIndexKeys({ siteId: 'site-1' });

      // Should return the first latest audit found
      expect(result).to.not.be.null;
      expect(result.getAuditedAt()).to.equal('2024-01-02');
    });

    it('groups by siteId+auditType when only partial keys', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-02'),
        createMockAuditItem('site-2', 'cwv', '2024-01-03'),
      ];
      // Empty keys trigger auditCollection.all() instead of allByIndexKeys()
      mockAuditCollection.all.resolves(audits);

      const result = await collection.findByIndexKeys({});

      expect(result).to.not.be.null;
    });
  });

  describe('allByIndexKeys', () => {
    it('returns empty array when no audits found', async () => {
      mockAuditCollection.allByIndexKeys.resolves([]);

      const result = await collection.allByIndexKeys({ auditType: 'cwv' });

      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });

    it('returns with cursor when returnCursor option is set and no audits', async () => {
      mockAuditCollection.allByIndexKeys.resolves([]);

      const result = await collection.allByIndexKeys({ auditType: 'cwv' }, { returnCursor: true });

      expect(result).to.deep.equal({ data: [], cursor: null });
    });

    it('groups audits by siteId when auditType is given', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-03'),
        createMockAuditItem('site-1', 'cwv', '2024-01-01'),
        createMockAuditItem('site-2', 'cwv', '2024-01-02'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.allByIndexKeys({ auditType: 'cwv' });

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
    });

    it('groups audits by auditType when siteId is given', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-03'),
        createMockAuditItem('site-1', 'lhs-desktop', '2024-01-02'),
        createMockAuditItem('site-1', 'cwv', '2024-01-01'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.allByIndexKeys({ siteId: 'site-1' });

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
      // Newest cwv should be kept (2024-01-03)
      const cwvAudit = result.find((a) => a.getAuditType() === 'cwv');
      expect(cwvAudit.getAuditedAt()).to.equal('2024-01-03');
    });

    it('groups by siteId+auditType when both keys are given', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-03'),
        createMockAuditItem('site-1', 'cwv', '2024-01-01'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.allByIndexKeys({ siteId: 'site-1', auditType: 'cwv' });

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0].getAuditedAt()).to.equal('2024-01-03');
    });

    it('applies limit option', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-03'),
        createMockAuditItem('site-2', 'cwv', '2024-01-02'),
        createMockAuditItem('site-3', 'cwv', '2024-01-01'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.allByIndexKeys({ auditType: 'cwv' }, { limit: 2 });

      expect(result).to.have.length(2);
    });

    it('returns with cursor wrapper when returnCursor is true', async () => {
      const audits = [
        createMockAuditItem('site-1', 'cwv', '2024-01-03'),
      ];
      mockAuditCollection.allByIndexKeys.resolves(audits);

      const result = await collection.allByIndexKeys({ auditType: 'cwv' }, { returnCursor: true });

      expect(result).to.have.property('data');
      expect(result).to.have.property('cursor', null);
      expect(result.data).to.have.length(1);
    });
  });

  describe('all', () => {
    it('delegates to allByIndexKeys', async () => {
      const stub = sinon.stub(collection, 'allByIndexKeys').resolves([]);

      await collection.all({ auditType: 'cwv' }, { order: 'desc' });

      expect(stub.calledOnceWith({ auditType: 'cwv' }, { order: 'desc' })).to.be.true;
    });
  });

  describe('allByAuditType', () => {
    it('throws on missing auditType', async () => {
      await expect(collection.allByAuditType(''))
        .to.be.rejectedWith('auditType is required');
    });

    it('delegates to all with auditType key', async () => {
      const stub = sinon.stub(collection, 'all').resolves([]);

      await collection.allByAuditType('cwv');

      expect(stub.calledOnceWith({ auditType: 'cwv' })).to.be.true;
    });
  });

  describe('findByAll', () => {
    it('delegates to findByIndexKeys', async () => {
      const stub = sinon.stub(collection, 'findByIndexKeys').resolves(null);

      await collection.findByAll({ auditType: 'cwv' });

      expect(stub.calledOnce).to.be.true;
    });
  });

  describe('model', () => {
    it('PostgresLatestAuditModel has correct ENTITY_NAME', () => {
      expect(PostgresLatestAuditModel.ENTITY_NAME).to.equal('LatestAudit');
    });

    it('PostgresLatestAuditModel inherits AUDIT_TYPES', () => {
      expect(PostgresLatestAuditModel.AUDIT_TYPES).to.be.an('object');
      expect(PostgresLatestAuditModel.AUDIT_TYPES.CWV).to.equal('cwv');
    });
  });
});
