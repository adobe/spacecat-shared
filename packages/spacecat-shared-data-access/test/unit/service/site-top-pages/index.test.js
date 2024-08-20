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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import { siteTopPagesFunctions } from '../../../../src/service/site-top-pages/index.js';

use(chaiAsPromised);

const TEST_DA_CONFIG = {
  tableNameSiteTopPages: 'test-site-top-pages',
};

describe('Site Top Pages Access Pattern Tests', () => {
  describe('Site Top Pages Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = siteTopPagesFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports getSiteTopPages function', () => {
      expect(exportedFunctions).to.have.property('getTopPagesForSite');
      expect(exportedFunctions.getTopPagesForSite).to.be.a('function');
    });

    it('exports addSiteTopPage function', () => {
      expect(exportedFunctions).to.have.property('addSiteTopPage');
      expect(exportedFunctions.addSiteTopPage).to.be.a('function');
    });

    it('exports removeSiteTopPages function', () => {
      expect(exportedFunctions).to.have.property('removeSiteTopPages');
      expect(exportedFunctions.removeSiteTopPages).to.be.a('function');
    });
  });

  describe('Site Top Pages Functions Tests', () => {
    let mockDynamoClient;
    let mockLog = {};
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve(null)),
        putItem: sinon.stub().returns(Promise.resolve()),
        removeItem: sinon.stub().returns(Promise.resolve()),
        query: sinon.stub().returns(Promise.resolve([])),
      };

      mockLog = {
        info: sinon.stub().resolves(),
      };

      exportedFunctions = siteTopPagesFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('returns the site top pages by site id, source and geo', async () => {
      const siteTopPageData = {
        siteId: 'site123',
        url: 'https://www.example.com',
        traffic: 1000,
        source: 'gsc',
        topKeyword: 'keyword',
        geo: 'au',
        importedAt: new Date().toISOString(),
      };
      mockDynamoClient.query.returns(Promise.resolve([siteTopPageData]));

      const result = await exportedFunctions.getTopPagesForSite('site123', 'gsc', 'au');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockDynamoClient.query.calledWith({
        TableName: TEST_DA_CONFIG.tableNameSiteTopPages,
        KeyConditionExpression: 'siteId = :siteId',
        ExpressionAttributeValues: { ':siteId': 'site123', ':sourceGeo': 'gsc#au#' },
        ScanIndexForward: false,
      }));

      expect(result[0].getSiteId()).to.equal(siteTopPageData.siteId);
      expect(result[0].getURL()).to.equal(siteTopPageData.url);
      expect(result[0].getTraffic()).to.equal(siteTopPageData.traffic);
      expect(result[0].getTopKeyword()).to.equal(siteTopPageData.topKeyword);
      expect(result[0].getSource()).to.equal(siteTopPageData.source);
      expect(result[0].getGeo()).to.equal(siteTopPageData.geo);
      expect(result[0].getImportedAt()).to.equal(siteTopPageData.importedAt);
    });

    it('returns the site top pages by site id and source', async () => {
      const siteTopPageData = {
        siteId: 'site123',
        url: 'https://www.example.com',
        traffic: 1000,
        topKeyword: 'keyword',
        source: 'gsc',
        geo: 'au',
        importedAt: new Date().toISOString(),
      };
      mockDynamoClient.query.returns(Promise.resolve([siteTopPageData]));

      const result = await exportedFunctions.getTopPagesForSite('site123', 'gsc');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockDynamoClient.query.calledWith({
        TableName: TEST_DA_CONFIG.tableNameSiteTopPages,
        KeyConditionExpression: 'siteId = :siteId',
        ExpressionAttributeValues: { ':siteId': 'site123', ':source': 'gsc#' },
        ScanIndexForward: false,
      }));

      expect(result[0].getSiteId()).to.equal(siteTopPageData.siteId);
      expect(result[0].getURL()).to.equal(siteTopPageData.url);
      expect(result[0].getTraffic()).to.equal(siteTopPageData.traffic);
      expect(result[0].getTopKeyword()).to.equal(siteTopPageData.topKeyword);
      expect(result[0].getSource()).to.equal(siteTopPageData.source);
      expect(result[0].getGeo()).to.equal(siteTopPageData.geo);
      expect(result[0].getImportedAt()).to.equal(siteTopPageData.importedAt);
    });

    it('returns empty if no site top pages', async () => {
      mockDynamoClient.query.returns(Promise.resolve([]));

      const result = await exportedFunctions.getTopPagesForSite('site123');

      expect(mockDynamoClient.query.calledOnce).to.be.true;
      expect(mockDynamoClient.query.calledWith({
        TableName: TEST_DA_CONFIG.tableNameSiteTopPages,
        KeyConditionExpression: 'siteId = :siteId',
        ExpressionAttributeValues: { ':siteId': 'site123' },
        ScanIndexForward: false,
      }));
      expect(result).to.be.an('array').that.is.empty;
    });

    it('adds a new site top page successfully', async () => {
      const siteTopPageData = {
        siteId: 'site123',
        url: 'https://www.example.com',
        traffic: 1000,
        topKeyword: 'keyword',
        source: 'rum',
        geo: 'us',
        importedAt: new Date().toISOString(),
      };

      const result = await exportedFunctions.addSiteTopPage(siteTopPageData);

      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(mockDynamoClient.putItem.calledWith(TEST_DA_CONFIG.tableNameSiteTopPages, {
        ...siteTopPageData,
        SK: 'rum#us#000000001000',
      }));
      expect(result.getSiteId()).to.equal(siteTopPageData.siteId);
      expect(result.getURL()).to.equal(siteTopPageData.url);
      expect(result.getTraffic()).to.equal(siteTopPageData.traffic);
      expect(result.getTopKeyword()).to.equal(siteTopPageData.topKeyword);
      expect(result.getSource()).to.equal(siteTopPageData.source);
      expect(result.getGeo()).to.equal(siteTopPageData.geo);
      expect(result.getImportedAt()).to.equal(siteTopPageData.importedAt);
    });

    it('removes site top pages successfully', async () => {
      const siteTopPageData = {
        siteId: 'site123',
        url: 'https://www.example.com',
        traffic: 1000,
        topKeyword: 'keyword',
        source: 'rum',
        geo: 'us',
        importedAt: new Date().toISOString(),
      };

      mockDynamoClient.query.returns(Promise.resolve([siteTopPageData]));

      await exportedFunctions.removeSiteTopPages('site123', 'rum', 'us');

      expect(mockDynamoClient.removeItem.calledOnce).to.be.true;
      expect(mockDynamoClient.removeItem.calledWith(TEST_DA_CONFIG.tableNameSiteTopPages, {
        siteId: 'site123',
        SK: 'rum#us#000000001000',
      }));
    });
  });
});
