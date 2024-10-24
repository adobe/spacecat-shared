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

import { ImportUrlStatus } from '../../../../src/index.js';
import {
  createImportUrl,
  IMPORT_URL_EXPIRES_IN_DAYS,
} from '../../../../src/models/importer/import-url.js';
import { ImportUrlDto } from '../../../../src/dto/import-url.js';

const validImportUrlData = {
  id: '123',
  url: 'https://www.example.com',
  jobId: '456',
  status: 'RUNNING',
};

const importUrlRedirectData = {
  id: '456',
  url: 'https://www.example.com/redirect',
  jobId: '456',
  status: ImportUrlStatus.REDIRECT,
  reason: 'https://www.example.com/redirect/destination',
  path: '/test-data',
  file: '/test-data.docx',
  urlNumber: 8,
  totalUrlCount: 10,
};

describe('ImportUrl Model tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if url is not a valid URL', () => {
      expect(() => createImportUrl({ ...validImportUrlData, url: 'invalid-url' })).to.throw('Invalid Url: invalid-url');
    });

    it('throws an error if status is invalid', () => {
      expect(() => createImportUrl({ ...validImportUrlData, status: 'invalid' })).to.throw('Invalid Import URL status: invalid');
    });

    it('throws an error if jobId is not a valid string', () => {
      expect(() => createImportUrl({ ...validImportUrlData, jobId: null })).to.throw('Invalid Job ID: null');
    });
  });

  describe('Import URL Functionality Tests', () => {
    let importUrl;

    beforeEach(() => {
      importUrl = createImportUrl({ ...validImportUrlData });
    });

    it('updates the status of the import URL', () => {
      importUrl.setStatus(ImportUrlStatus.COMPLETE);
      expect(importUrl.getStatus()).to.equal(ImportUrlStatus.COMPLETE);
    });

    it('returns the url attribute of the import URL', () => {
      expect(importUrl.getUrl()).to.equal('https://www.example.com');
    });

    it('returns the job ID of the import URL', () => {
      expect(importUrl.getJobId()).to.equal('456');
    });

    it('throws an error if the status is invalid', () => {
      expect(() => importUrl.setStatus('invalid')).to.throw('Invalid Import URL status during update: invalid');
    });

    it('updates the status and reason for a url', () => {
      importUrl.setStatus(ImportUrlStatus.REDIRECT);
      importUrl.setReason('https://www.example.com/redirect/destination');
      expect(importUrl.getStatus()).to.equal(ImportUrlStatus.REDIRECT);
      expect(importUrl.getReason()).to.equal('https://www.example.com/redirect/destination');
    });

    it('does not update properties if the setters are passed invalid data', () => {
      const importUrlRedirect = createImportUrl(importUrlRedirectData);

      importUrlRedirect.setReason(undefined);
      expect(importUrlRedirect.getReason()).to.equal('https://www.example.com/redirect/destination');

      importUrlRedirect.setPath(null);
      expect(importUrlRedirect.getPath()).to.equal('/test-data');

      importUrlRedirect.setFile('');
      expect(importUrlRedirect.getFile()).to.equal('/test-data.docx');
    });

    it('updates the file and path for a url', () => {
      importUrl.setStatus(ImportUrlStatus.COMPLETE);
      importUrl.setPath('/index');
      importUrl.setFile('/index.docx');

      expect(importUrl.getStatus()).to.equal(ImportUrlStatus.COMPLETE);
      expect(importUrl.getPath()).to.equal('/index');
      expect(importUrl.getFile()).to.equal('/index.docx');
    });
  });

  describe('Import URL DTO Tests', () => {
    it('should serialize to a Dynamo-compatible object', () => {
      const importUrlRedirect = createImportUrl(importUrlRedirectData);

      const expiresAtDate = importUrlRedirect.getExpiresAt();

      // Check that expiresAtDate is IMPORT_URL_EXPIRES_IN_DAYS days from today
      const expectedExpiresAtDate = new Date();
      expectedExpiresAtDate.setDate(expectedExpiresAtDate.getDate() + IMPORT_URL_EXPIRES_IN_DAYS);

      expect(expiresAtDate.toDateString()).to.equal(expectedExpiresAtDate.toDateString());

      // expiresAt is dynamic, so now that we've checked it we'll remove it from the object
      const importUrlDynamoItem = ImportUrlDto.toDynamoItem(importUrlRedirect);
      delete importUrlDynamoItem.expiresAt;

      expect(importUrlDynamoItem).to.deep.equal({
        id: '456',
        url: 'https://www.example.com/redirect',
        jobId: '456',
        status: ImportUrlStatus.REDIRECT,
        reason: 'https://www.example.com/redirect/destination',
        path: '/test-data',
        file: '/test-data.docx',
        totalUrlCount: 10,
        urlNumber: 8,
      });
    });

    it('should deserialize from a Dynamo object', () => {
      const urlFromDynamo = ImportUrlDto.fromDynamoItem(importUrlRedirectData);

      const importUrlRedirect = createImportUrl(importUrlRedirectData);
      expect(urlFromDynamo.getId()).to.deep.equal(importUrlRedirect.getId());
      expect(urlFromDynamo.getUrl()).to.deep.equal(importUrlRedirect.getUrl());
      expect(urlFromDynamo.getJobId()).to.deep.equal(importUrlRedirect.getJobId());
      expect(urlFromDynamo.getStatus()).to.deep.equal(importUrlRedirect.getStatus());
      expect(urlFromDynamo.getReason()).to.deep.equal(importUrlRedirect.getReason());
      expect(urlFromDynamo.getPath()).to.deep.equal(importUrlRedirect.getPath());
      expect(urlFromDynamo.getFile()).to.deep.equal(importUrlRedirect.getFile());
      expect(urlFromDynamo.getTotalUrlCount()).to.equal(importUrlRedirect.getTotalUrlCount());
      expect(urlFromDynamo.getUrlNumber()).to.equal(importUrlRedirect.getUrlNumber());
    });
  });
});
