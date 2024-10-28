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
import { createImportJob } from '../../../../src/models/importer/import-job.js';
import { ImportJobStatus, ImportOptions } from '../../../../src/index.js';

const validImportJob = {
  id: '123',
  hashedApiKey: '4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4',
  baseURL: 'https://www.test.com',
  status: ImportJobStatus.RUNNING,
  startTime: '2024-05-29T14:26:00.000Z',
  options: {
    [ImportOptions.ENABLE_JAVASCRIPT]: true,
  },
  initiatedBy: {
    apiKeyName: 'test',
  },
};
describe('ImportJob Model tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if baseURL is not a valid URL', () => {
      expect(() => createImportJob({ ...validImportJob, baseURL: 'invalid-url' })).to.throw('Invalid base URL: invalid-url');
    });

    it('throws an error if status is invalid', () => {
      expect(() => createImportJob({ ...validImportJob, status: 'invalid' })).to.throw('Invalid Import Job status invalid');
    });

    it('throws an error if startTime is not a valid date', () => {
      expect(() => createImportJob({ ...validImportJob, startTime: 'invalid-date' })).to.throw('"StartTime" should be a valid ISO string');
    });

    it('throws an error if options is not an object', () => {
      expect(() => createImportJob({ ...validImportJob, options: 'invalid-options' })).to.throw('Invalid options: invalid-options');
    });

    it('throws an error if apiKey is not a valid string', () => {
      expect(() => createImportJob({ ...validImportJob, hashedApiKey: 123 })).to.throw('Invalid API key: 123');
    });

    it('verify supported options', () => {
      const job = createImportJob({
        ...validImportJob,
        options: {
          [ImportOptions.ENABLE_JAVASCRIPT]: true,
          [ImportOptions.PAGE_LOAD_TIMEOUT]: 1000,
        },
      });
      expect(job.getOptions()).to.deep.equal({
        [ImportOptions.ENABLE_JAVASCRIPT]: true,
        [ImportOptions.PAGE_LOAD_TIMEOUT]: 1000,
      });
    });

    /**
     * There is an expectation that values coming into the import job ran through the
     * body-data-wrapper's coerce logic, converting the string values into their potential data
     * types like booleans, integers.
     */
    /* eslint-disable max-len */
    it('test option data types', () => {
      // Enable Javascript checks
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.ENABLE_JAVASCRIPT]: true } })).to.not.throw();
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.ENABLE_JAVASCRIPT]: false } })).to.not.throw();

      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.ENABLE_JAVASCRIPT]: 'true' } })).to.throw('Invalid value for enableJavascript: true');
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.ENABLE_JAVASCRIPT]: 'false' } })).to.throw('Invalid value for enableJavascript: false');
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.ENABLE_JAVASCRIPT]: 'x' } })).to.throw('Invalid value for enableJavascript: x');

      // Page Load Timeout checks
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.PAGE_LOAD_TIMEOUT]: 1000 } })).to.not.throw();
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.PAGE_LOAD_TIMEOUT]: 1.1 } })).to.throw('Invalid value for pageLoadTimeout: 1.1');
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.PAGE_LOAD_TIMEOUT]: '1000' } })).to.throw('Invalid value for pageLoadTimeout: 1000');
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.PAGE_LOAD_TIMEOUT]: -1 } })).to.throw('Invalid value for pageLoadTimeout: -1');
      expect(() => createImportJob({ ...validImportJob, options: { [ImportOptions.PAGE_LOAD_TIMEOUT]: 'x' } })).to.throw('Invalid value for pageLoadTimeout: x');
    });

    it('verify no options does not fail', () => {
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options,
        ...noOptions
      } = validImportJob;

      const job = createImportJob({ ...noOptions });
      expect(job.getOptions()).to.be.undefined;
    });

    it('verify unsupported options throw', () => {
      expect(() => createImportJob({
        ...validImportJob,
        options: {
          notSupported: true,
        },
      })).to.throw('Invalid options: notSupported');
    });

    it('creates an import job object with a startTime', () => {
      const importJob = createImportJob({ ...validImportJob, startTime: '' });
      expect(importJob.getStartTime()).to.match(/^20/);
    });

    it('create an import job with custom fields', () => {
      let headersJob = createImportJob({ ...validImportJob, hasCustomHeaders: true });
      expect(headersJob.hasCustomHeaders()).to.be.true;
      headersJob = createImportJob({ ...validImportJob, hasCustomHeaders: false });
      expect(headersJob.hasCustomHeaders()).to.be.false;
      headersJob = createImportJob({ ...validImportJob });
      expect(headersJob.hasCustomHeaders()).to.be.false;
      expect(() => createImportJob({ ...validImportJob, hasCustomHeaders: 'x' })).to.throw('Invalid hasCustomHeaders value: x');

      let importJsJob = createImportJob({ ...validImportJob, hasCustomImportJs: true });
      expect(importJsJob.hasCustomImportJs()).to.be.true;
      importJsJob = createImportJob({ ...validImportJob, hasCustomImportJs: false });
      expect(importJsJob.hasCustomImportJs()).to.be.false;
      importJsJob = createImportJob({ ...validImportJob });
      expect(importJsJob.hasCustomImportJs()).to.be.false;
      expect(() => createImportJob({ ...validImportJob, hasCustomImportJs: 'x' })).to.throw('Invalid hasCustomImportJs value: x');
    });
  });

  describe('Import Job Functionality Tests', () => {
    let importJob;
    beforeEach(() => {
      importJob = createImportJob({ ...validImportJob });
    });

    it('updates status of import job', () => {
      importJob.updateStatus(ImportJobStatus.COMPLETE);
      expect(importJob.getStatus()).to.equal(ImportJobStatus.COMPLETE);
    });

    it('updates status of the import job to STOPPED', () => {
      importJob.updateStatus(ImportJobStatus.STOPPED);
      expect(importJob.getStatus()).to.equal(ImportJobStatus.STOPPED);
    });

    it('updates end time of import job', () => {
      const newEndTime = '2024-05-29T14:36:00.000Z';
      importJob.updateEndTime(newEndTime);
      expect(importJob.getEndTime()).to.equal(newEndTime);
    });

    it('updates duration of import job', () => {
      importJob.updateDuration(1000);
      expect(importJob.getDuration()).to.equal(1000);
    });

    it('updates url count of import job', () => {
      importJob.updateUrlCount(10);
      expect(importJob.getUrlCount()).to.equal(10);
    });

    it('updates success count of import job', () => {
      importJob.updateSuccessCount(10);
      expect(importJob.getSuccessCount()).to.equal(10);
    });

    it('set invalid success count of import job', () => {
      expect(() => importJob.updateSuccessCount('10')).to.throw('Invalid success count during update: 10');
      expect(() => importJob.updateSuccessCount(-1)).to.throw('Invalid success count during update: -1');
    });

    it('updates failed count of import job', () => {
      importJob.updateFailedCount(5);
      expect(importJob.getFailedCount()).to.equal(5);
    });

    it('set invalid failed count of import job', () => {
      expect(() => importJob.updateFailedCount('1')).to.throw('Invalid failed count during update: 1');
      expect(() => importJob.updateFailedCount(-1)).to.throw('Invalid failed count during update: -1');
    });

    it('updates redirect count of import job', () => {
      importJob.updateRedirectCount(1);
      expect(importJob.getRedirectCount()).to.equal(1);
    });

    it('set invalid redirect count of import job', () => {
      expect(() => importJob.updateRedirectCount('1')).to.throw('Invalid redirect count during update: 1');
      expect(() => importJob.updateRedirectCount(-1)).to.throw('Invalid redirect count during update: -1');
    });

    it('update hasCustomHeaders of import job', () => {
      importJob.updateHasCustomHeaders(true);
      expect(importJob.hasCustomHeaders()).to.equal(true);

      importJob.updateHasCustomHeaders(false);
      expect(importJob.hasCustomHeaders()).to.equal(false);

      expect(() => importJob.updateHasCustomHeaders(undefined)).to.throw('Invalid hasCustomHeaders value: undefined');
    });

    it('update hasCustomImportJs of import job', () => {
      importJob.updateHasCustomImportJs(true);
      expect(importJob.hasCustomImportJs()).to.equal(true);

      importJob.updateHasCustomImportJs(false);
      expect(importJob.hasCustomImportJs()).to.equal(false);

      expect(() => importJob.updateHasCustomImportJs(undefined)).to.throw('Invalid hasCustomImportJs value: undefined');
    });

    it('updates import queue id of import job', () => {
      importJob.updateImportQueueId('123');
      expect(importJob.getImportQueueId()).to.equal('123');
    });

    it('throws an error if status is invalid during an update', () => {
      expect(() => importJob.updateStatus('invalid')).to.throw('Invalid Import Job status during update: invalid');
    });

    it('throws an error if end time is not a valid date during an update', () => {
      expect(() => importJob.updateEndTime('invalid-date')).to.throw('Invalid end time during update: invalid-date');
    });

    it('throws an error if duration is not a valid number during an update', () => {
      expect(() => importJob.updateDuration('invalid-duration')).to.throw('Invalid duration during update: invalid-duration');
    });

    it('throws an error if url count is not a valid number during an update', () => {
      expect(() => importJob.updateUrlCount('invalid-count')).to.throw('Invalid url count during update: invalid-count');
    });

    it('throws an error if import queue id is not a valid string during an update', () => {
      expect(() => importJob.updateImportQueueId(123)).to.throw('Invalid import queue id during update: 123');
    });

    it('retrieves the baseURL of the import job', () => {
      expect(importJob.getBaseURL()).to.equal('https://www.test.com');
    });

    it('retrieves the options of the import job', () => {
      expect(importJob.getOptions()).to.deep.equal({
        [ImportOptions.ENABLE_JAVASCRIPT]: true,
      });
    });

    it('retrieves the apiKey of the import job', () => {
      expect(importJob.getHashedApiKey()).to.equal('4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4');
    });

    it('retrieves the startTime of the import job', () => {
      expect(importJob.getStartTime()).to.equal('2024-05-29T14:26:00.000Z');
    });
  });
});
