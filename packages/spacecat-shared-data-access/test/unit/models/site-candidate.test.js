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
import {
  createSiteCandidate,
  SITE_CANDIDATE_STATUS,
  DEFAULT_UPDATED_BY,
  SITE_CANDIDATE_SOURCES,
} from '../../../src/models/site-candidate.js';

const validData = {
  baseURL: 'https://www.example.com',
  status: 'PENDING',
  hlxConfig: {
    rso: {
      owner: 'some-owner',
      site: 'some-site',
      ref: 'main',
    },
    cdnProdHost: 'www.example.com',
    code: {
      owner: 'some-owner',
      repo: 'some-repo',
      source: {
        type: 'github',
        url: 'https://github.com/some-owner/some-repo',
      },
    },
    content: {
      contentBusId: '1234',
      source: {
        type: 'onedrive',
        url: 'https://some-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/some-site/www',
      },
    },
    hlxVersion: 5,
  },
};

describe('Site Candidate Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createSiteCandidate({ ...validData, baseURL: 'invalid-url' })).to.throw('Base URL must be a valid URL');
    });

    it('throws an error if hlxConfig is invalid', () => {
      expect(() => createSiteCandidate({ ...validData, hlxConfig: '1234' })).to.throw('HLX Config must be an object: 1234');
    });

    it('creates a site candidate object with valid baseURL', () => {
      const siteCandidate = createSiteCandidate({ ...validData });
      expect(siteCandidate).to.be.an('object');
      expect(siteCandidate.getBaseURL()).to.equal(validData.baseURL);
    });

    it('creates a site candidate without hlxConfig', () => {
      const siteCandidate = createSiteCandidate({ ...validData, hlxConfig: undefined });
      expect(siteCandidate).to.be.an('object');
      expect(siteCandidate.getHlxConfig()).to.deep.equal({});
    });

    it('creates a site candidate with default updated by', () => {
      const siteCandidate = createSiteCandidate({ ...validData, updatedBy: undefined });
      expect(siteCandidate.getUpdatedBy()).to.equal(DEFAULT_UPDATED_BY);
    });
  });

  describe('Site Candidate Object Functionality', () => {
    let siteCandidate;

    beforeEach(() => {
      siteCandidate = createSiteCandidate(validData);
    });

    it('does not have an id', () => {
      expect(siteCandidate.getId()).to.be.undefined;
    });

    it('updates hlxConfig correctly', () => {
      const newHlxConfig = {
        cdnProdHost: 'www.another-example.com',
        code: {
          owner: 'another-owner',
          repo: 'another-repo',
          source: {
            type: 'github',
            url: 'https://github.com/another-owner/another-repo',
          },
        },
        content: {
          contentBusId: '1234',
          source: {
            type: 'onedrive',
            url: 'https://another-owner.sharepoint.com/:f:/r/sites/SomeFolder/Shared%20Documents/another-site/www',
          },
        },
        hlxVersion: 5,
      };

      siteCandidate.setHlxConfig(newHlxConfig);
      const helixConfig = siteCandidate.getHlxConfig();

      expect(helixConfig).to.be.an('object');
      expect(helixConfig).to.deep.equal(newHlxConfig);
    });

    it('updates site id correctly', () => {
      const newSiteId = 'some-site-id';
      siteCandidate.setSiteId(newSiteId);
      expect(siteCandidate.getSiteId()).to.equal(newSiteId);
    });

    it('updates source correctly', () => {
      const newSource = SITE_CANDIDATE_SOURCES.RUM;
      siteCandidate.setSource(newSource);
      expect(siteCandidate.getSource()).to.equal(newSource);
    });

    it('updates status correctly', () => {
      const newStatus = SITE_CANDIDATE_STATUS.APPROVED;
      siteCandidate.setStatus(newStatus);
      expect(siteCandidate.getStatus()).to.equal(newStatus);
    });

    it('updates updatedBy correctly', () => {
      const newUpdatedBy = 'pablo';
      siteCandidate.setUpdatedBy(newUpdatedBy);
      expect(siteCandidate.getUpdatedBy()).to.equal(newUpdatedBy);
    });
  });
});
