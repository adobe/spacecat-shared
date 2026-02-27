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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import LatestAudit from '../../../../src/models/latest-audit/latest-audit.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('LatestAuditCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    latestAuditId: 's12345',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(LatestAudit, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the LatestAuditCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    it('throws because latest audit is derived in v3', async () => {
      await expect(instance.create(mockRecord))
        .to.be.rejectedWith('LatestAudit is derived from Audit in v3 and cannot be created directly');
    });
  });

  describe('createMany', () => {
    it('throws because latest audit is derived in v3', async () => {
      await expect(instance.createMany([mockRecord]))
        .to.be.rejectedWith('LatestAudit is derived from Audit in v3 and cannot be created directly');
    });
  });

  describe('all/find aliases', () => {
    it('delegates all to allByIndexKeys', async () => {
      const result = [mockRecord];
      instance.allByIndexKeys = stub().resolves(result);

      const response = await instance.all({ siteId: 'site-1' }, { limit: 5 });
      expect(response).to.equal(result);
      expect(instance.allByIndexKeys).to.have.been.calledOnceWithExactly({ siteId: 'site-1' }, { limit: 5 });
    });

    it('delegates findByAll to findByIndexKeys', async () => {
      instance.findByIndexKeys = stub().resolves(mockRecord);

      const response = await instance.findByAll({ siteId: 'site-1' }, { order: 'desc' });
      expect(response).to.equal(mockRecord);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWithExactly({ siteId: 'site-1' }, { order: 'desc' });
    });
  });

  describe('findByIndexKeys', () => {
    it('delegates directly to audit collection for exact siteId+auditType', async () => {
      const auditCollection = {
        findByIndexKeys: stub().resolves(mockRecord),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.findByIndexKeys({ siteId: 'site-1', auditType: 'lhs-mobile' });
      expect(result).to.equal(mockRecord);
      expect(auditCollection.findByIndexKeys).to.have.been.calledOnceWithExactly(
        { siteId: 'site-1', auditType: 'lhs-mobile' },
        { order: 'desc' },
      );
    });

    it('returns null when no audits are found for grouped lookup', async () => {
      const auditCollection = {
        findByIndexKeys: stub().resolves(null),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.findByIndexKeys({ siteId: 'site-1' });
      expect(result).to.be.null;
    });

    it('uses single-record lookup for non-composite keys', async () => {
      const latestAudit = { getAuditedAt: () => '2025-01-02T00:00:00.000Z', record: { siteId: 'site-2', auditType: 'lhs-mobile' } };
      const auditCollection = {
        findByIndexKeys: stub().resolves(latestAudit),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.findByIndexKeys({ auditType: 'lhs-mobile' });
      expect(result).to.equal(latestAudit);
      expect(auditCollection.findByIndexKeys).to.have.been.calledOnceWithExactly(
        { auditType: 'lhs-mobile' },
        { order: 'desc' },
      );
    });
  });

  describe('allByIndexKeys', () => {
    it('returns empty array when no audits are found', async () => {
      const auditCollection = {
        allByIndexKeys: stub().resolves([]),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ siteId: 'site-1' });
      expect(result).to.deep.equal([]);
    });

    it('returns empty cursor payload when no audits are found and returnCursor is true', async () => {
      const auditCollection = {
        allByIndexKeys: stub().resolves([]),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ siteId: 'site-1' }, { returnCursor: true });
      expect(result).to.deep.equal({ data: [], cursor: null });
    });

    it('groups by site when filtering only by auditType', async () => {
      const audits = [
        { getAuditedAt: () => '2025-02-01T00:00:00.000Z', record: { siteId: 's1', auditType: 'lhs-mobile' } },
        { getAuditedAt: () => '2025-02-02T00:00:00.000Z', record: { siteId: 's1', auditType: 'lhs-mobile' } },
        { getAuditedAt: () => '2025-01-01T00:00:00.000Z', record: { siteId: 's2', auditType: 'lhs-mobile' } },
      ];
      const auditCollection = {
        allByIndexKeys: stub().resolves(audits),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ auditType: 'lhs-mobile' }, { limit: 1, returnCursor: true });
      expect(result.data).to.have.length(1);
      expect(result.cursor).to.equal(null);
      expect(result.data[0].getAuditedAt()).to.equal('2025-02-02T00:00:00.000Z');
    });

    it('groups by auditType when filtering by site only', async () => {
      const audits = [
        { getAuditedAt: () => '2025-02-01T00:00:00.000Z', record: { siteId: 's1', auditType: 'lhs-mobile' } },
        { getAuditedAt: () => '2025-02-03T00:00:00.000Z', record: { siteId: 's1', auditType: 'seo' } },
      ];
      const auditCollection = {
        allByIndexKeys: stub().resolves(audits),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ siteId: 's1' });
      expect(result).to.have.length(2);
    });

    it('supports desc order for grouped latest audits', async () => {
      const audits = [
        { getAuditedAt: () => '2025-02-01T00:00:00.000Z', record: { siteId: 's1', auditType: 'lhs-mobile' } },
        { getAuditedAt: () => '2025-02-03T00:00:00.000Z', record: { siteId: 's1', auditType: 'seo' } },
      ];
      const auditCollection = {
        allByIndexKeys: stub().resolves(audits),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ siteId: 's1' }, { order: 'desc' });
      expect(result).to.have.length(2);
      expect(result[0].getAuditedAt()).to.equal('2025-02-03T00:00:00.000Z');
      expect(result[1].getAuditedAt()).to.equal('2025-02-01T00:00:00.000Z');
    });

    it('defaults to descending order for grouped latest audits', async () => {
      const audits = [
        { getAuditedAt: () => '2025-02-01T00:00:00.000Z', record: { siteId: 's1', auditType: 'lhs-mobile' } },
        { getAuditedAt: () => '2025-02-03T00:00:00.000Z', record: { siteId: 's1', auditType: 'seo' } },
      ];
      const auditCollection = {
        allByIndexKeys: stub().resolves(audits),
      };
      mockEntityRegistry.getCollection.withArgs('AuditCollection').returns(auditCollection);

      const result = await instance.allByIndexKeys({ siteId: 's1' });
      expect(result).to.have.length(2);
      expect(result[0].getAuditedAt()).to.equal('2025-02-03T00:00:00.000Z');
      expect(result[1].getAuditedAt()).to.equal('2025-02-01T00:00:00.000Z');
    });
  });

  describe('allByAuditType', () => {
    it('returns all latest audits by audit type', async () => {
      const auditType = 'lhs-mobile';

      instance.all = stub().resolves([mockRecord]);

      const audits = await instance.allByAuditType(auditType);

      expect(audits).to.be.an('array');
      expect(audits.length).to.equal(1);
      expect(instance.all).to.have.been.calledWithExactly({ auditType });
    });
  });

  describe('findById', () => {
    it('finds latest audit by id', async () => {
      const siteId = '78fec9c7-2141-4600-b7b1-ea5c78752b91';
      const auditType = 'lhs-mobile';

      instance.findByIndexKeys = stub().resolves(mockRecord);

      const audit = await instance.findById(siteId, auditType);

      expect(audit).to.be.an('object');
      expect(instance.findByIndexKeys).to.have.been.calledWithExactly({ siteId, auditType });
    });
  });
});
