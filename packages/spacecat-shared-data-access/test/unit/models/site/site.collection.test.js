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

import Site from '../../../../src/models/site/site.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = { siteId: 's12345' };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Site, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allSitesToAudit', () => {
    it('returns all sites to audit', async () => {
      instance.all = stub().resolves([{ getId: () => 's12345' }]);

      const result = await instance.allSitesToAudit();

      expect(result).to.deep.equal(['s12345']);
      expect(instance.all).to.have.been.calledOnceWithExactly({}, { attributes: ['siteId'] });
    });
  });

  describe('allWithLatestAudit', () => {
    const mockAudit = {
      getId: () => 's12345',
      getSiteId: () => 's12345',
    };

    const mockSite = {
      getId: () => 's12345',
      _accessorCache: { getLatestAuditByAuditType: null },
    };

    const mockSiteNoAudit = {
      getId: () => 'x12345',
      _accessorCache: { getLatestAuditByAuditType: null },
    };

    beforeEach(() => {
      mockEntityRegistry.getCollection = stub().returns({
        all: stub().resolves([mockAudit]),
      });
    });

    it('throws error if audit type is not provided', async () => {
      await expect(instance.allWithLatestAudit()).to.be.rejectedWith('auditType is required');
    });

    it('returns all sites with latest audit', async () => {
      instance.all = stub().resolves([mockSite]);

      const result = await instance.allWithLatestAudit('cwv');

      expect(result).to.deep.equal([mockSite]);
      expect(instance.all).to.have.been.calledOnce;
    });

    it('returns all sites with latest audit by delivery type', async () => {
      instance.allByDeliveryType = stub().resolves([mockSite, mockSiteNoAudit]);

      const result = await instance.allWithLatestAudit('cwv', 'asc', 'aem_cs');

      expect(result).to.deep.equal([mockSite, mockSiteNoAudit]);
      expect(instance.allByDeliveryType).to.have.been.calledOnce;
    });
  });
  describe('addSiteCompetitorBySiteId', () => {
    it('adds a site competitor by site ID', async () => {
      const siteId = 's12345';
      const siteCompetitorBaseURL = 'https://competitor.com';
      const siteCompetitors = [];
      const mockSite = {
        siteCompetitors: {},
        getId: () => siteId,
        getSiteCompetitors: () => (siteCompetitors),
        save: stub().resolves(),
      };

      instance.findById = stub().resolves(mockSite);

      const result = await instance.addSiteCompetitorBySiteId(siteId, siteCompetitorBaseURL);

      expect(result).to.equal(mockSite);
      expect(mockSite.getSiteCompetitors()).to.have.deep.equal([siteCompetitorBaseURL]);
      expect(mockSite.save).to.have.been.calledOnce;
    });

    it('throws an error if site is not found', async () => {
      const siteId = 's12345';
      const siteCompetitorBaseURL = 'https://competitor.com';

      instance.findById = stub().resolves(null);

      await expect(instance.addSiteCompetitorBySiteId(siteId, siteCompetitorBaseURL))
        .to.be.rejectedWith(`Site with id ${siteId} not found`);
    });
  });

  describe('removeSiteCompetitorBySiteId', () => {
    it('removes a site competitor by site ID', async () => {
      const siteId = 's12345';
      const siteCompetitorBaseURL1 = 'https://competitor1.com';
      const siteCompetitorBaseURL2 = 'https://competitor2.com';
      const siteCompetitors = [siteCompetitorBaseURL1, siteCompetitorBaseURL2];
      const mockSite = {
        getId: () => siteId,
        getSiteCompetitors: () => (siteCompetitors),
        save: stub().resolves(),
      };

      instance.findById = stub().resolves(mockSite);

      const result = await instance.removeSiteCompetitorBySiteId(siteId, siteCompetitorBaseURL1);

      expect(result).to.equal(mockSite);
      expect(mockSite.getSiteCompetitors()).to.deep.equal([siteCompetitorBaseURL2]);
      expect(mockSite.save).to.have.been.calledOnce;
    });

    it('throws an error if site is not found', async () => {
      const siteId = 's12345';
      const siteCompetitorBaseURL = 'https://competitor.com';

      instance.findById = stub().resolves(null);

      await expect(instance.removeSiteCompetitorBySiteId(siteId, siteCompetitorBaseURL))
        .to.be.rejectedWith(`Site with id ${siteId} not found`);
    });
  });
});
