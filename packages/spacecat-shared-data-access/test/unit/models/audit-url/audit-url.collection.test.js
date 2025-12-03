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

  describe('findBySiteIdAndUrl', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.findBySiteIdAndUrl()).to.be.rejectedWith('Both siteId and url are required');
    });

    it('throws an error if url is not provided', async () => {
      await expect(instance.findBySiteIdAndUrl('site123')).to.be.rejectedWith('Both siteId and url are required');
    });

    it('returns the audit URL when found', async () => {
      instance.allBySiteIdAndUrl = stub().resolves([model]);

      const result = await instance.findBySiteIdAndUrl('site123', 'https://example.com/page');

      expect(result).to.equal(model);
      expect(instance.allBySiteIdAndUrl).to.have.been.calledOnceWith('site123', 'https://example.com/page');
    });

    it('returns null when audit URL is not found', async () => {
      instance.allBySiteIdAndUrl = stub().resolves([]);

      const result = await instance.findBySiteIdAndUrl('site123', 'https://example.com/page');

      expect(result).to.be.null;
    });
  });

  describe('allBySiteIdAndAuditType', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType()).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('throws an error if auditType is not provided', async () => {
      await expect(instance.allBySiteIdAndAuditType('site123')).to.be.rejectedWith('Both siteId and auditType are required');
    });

    it('filters URLs by audit type', async () => {
      const mockModel1 = Object.create(AuditUrl.prototype);
      mockModel1.audits = ['accessibility', 'seo'];
      mockModel1.isAuditEnabled = (type) => mockModel1.audits.includes(type);

      const mockModel2 = Object.create(AuditUrl.prototype);
      mockModel2.audits = ['broken-backlinks'];
      mockModel2.isAuditEnabled = (type) => mockModel2.audits.includes(type);

      const mockModel3 = Object.create(AuditUrl.prototype);
      mockModel3.audits = ['accessibility'];
      mockModel3.isAuditEnabled = (type) => mockModel3.audits.includes(type);

      instance.allBySiteId = stub().resolves([mockModel1, mockModel2, mockModel3]);

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility');

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
      expect(result).to.include(mockModel1);
      expect(result).to.include(mockModel3);
      expect(result).to.not.include(mockModel2);
    });

    it('returns empty array when no URLs match the audit type', async () => {
      const mockModel = Object.create(AuditUrl.prototype);
      mockModel.audits = ['seo'];
      mockModel.isAuditEnabled = (type) => mockModel.audits.includes(type);

      instance.allBySiteId = stub().resolves([mockModel]);

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility');

      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });

    it('passes pagination options to allBySiteId', async () => {
      instance.allBySiteId = stub().resolves([]);
      const options = { limit: 50, cursor: 'abc123' };

      await instance.allBySiteIdAndAuditType('site123', 'accessibility', options);

      expect(instance.allBySiteId).to.have.been.calledOnceWith('site123', options);
    });
  });

  describe('removeForSiteId', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('removes all audit URLs for a given siteId', async () => {
      const siteId = 'site12345';
      instance.allBySiteId = stub().resolves([model]);

      await instance.removeForSiteId(siteId);

      expect(instance.allBySiteId).to.have.been.calledOnceWith(siteId);
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([{ auditUrlId: 'au12345' }]);
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

    it('removes all audit URLs for a given siteId and byCustomer flag', async () => {
      const siteId = 'site12345';
      const byCustomer = true;
      instance.allBySiteIdByCustomer = stub().resolves([model]);

      await instance.removeForSiteIdByCustomer(siteId, byCustomer);

      expect(instance.allBySiteIdByCustomer).to.have.been.calledOnceWith(siteId, byCustomer);
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([{ auditUrlId: 'au12345' }]);
    });

    it('does not call remove when there are no matching audit URLs', async () => {
      const siteId = 'site12345';
      const byCustomer = false;
      instance.allBySiteIdByCustomer = stub().resolves([]);

      await instance.removeForSiteIdByCustomer(siteId, byCustomer);

      expect(instance.allBySiteIdByCustomer).to.have.been.calledOnceWith(siteId, byCustomer);
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

    it('returns sorted URLs when sortBy is provided', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2' };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      instance.allBySiteId = stub().resolves({ items: [url2, url1, url3], cursor: 'cursor123' });

      const result = await instance.allBySiteIdSorted('site-123', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.items).to.be.an('array').with.lengthOf(3);
      expect(result.items[0]).to.equal(url1);
      expect(result.items[1]).to.equal(url3);
      expect(result.items[2]).to.equal(url2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns unsorted URLs when sortBy is not provided', async () => {
      const url1 = { getUrl: () => 'url1' };
      const url2 = { getUrl: () => 'url2' };

      instance.allBySiteId = stub().resolves({ items: [url2, url1] });

      const result = await instance.allBySiteIdSorted('site-123', {});

      expect(result.items).to.deep.equal([url2, url1]);
    });

    it('handles array result format', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url2' };

      instance.allBySiteId = stub().resolves([url2, url1]);

      const result = await instance.allBySiteIdSorted('site-123', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('array').with.lengthOf(2);
      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url2);
    });

    it('passes query options to allBySiteId', async () => {
      instance.allBySiteId = stub().resolves({ items: [] });

      await instance.allBySiteIdSorted('site-123', { limit: 10, cursor: 'abc', sortBy: 'createdAt' });

      expect(instance.allBySiteId).to.have.been.calledOnceWith('site-123', { limit: 10, cursor: 'abc' });
    });
  });

  describe('allBySiteIdByCustomerSorted', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.allBySiteIdByCustomerSorted()).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('throws an error if byCustomer is not a boolean', async () => {
      await expect(instance.allBySiteIdByCustomerSorted('site-123', 'not-a-boolean')).to.be.rejectedWith('SiteId is required and byCustomer must be a boolean');
    });

    it('returns sorted URLs when sortBy is provided', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-03T00:00:00Z', getUrl: () => 'url2' };
      const url3 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url3' };

      instance.allBySiteIdByCustomer = stub().resolves({ items: [url2, url1, url3], cursor: 'cursor123' });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', true, { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result.items).to.be.an('array').with.lengthOf(3);
      expect(result.items[0]).to.equal(url1);
      expect(result.items[1]).to.equal(url3);
      expect(result.items[2]).to.equal(url2);
      expect(result.cursor).to.equal('cursor123');
    });

    it('returns unsorted URLs when sortBy is not provided', async () => {
      const url1 = { getUrl: () => 'url1' };
      const url2 = { getUrl: () => 'url2' };

      instance.allBySiteIdByCustomer = stub().resolves({ items: [url2, url1] });

      const result = await instance.allBySiteIdByCustomerSorted('site-123', false, {});

      expect(result.items).to.deep.equal([url2, url1]);
    });

    it('handles array result format', async () => {
      const url1 = { getCreatedAt: () => '2025-01-01T00:00:00Z', getUrl: () => 'url1' };
      const url2 = { getCreatedAt: () => '2025-01-02T00:00:00Z', getUrl: () => 'url2' };

      instance.allBySiteIdByCustomer = stub().resolves([url2, url1]);

      const result = await instance.allBySiteIdByCustomerSorted('site-123', true, { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('array').with.lengthOf(2);
      expect(result[0]).to.equal(url1);
      expect(result[1]).to.equal(url2);
    });

    it('passes query options to allBySiteIdByCustomer', async () => {
      instance.allBySiteIdByCustomer = stub().resolves({ items: [] });

      await instance.allBySiteIdByCustomerSorted('site-123', true, { limit: 10, cursor: 'abc', sortBy: 'createdAt' });

      expect(instance.allBySiteIdByCustomer).to.have.been.calledOnceWith('site-123', true, { limit: 10, cursor: 'abc' });
    });
  });

  describe('allBySiteIdAndAuditType with sorting', () => {
    it('applies sorting when sortBy is provided', async () => {
      const mockModel1 = Object.create(AuditUrl.prototype);
      mockModel1.audits = ['accessibility'];
      mockModel1.isAuditEnabled = (type) => mockModel1.audits.includes(type);
      mockModel1.getCreatedAt = () => '2025-01-02T00:00:00Z';

      const mockModel2 = Object.create(AuditUrl.prototype);
      mockModel2.audits = ['accessibility'];
      mockModel2.isAuditEnabled = (type) => mockModel2.audits.includes(type);
      mockModel2.getCreatedAt = () => '2025-01-01T00:00:00Z';

      instance.allBySiteId = stub().resolves([mockModel1, mockModel2]);

      const result = await instance.allBySiteIdAndAuditType('site123', 'accessibility', { sortBy: 'createdAt', sortOrder: 'asc' });

      expect(result).to.be.an('array').with.lengthOf(2);
      expect(result[0]).to.equal(mockModel2);
      expect(result[1]).to.equal(mockModel1);
    });
  });
});
