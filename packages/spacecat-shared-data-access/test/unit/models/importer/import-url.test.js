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

import { createImportUrl } from '../../../../src/models/importer/import-url.js';

const validImportUrlData = {
  id: '123',
  baseURL: 'https://www.example.com',
  jobId: '456',
  status: 'RUNNING',
  options: {},
};

describe('ImportUrl Model tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createImportUrl({ ...validImportUrlData, baseURL: 'invalid-url' })).to.throw('Invalid base URL: invalid-url');
    });

    it('throws an error if status is invalid', () => {
      expect(() => createImportUrl({ ...validImportUrlData, status: 'invalid' })).to.throw('Invalid Import URL status: invalid');
    });

    it('throws an error if options is not an object', () => {
      expect(() => createImportUrl({ ...validImportUrlData, options: 'invalid-options' })).to.throw('Invalid options: invalid-options');
    });
  });
  describe('Import URL Functionality Tests', () => {
    let importUrl;
    beforeEach(() => {
      importUrl = createImportUrl({ ...validImportUrlData });
    });
    it('updates the status of the import URL', () => {
      importUrl.updateStatus('COMPLETE');
      expect(importUrl.getStatus()).to.equal('COMPLETE');
    });
    it('returns the base URL of the import URL', () => {
      expect(importUrl.getBaseURL()).to.equal('https://www.example.com');
    });
    it('returns the job ID of the import URL', () => {
      expect(importUrl.getJobId()).to.equal('456');
    });
    it('returns the options of the import URL', () => {
      expect(importUrl.getOptions()).to.deep.equal({});
    });
    it('throws an error if the status is invalid', () => {
      expect(() => importUrl.updateStatus('invalid')).to.throw('Invalid Import URL status during update: invalid');
    });
  });
});
