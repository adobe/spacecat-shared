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

const validImportJob = {
  id: '123',
  apiKey: 'test-api-key',
  baseURL: 'https://www.test.com',
  status: 'RUNNING',
  startTime: '2024-05-29T14:26:00.000Z',
  options: {
    enableJavascript: true,
    enableCss: true,
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
      expect(() => createImportJob({ ...validImportJob, apiKey: 123 })).to.throw('Invalid API key: 123');
    });

    it('creates an import job object with a startTime', () => {
      const importJob = createImportJob({ ...validImportJob, startTime: '' });
      expect(importJob.getStartTime()).is.not.empty;
    });
  });

  describe('Import Job Functionality Tests', () => {
    let importJob;
    beforeEach(() => {
      importJob = createImportJob({ ...validImportJob });
    });

    it('updates status of import job', () => {
      importJob.updateStatus('COMPLETE');
      expect(importJob.getStatus()).to.equal('COMPLETE');
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

    it('updates failed count of import job', () => {
      importJob.updateFailedCount(5);
      expect(importJob.getFailedCount()).to.equal(5);
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

    it('throws an error if success count is not a valid number during an update', () => {
      expect(() => importJob.updateSuccessCount('invalid-count')).to.throw('Invalid success count during update: invalid-count');
    });

    it('throws an error if failed count is not a valid number during an update', () => {
      expect(() => importJob.updateFailedCount('invalid-count')).to.throw('Invalid failed count during update: invalid-count');
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
        enableJavascript: true,
        enableCss: true,
      });
    });

    it('retrieves the apiKey of the import job', () => {
      expect(importJob.getApiKey()).to.equal('test-api-key');
    });

    it('retrieves the startTime of the import job', () => {
      expect(importJob.getStartTime()).to.equal('2024-05-29T14:26:00.000Z');
    });
  });
});
