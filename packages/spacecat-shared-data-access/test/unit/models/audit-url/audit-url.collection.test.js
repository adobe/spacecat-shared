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
    source: 'manual',
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

  describe('removeForSiteIdAndSource', () => {
    it('throws an error if siteId is not provided', async () => {
      await expect(instance.removeForSiteIdAndSource()).to.be.rejectedWith('Both siteId and source are required');
    });

    it('throws an error if source is not provided', async () => {
      await expect(instance.removeForSiteIdAndSource('site123')).to.be.rejectedWith('Both siteId and source are required');
    });

    it('removes all audit URLs for a given siteId and source', async () => {
      const siteId = 'site12345';
      const source = 'manual';
      instance.allBySiteIdAndSource = stub().resolves([model]);

      await instance.removeForSiteIdAndSource(siteId, source);

      expect(instance.allBySiteIdAndSource).to.have.been.calledOnceWith(siteId, source);
      expect(mockElectroService.entities.auditUrl.delete).to.have.been.calledOnceWith([{ auditUrlId: 'au12345' }]);
    });

    it('does not call remove when there are no matching audit URLs', async () => {
      const siteId = 'site12345';
      const source = 'sitemap';
      instance.allBySiteIdAndSource = stub().resolves([]);

      await instance.removeForSiteIdAndSource(siteId, source);

      expect(instance.allBySiteIdAndSource).to.have.been.calledOnceWith(siteId, source);
      expect(mockElectroService.entities.auditUrl.delete).to.not.have.been.called;
    });
  });
});

