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

import AuditUrl from '../../../../src/models/audit-url/audit-url.model.js';
import AuditUrlCollection from '../../../../src/models/audit-url/audit-url.collection.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AuditUrlCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    auditUrlId: 'au12345',
    siteId: 'site12345',
    url: 'https://example.com/page',
    byCustomer: true,
    audits: ['accessibility'],
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(AuditUrl, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the AuditUrlCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('findById (composite key)', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.findById()).to.be.rejectedWith('Both siteId and url are required');
    });

    it('throws an error if url is not provided', async () => {
      await expect(instance.findById('site123')).to.be.rejectedWith('Both siteId and url are required');
    });

    it('returns the audit URL when found', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findById('site123', 'https://example.com/page');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith({
        siteId: 'site123',
        url: 'https://example.com/page',
      });
    });

    it('returns null when audit URL is not found', async () => {
      instance.findByIndexKeys = stub().resolves(null);

      const result = await instance.findById('site123', 'https://example.com/page');

      expect(result).to.be.null;
    });
  });

  describe('findBySiteIdAndUrl (alias)', () => {
    it('delegates to findById', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findBySiteIdAndUrl('site123', 'https://example.com/page');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith({
        siteId: 'site123',
        url: 'https://example.com/page',
      });
    });
  });

  describe('allBySiteIdAndAuditType', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType()).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('throws an error if auditType is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType('site123')).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('filters URLs by audit type using FilterExpression and returns pagination metadata', async () => {
      const mockModel1 = { getUrl: () => 'url1' };
      const mockModel2 = { getUrl: () => 'url2' };

      // allByIndexKeys returns filtered results (FilterExpression applied at DynamoDB level)
      instance.allByIndexKeys = stub().resolves({ data: [mockModel1, mockModel2], cursor: 'cursor123' });

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.cursor).to.equal('cursor123');

      // Verify FilterExpression was passed
      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId: 'site123' });
      expect(callArgs[1]).to.have.property('where');
      expect(callArgs[1].returnCursor).to.be.true;
    });

    it('returns empty data array when no URLs match the audit type', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility');

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(0);
      expect(result.cursor).to.be.null;
    });

    it('passes pagination options to allByIndexKeys', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });
      const options = { limit: 50, cursor: 'abc123' };

      await instance.allBySiteIdAndAuditType('site123', 'accessibility', options);

      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[1]).to.include({ limit: 50, cursor: 'abc123', returnCursor: true });
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all audit URLs for a given siteId using composite keys', async () => {
      const siteId = 'site12345';
      const urlModel = {
        getUrl: () => 'https://example.com/page1',
      };
      instance.allBySiteId = stub().resolves([urlModel]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([
        { siteId, url: 'https://example.com/page1' },
      ]);
    });

    it('does not call remove when there are no audit URLs', async () => {
      const siteId = 'site12345';
      instance.allBySiteId = stub().resolves([]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.auditUrl.delete).to.not.have.been.called;
    });
  });

  describe('removeForSiteIdByCustomer', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteIdByCustomer()).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('throws an error if byCustomer is not a boolean', async () => {
      await expect(instance.removeForSiteIdByCustomer('site123')).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('removes customer URLs when byCustomer is true', async () => {
      const siteId = 'site12345';
      const customerUrl = {
        getUrl: () => 'https://example.com/customer-page',
        getByCustomer: () => true,
      };
      // GSI query returns only customer URLs
      instance.allByIndexKeys = stub().resolves([customerUrl]);

      await instance.removeForSiteIdByCustomer(siteId, true);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId, byCustomer: true });
      expect(callArgs[1]).to.deep.equal({ index: 'spacecat-data-gsi2pk-gsi2sk' });
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([
        { siteId, url: 'https://example.com/customer-page' },
      ]);
    });

    it('removes system URLs when byCustomer is false', async () => {
      const siteId = 'site12345';
      const systemUrl = {
        getUrl: () => 'https://example.com/system-page',
        getByCustomer: () => false,
      };
      // GSI query returns only system URLs
      instance.allByIndexKeys = stub().resolves([systemUrl]);

      await instance.removeForSiteIdByCustomer(siteId, false);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId, byCustomer: false });
      expect(callArgs[1]).to.deep.equal({ index: 'spacecat-data-gsi2pk-gsi2sk' });
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([
        { siteId, url: 'https://example.com/system-page' },
      ]);
    });

    it('handles URLs with byCustomer property instead of method', async () => {
      const siteId = 'site12345';
      const urlWithProperty = {
        url: 'https://example.com/prop-page', // Property instead of method
        byCustomer: true, // Property instead of method
      };
      instance.allByIndexKeys = stub().resolves([urlWithProperty]);

      await instance.removeForSiteIdByCustomer(siteId, true);

      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([
        { siteId, url: 'https://example.com/prop-page' },
      ]);
    });

    it('does not call remove when GSI returns no matching URLs', async () => {
      const siteId = 'site12345';
      // GSI query returns empty for system URLs
      instance.allByIndexKeys = stub().resolves([]);

      await instance.removeForSiteIdByCustomer(siteId, false);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      expect(mockElectroService.entities.auditUrl.delete).to.not.have.been.called;
    });

    it('does not call remove when allByIndexKeys returns empty array', async () => {
      const siteId = 'site12345';
      instance.allByIndexKeys = stub().resolves([]);

      await instance.removeForSiteIdByCustomer(siteId, true);

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      expect(mockElectroService.entities.auditUrl.delete).to.not.have.been.called;
    });
  });

  describe('sortAuditUrls', () => {
    it('returns empty array when input is empty', () => {
      const result = AuditUrlCollection.sortAuditUrls([]);
      expect(result).to.deep.equal([]);
    });

    it('returns null when input is null', () => {
      const result = AuditUrlCollection.sortAuditUrls(null);
      expect(result).to.be.null;
    });

    it('sorts by url alphabetically in ascending order', () => {
      const url1 = { getUrl: () => 'https://a.com' };
      const url2 = { getUrl: () => 'https://c.com' };
      const url3 = { getUrl: () => 'https://b.com' };

      const result = AuditUrlCollection.sortAuditUrls([url2, url1, url3], 'url', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url2);
    });

    it('sorts by url in descending order', () => {
      const url1 = { getUrl: () => 'https://a.com' };
      const url2 = { getUrl: () => 'https://c.com' };
      const url3 = { getUrl: () => 'https://b.com' };

      const result = AuditUrlCollection.sortAuditUrls([url1, url3, url2], 'url', 'desc');

      expect(result[0]).to.equal(url2);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url1);
    });

    it('sorts by createdAt in ascending order', () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2' };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      const result = AuditUrlCollection.sortAuditUrls([url2, url1, url3], 'createdAt', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url2);
    });

    it('sorts by updatedAt in ascending order', () => {
      const url1 = { getUpdatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getUpdatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2' };
      const url3 = { getUpdatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      const result = AuditUrlCollection.sortAuditUrls([url2, url1, url3], 'updatedAt', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url2);
    });

    it('handles null values by pushing them to the end', () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => null, getUrl: () => 'url2' };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      const result = AuditUrlCollection.sortAuditUrls([url2, url1, url3], 'createdAt', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url2);
    });

    it('handles objects without getter methods (uses optional chaining)', () => {
      const url1 = { url: 'https://a.com' };
      const url2 = { url: 'https://c.com' };
      const url3 = { url: 'https://b.com' };

      const result = AuditUrlCollection.sortAuditUrls([url2, url1, url3], 'url', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url3);
      expect(result[2]).to.equal(url2);
    });

    it('returns original order for unknown sortBy field', () => {
      const url1 = { getUrl: () => 'url1' };
      const url2 = { getUrl: () => 'url2' };

      const result = AuditUrlCollection.sortAuditUrls([url1, url2], 'unknown', 'asc');

      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url2);
    });
  });

  describe('allBySiteIdSorted', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdSorted()).to.be.rejectedWith('SiteId is required');
    });

    it('returns sorted URLs with pagination metadata when sortBy is provided', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2' };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      instance.allByIndexKeys = stub().resolves({ data: [url2, url1, url3], cursor: 'cursor123' });

      const result = await instance.allBySiteIdSorted('site-123', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.data).to.be.an('array').with.lengthOf(3);
      expect(result.data[0]).to.equal(url1);
      expect(result.data[1]).to.equal(url3);
      expect(result.data[2]).to.equal(url2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns unsorted URLs with pagination metadata when sortBy is not provided', async () => {
      const url1 = { getUrl: () => 'url1' };
      const url2 = { getUrl: () => 'url2' };

      instance.allByIndexKeys = stub().resolves({ data: [url2, url1], cursor: null });

      const result = await instance.allBySiteIdSorted('site-123', {});

      expect(result.data).to.deep.equal([url2, url1]);
      expect(result.cursor).to.be.null;
    });

    it('always returns object format with data and cursor', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url2' };

      instance.allByIndexKeys = stub().resolves({ data: [url2, url1], cursor: 'nextPage' });

      const result = await instance.allBySiteIdSorted('site-123', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('object');
      expect(result).to.have.property('data');
      expect(result).to.have.property('cursor', 'nextPage');
      expect(result.data[0]).to.equal(url1);
      expect(result.data[1]).to.equal(url2);
    });

    it('passes query options to allByIndexKeys with returnCursor', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      await instance.allBySiteIdSorted('site-123', { limit: 10, cursor: 'abc', sortBy: 'createdAt' });

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId: 'site-123' });
      expect(callArgs[1]).to.include({ limit: 10, cursor: 'abc', returnCursor: true });
    });
  });

  describe('allBySiteIdByCustomerSorted', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdByCustomerSorted()).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('throws an error if byCustomer is not a boolean', async () => {
      await expect(instance.allBySiteIdByCustomerSorted('site-123', 'not-a-boolean')).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('returns sorted customer URLs with pagination metadata when sortBy is provided', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1', getByCustomer: () => true };
      const url2 = { getCreatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2', getByCustomer: () => true };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3', getByCustomer: () => true };

      // GSI query returns only customer URLs (pre-filtered by byCustomer)
      instance.allByIndexKeys = stub().resolves({ data: [url2, url1, url3], cursor: 'cursor123' });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', true, { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.data).to.be.an('array').with.lengthOf(3);
      expect(result.data[0]).to.equal(url1);
      expect(result.data[1]).to.equal(url3);
      expect(result.data[2]).to.equal(url2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns unsorted system URLs with pagination metadata when sortBy is not provided', async () => {
      const url1 = { getUrl: () => 'url1', getByCustomer: () => false };
      const url2 = { getUrl: () => 'url2', getByCustomer: () => false };

      // GSI query returns only system URLs (pre-filtered by byCustomer=false)
      instance.allByIndexKeys = stub().resolves({ data: [url2, url1], cursor: null });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', false, {});

      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.data[0]).to.equal(url2);
      expect(result.data[1]).to.equal(url1);
      expect(result.cursor).to.be.null;
    });

    it('always returns object format with data and cursor', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1', getByCustomer: () => true };
      const url2 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url2', getByCustomer: () => true };

      instance.allByIndexKeys = stub().resolves({ data: [url2, url1], cursor: 'nextPage' });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', true, { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('object');
      expect(result).to.have.property('data');
      expect(result).to.have.property('cursor', 'nextPage');
      expect(result.data[0]).to.equal(url1);
      expect(result.data[1]).to.equal(url2);
    });

    it('passes query options to allByIndexKeys with GSI and returnCursor', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      await instance.allBySiteIdByCustomerSorted('site-123', true, { limit: 10, cursor: 'abc', sortBy: 'createdAt' });

      expect(instance.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ siteId: 'site-123', byCustomer: true });
      expect(callArgs[1]).to.include({
        limit: 10, cursor: 'abc', returnCursor: true, index: 'spacecat-data-gsi2pk-gsi2sk',
      });
    });

    it('handles URLs returned from GSI query', async () => {
      const url1 = { getUrl: () => 'url1', getByCustomer: () => true };
      const url2 = { getUrl: () => 'url2', getByCustomer: () => true };

      instance.allByIndexKeys = stub().resolves({ data: [url1, url2], cursor: null });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', true, {});

      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.cursor).to.be.null;
    });
  });

  describe('allBySiteIdAndAuditType with sorting', () => {
    it('applies sorting when sortBy is provided', async () => {
      const mockModel1 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url1' };
      const mockModel2 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url2' };

      // FilterExpression returns pre-filtered results from DynamoDB
      instance.allByIndexKeys = stub().resolves({ data: [mockModel1, mockModel2], cursor: null });

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('object');
      expect(result.data).to.be.an('array').with.lengthOf(2);
      expect(result.data[0]).to.equal(mockModel2);
      expect(result.data[1]).to.equal(mockModel1);
      expect(result.cursor).to.be.null;
    });
  });
});
