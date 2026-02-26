/*
 * Copyright 2026 Adobe. All rights reserved.
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
import nock from 'nock';
import sinon from 'sinon';

import DrsClient, { VALID_DATASET_IDS, JOB_STATUSES } from '../src/index.js';

use(chaiAsPromised);

const API_BASE_URL = 'https://drs-api.example.com';
const API_KEY = 'test-api-key';

const validJobRequest = {
  datasetId: 'youtube_videos',
  urls: ['https://www.youtube.com/watch?v=abc123', 'https://www.youtube.com/watch?v=def456'],
  metadata: {
    imsOrgId: 'test-org-id',
    brand: 'test-brand',
    site: 'test-brand.com',
  },
};

const submitJobResponse = {
  job_id: 'job-123',
  status: 'QUEUED',
  provider_id: 'brightdata',
  priority: 'HIGH',
  submitted_at: 1700000000,
};

const jobStatusQueuedResponse = {
  job_id: 'job-123',
  provider_id: 'brightdata',
  priority: 'HIGH',
  status: 'QUEUED',
  parameters: {
    dataset_id: 'youtube_videos',
    urls: ['https://www.youtube.com/watch?v=abc123', 'https://www.youtube.com/watch?v=def456'],
  },
  submitted_at: 1700000000,
  ims_org_id: 'test-org-id',
  brand: 'test-brand',
  site: 'test-brand.com',
  started_at: 0,
  retry_count: 0,
  external_job_id: '',
  ttl: 86400,
  started_by: 'system',
  trace_id: 'trace-abc',
};

const jobStatusRunningResponse = {
  ...jobStatusQueuedResponse,
  status: 'RUNNING',
  started_at: 1700000010,
  external_job_id: 'ext-job-456',
};

const jobStatusCompletedResponse = {
  ...jobStatusRunningResponse,
  status: 'COMPLETED',
  result: {
    success_urls: 1,
    total_urls: 1,
    error_urls: 0,
    missing_urls: 0,
    total_records: 5,
    url_results: {
      'https://www.youtube.com/watch?v=abc123': {
        s3_path: 's3://bucket/path/to/result.json',
        url_hash: 'hash123',
        record_count: 5,
        success_count: 5,
        error_count: 0,
        has_errors: false,
      },
    },
    s3_paths: ['s3://bucket/path/to/result.json'],
  },
  result_url: 'https://s3.amazonaws.com/presigned-url',
  result_url_expires_in: 3600,
};

const jobStatusFailedResponse = {
  ...jobStatusRunningResponse,
  status: 'FAILED',
};

const lookupUrlsResponse = {
  results: [
    { url: 'https://www.youtube.com/watch?v=abc123', s3_path: 's3://bucket/path' },
  ],
};

describe('DrsClient', () => {
  let client;
  let log;

  beforeEach(() => {
    log = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
    client = new DrsClient({ apiBaseUrl: API_BASE_URL, apiKey: API_KEY }, log);
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws error when API base URL is missing', () => {
      expect(() => new DrsClient({ apiKey: API_KEY })).to.throw('Invalid DRS API Base URL: undefined');
    });

    it('throws error when API base URL is invalid', () => {
      expect(() => new DrsClient({ apiBaseUrl: 'not-a-url', apiKey: API_KEY })).to.throw('Invalid DRS API Base URL: not-a-url');
    });

    it('throws error when API key is missing', () => {
      expect(() => new DrsClient({ apiBaseUrl: API_BASE_URL })).to.throw('Invalid DRS API Key: undefined');
    });

    it('throws error when API key is empty', () => {
      expect(() => new DrsClient({ apiBaseUrl: API_BASE_URL, apiKey: '' })).to.throw('Invalid DRS API Key: ');
    });

    it('creates client with valid config', () => {
      const c = new DrsClient({ apiBaseUrl: API_BASE_URL, apiKey: API_KEY });
      expect(c).to.be.instanceOf(DrsClient);
    });
  });

  describe('createFrom', () => {
    it('creates an instance of DrsClient from context', () => {
      const context = {
        env: {
          DRS_API_URL: API_BASE_URL,
          DRS_API_KEY: API_KEY,
        },
        log,
      };

      const c = DrsClient.createFrom(context);
      expect(c).to.be.instanceOf(DrsClient);
    });

    it('returns cached instance from context', () => {
      const context = {
        env: {
          DRS_API_URL: API_BASE_URL,
          DRS_API_KEY: API_KEY,
        },
        log,
      };

      const first = DrsClient.createFrom(context);
      const second = DrsClient.createFrom(context);
      expect(first).to.equal(second);
    });

    it('uses console as default logger', () => {
      const context = {
        env: {
          DRS_API_URL: API_BASE_URL,
          DRS_API_KEY: API_KEY,
        },
      };

      const c = DrsClient.createFrom(context);
      expect(c).to.be.instanceOf(DrsClient);
    });

    it('throws when DRS_API_URL is missing from env', () => {
      const context = {
        env: { DRS_API_KEY: API_KEY },
        log,
      };

      expect(() => DrsClient.createFrom(context)).to.throw('Invalid DRS API Base URL: undefined');
    });

    it('throws when DRS_API_KEY is missing from env', () => {
      const context = {
        env: { DRS_API_URL: API_BASE_URL },
        log,
      };

      expect(() => DrsClient.createFrom(context)).to.throw('Invalid DRS API Key: undefined');
    });
  });

  describe('exported constants', () => {
    it('exports VALID_DATASET_IDS', () => {
      expect(VALID_DATASET_IDS).to.deep.equal([
        'youtube_videos',
        'youtube_comments',
        'reddit_posts',
        'reddit_comments',
        'wikipedia',
      ]);
    });

    it('exports JOB_STATUSES', () => {
      expect(JOB_STATUSES).to.deep.equal({
        QUEUED: 'QUEUED',
        RUNNING: 'RUNNING',
        COMPLETED: 'COMPLETED',
        FAILED: 'FAILED',
      });
    });
  });

  describe('submitJob', () => {
    it('submits a job successfully', async () => {
      nock(API_BASE_URL)
        .post('/jobs', {
          provider_id: 'brightdata',
          priority: 'HIGH',
          parameters: {
            dataset_id: 'youtube_videos',
            urls: ['https://www.youtube.com/watch?v=abc123', 'https://www.youtube.com/watch?v=def456'],
          },
          metadata: {
            imsOrgId: 'test-org-id',
            brand: 'test-brand',
            site: 'test-brand.com',
          },
        })
        .reply(200, submitJobResponse);

      const result = await client.submitJob(validJobRequest);
      expect(result).to.deep.equal(submitJobResponse);
    });

    it('throws error for invalid dataset ID', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        datasetId: 'invalid_dataset',
      })).to.be.rejectedWith(`Invalid dataset ID: invalid_dataset. Must be one of: ${VALID_DATASET_IDS.join(', ')}`);
    });

    it('throws error for missing dataset ID', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        datasetId: '',
      })).to.be.rejectedWith('Invalid dataset ID: . Must be one of:');
    });

    it('throws error when urls is not an array', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        urls: 'not-an-array',
      })).to.be.rejectedWith('URLs must be a non-empty array');
    });

    it('throws error when urls is an empty array', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        urls: [],
      })).to.be.rejectedWith('URLs must be a non-empty array');
    });

    it('throws error when urls is null', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        urls: null,
      })).to.be.rejectedWith('URLs must be a non-empty array');
    });

    it('throws error when urls is undefined', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        urls: undefined,
      })).to.be.rejectedWith('URLs must be a non-empty array');
    });

    it('throws error when metadata is missing', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: undefined,
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.imsOrgId is missing', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { brand: 'test', site: 'test.com' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.brand is missing', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { imsOrgId: 'org-id', site: 'test.com' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.site is missing', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { imsOrgId: 'org-id', brand: 'test' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.imsOrgId is empty string', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { imsOrgId: '', brand: 'test', site: 'test.com' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.brand is empty string', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { imsOrgId: 'org-id', brand: '', site: 'test.com' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when metadata.site is empty string', async () => {
      await expect(client.submitJob({
        ...validJobRequest,
        metadata: { imsOrgId: 'org-id', brand: 'test', site: '' },
      })).to.be.rejectedWith('Metadata must include imsOrgId, brand, and site');
    });

    it('throws error when API returns an error', async () => {
      nock(API_BASE_URL)
        .post('/jobs')
        .reply(500, { message: 'Internal Server Error' });

      await expect(client.submitJob(validJobRequest))
        .to.be.rejectedWith('DRS API request to /jobs failed with status: 500 - Internal Server Error');
    });

    it('throws error when API returns error with unparseable body', async () => {
      nock(API_BASE_URL)
        .post('/jobs')
        .reply(500, 'not-json');

      await expect(client.submitJob(validJobRequest))
        .to.be.rejectedWith('DRS API request to /jobs failed with status: 500');
    });

    it('throws error when API response cannot be parsed as JSON', async () => {
      nock(API_BASE_URL)
        .post('/jobs')
        .reply(200, 'not-json', { 'Content-Type': 'text/plain' });

      await expect(client.submitJob(validJobRequest))
        .to.be.rejectedWith('Error parsing DRS API response from /jobs:');
    });
  });

  describe('getJobStatus', () => {
    it('returns job status for a queued job', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusQueuedResponse);

      const result = await client.getJobStatus('job-123');
      expect(result).to.deep.equal(jobStatusQueuedResponse);
    });

    it('returns job status for a running job', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusRunningResponse);

      const result = await client.getJobStatus('job-123');
      expect(result).to.deep.equal(jobStatusRunningResponse);
    });

    it('returns job status with result for a completed job', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusCompletedResponse);

      const result = await client.getJobStatus('job-123');
      expect(result).to.deep.equal(jobStatusCompletedResponse);
      expect(result.result).to.exist;
      expect(result.result_url).to.equal('https://s3.amazonaws.com/presigned-url');
    });

    it('returns job status for a failed job', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusFailedResponse);

      const result = await client.getJobStatus('job-123');
      expect(result.status).to.equal('FAILED');
    });

    it('throws error when job ID is missing', async () => {
      await expect(client.getJobStatus('')).to.be.rejectedWith('Job ID is required');
    });

    it('throws error when job ID is undefined', async () => {
      await expect(client.getJobStatus()).to.be.rejectedWith('Job ID is required');
    });

    it('throws error when API returns 404', async () => {
      nock(API_BASE_URL)
        .get('/jobs/nonexistent')
        .query({ include_result_url: 'true' })
        .reply(404, { message: 'Job not found' });

      await expect(client.getJobStatus('nonexistent'))
        .to.be.rejectedWith('DRS API request to /jobs/nonexistent?include_result_url=true failed with status: 404 - Job not found');
    });
  });

  describe('pollJobStatus', () => {
    it('resolves immediately when job is already completed', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusCompletedResponse);

      const result = await client.pollJobStatus('job-123', { pollIntervalMs: 10, maxTimeoutMs: 100 });
      expect(result).to.deep.equal(jobStatusCompletedResponse);
    });

    it('resolves when job completes after multiple polls', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusQueuedResponse);

      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusRunningResponse);

      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusCompletedResponse);

      const result = await client.pollJobStatus('job-123', { pollIntervalMs: 10, maxTimeoutMs: 5000 });
      expect(result).to.deep.equal(jobStatusCompletedResponse);
      expect(log.info.callCount).to.equal(2);
    });

    it('resolves when job fails', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusRunningResponse);

      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusFailedResponse);

      const result = await client.pollJobStatus('job-123', { pollIntervalMs: 10, maxTimeoutMs: 5000 });
      expect(result.status).to.equal('FAILED');
    });

    it('throws error on timeout', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .times(10)
        .reply(200, jobStatusRunningResponse);

      await expect(client.pollJobStatus('job-123', { pollIntervalMs: 10, maxTimeoutMs: 25 }))
        .to.be.rejectedWith('Polling for job job-123 timed out after 25ms. Last status: RUNNING');
    });

    it('propagates API error during polling', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusRunningResponse);

      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(500, { message: 'Internal Server Error' });

      await expect(client.pollJobStatus('job-123', { pollIntervalMs: 10, maxTimeoutMs: 5000 }))
        .to.be.rejectedWith('DRS API request to /jobs/job-123?include_result_url=true failed with status: 500 - Internal Server Error');
    });

    it('throws error when job ID is missing', async () => {
      await expect(client.pollJobStatus('')).to.be.rejectedWith('Job ID is required');
    });

    it('uses default poll options when none provided', async () => {
      nock(API_BASE_URL)
        .get('/jobs/job-123')
        .query({ include_result_url: 'true' })
        .reply(200, jobStatusCompletedResponse);

      const result = await client.pollJobStatus('job-123');
      expect(result).to.deep.equal(jobStatusCompletedResponse);
    });
  });

  describe('lookupUrls', () => {
    it('sends lookup request successfully', async () => {
      const requestBody = {
        urls: ['https://www.youtube.com/watch?v=abc123'],
      };

      nock(API_BASE_URL)
        .post('/url-lookup', requestBody)
        .reply(200, lookupUrlsResponse);

      const result = await client.lookupUrls(requestBody);
      expect(result).to.deep.equal(lookupUrlsResponse);
    });

    it('throws error when API returns an error', async () => {
      nock(API_BASE_URL)
        .post('/url-lookup')
        .reply(400, { message: 'Bad Request' });

      await expect(client.lookupUrls({ urls: [] }))
        .to.be.rejectedWith('DRS API request to /url-lookup failed with status: 400 - Bad Request');
    });

    it('sends request without body when called with undefined', async () => {
      nock(API_BASE_URL)
        .post('/url-lookup')
        .reply(200, lookupUrlsResponse);

      const result = await client.lookupUrls(undefined);
      expect(result).to.deep.equal(lookupUrlsResponse);
    });
  });
});
