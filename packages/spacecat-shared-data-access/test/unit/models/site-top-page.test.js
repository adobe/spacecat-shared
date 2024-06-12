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

import { expect } from 'chai';
import { createSiteTopPage } from '../../../src/models/site-top-page.js';

const validData = {
  siteId: 'site123',
  url: 'https://www.example.com',
  traffic: 1000,
  topKeyword: 'keyword',
  source: 'rum',
  geo: 'au',
  importedAt: new Date().toISOString(),
};

describe('SiteTopPage Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if siteId is not provided', () => {
      expect(() => createSiteTopPage({ ...validData, siteId: '' }))
        .to.throw('Site ID must be provided');
    });

    it('throws an error if url is not valid', () => {
      expect(() => createSiteTopPage({ ...validData, url: 'invalid-url' }))
        .to.throw('Valid Url must be provided');
    });

    it('throws an error if traffic is not an integer', () => {
      expect(() => createSiteTopPage({ ...validData, traffic: 'not-an-integer' }))
        .to.throw('Traffic must be provided');
    });

    it('throws an error if source is not provided', () => {
      expect(() => createSiteTopPage({ ...validData, source: '' }))
        .to.throw('Source must be provided');
    });

    it('throws an error if importedAt is not a valid ISO date', () => {
      expect(() => createSiteTopPage({ ...validData, importedAt: 'invalid-date' }))
        .to.throw('Imported at must be a valid ISO date');
    });

    it('throws an error if top keyword is not provided', () => {
      expect(() => createSiteTopPage({ ...validData, topKeyword: '' }))
        .to.throw('Top keyword must be provided');
    });

    it('creates a SiteTopPage object with valid data', () => {
      const siteTopPage = createSiteTopPage(validData);
      expect(siteTopPage).to.be.an('object');
      expect(siteTopPage.getSiteId()).to.equal(validData.siteId);
      expect(siteTopPage.getURL()).to.equal(validData.url);
      expect(siteTopPage.getTraffic()).to.equal(validData.traffic);
      expect(siteTopPage.getSource()).to.equal(validData.source);
      expect(siteTopPage.getGeo()).to.equal(validData.geo);
      expect(siteTopPage.getImportedAt()).to.equal(validData.importedAt);
    });

    it('creates a SiteTopPage object with default geo', () => {
      const siteTopPage = createSiteTopPage({ ...validData, geo: '' });
      expect(siteTopPage).to.be.an('object');
      expect(siteTopPage.getSiteId()).to.equal(validData.siteId);
      expect(siteTopPage.getURL()).to.equal(validData.url);
      expect(siteTopPage.getTraffic()).to.equal(validData.traffic);
      expect(siteTopPage.getSource()).to.equal(validData.source);
      expect(siteTopPage.getGeo()).to.equal('global');
      expect(siteTopPage.getImportedAt()).to.equal(validData.importedAt);
    });
  });
});
