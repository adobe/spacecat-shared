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
import { createSiteCandidate, SITE_CANDIDATE_STATUS, DEFAULT_UPDATED_BY } from '../../../src/models/site-candidate.js';
import { sleep } from '../util.js';

const validData = {
  baseURL: 'https://www.example.com',
  status: 'PENDING',
};

describe('Site Candidate Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createSiteCandidate({ ...validData, baseURL: 'invalid-url' })).to.throw('Base URL must be a valid URL');
    });

    it('creates a site candidate object with valid baseURL', () => {
      const siteCandidate = createSiteCandidate({ ...validData });
      expect(siteCandidate).to.be.an('object');
      expect(siteCandidate.getBaseURL()).to.equal(validData.baseURL);
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

    it('updates status correctly', () => {
      const newStatus = SITE_CANDIDATE_STATUS.APPROVED;
      siteCandidate.setStatus(newStatus);
      expect(siteCandidate.getStatus()).to.equal(newStatus);
    });

    it('updates updatedAt and updateBy when status is updated', async () => {
      const initialUpdatedAt = siteCandidate.getUpdatedAt();
      const initialUpdatedBy = siteCandidate.getUpdatedBy();

      await sleep(20);

      siteCandidate.setStatus(SITE_CANDIDATE_STATUS.APPROVED, 'new challenger');

      expect(siteCandidate.getUpdatedAt()).to.not.equal(initialUpdatedAt);
      expect(siteCandidate.getUpdatedBy()).to.not.equal(initialUpdatedBy);
    });
  });
});
