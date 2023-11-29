/*
 * Copyright 2023 Adobe. All rights reserved.
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
import { createSite } from '../../src/models/site.js';

// Constants for testing
const validData = {
  baseURL: 'https://www.example.com',
  imsOrgId: 'org123',
};

describe('Site Module Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createSite({ ...validData, baseURL: 'invalid-url' })).to.throw('Base URL must be a valid URL');
    });

    it('creates a site object with valid baseURL', () => {
      const site = createSite({ ...validData });
      expect(site).to.be.an('object');
      expect(site.getBaseURL()).to.equal(validData.baseURL);
    });
  });

  describe('Site Object Functionality', () => {
    let site;

    beforeEach(() => {
      // Reset site object before each test
      site = createSite(validData);
    });

    it('updates baseURL correctly', () => {
      const newURL = 'https://www.newexample.com';
      site.updateBaseURL(newURL);
      expect(site.getBaseURL()).to.equal(newURL);
    });

    it('throws an error when updating with an invalid baseURL', () => {
      expect(() => site.updateBaseURL('invalid-url')).to.throw('Base URL must be a valid URL');
    });

    it('updates imsOrgId correctly', () => {
      const newImsOrgId = 'newOrg123';
      site.updateImsOrgId(newImsOrgId);
      expect(site.getImsOrgId()).to.equal(newImsOrgId);
    });

    it('throws an error when updating with an empty imsOrgId', () => {
      expect(() => site.updateImsOrgId('')).to.throw('IMS Org ID must be provided');
    });
  });
});
