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
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';
import DrsClient from '../src/index.js';

use(chaiAsPromised);
use(sinonChai);

const DRS_API_URL = 'https://drs.example.com/api/v1';
const DRS_API_KEY = 'test-api-key';

describe('DrsClient', () => {
  let log;

  beforeEach(() => {
    log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  describe('createFrom', () => {
    it('creates a client from context', () => {
      const context = {
        env: { DRS_API_URL, DRS_API_KEY },
        log,
      };
      const client = DrsClient.createFrom(context);
      expect(client).to.be.instanceOf(DrsClient);
      expect(client.isConfigured()).to.be.true;
    });

    it('returns cached client from context', () => {
      const cachedClient = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const context = {
        env: { DRS_API_URL, DRS_API_KEY },
        log,
        drsClient: cachedClient,
      };
      const client = DrsClient.createFrom(context);
      expect(client).to.equal(cachedClient);
    });

    it('uses console as default logger', () => {
      const context = {
        env: { DRS_API_URL, DRS_API_KEY },
      };
      const client = DrsClient.createFrom(context);
      expect(client.isConfigured()).to.be.true;
    });
  });

  describe('isConfigured', () => {
    it('returns false when apiBaseUrl is missing', () => {
      const client = new DrsClient({ apiBaseUrl: '', apiKey: DRS_API_KEY }, log);
      expect(client.isConfigured()).to.be.false;
    });

    it('returns false when apiKey is missing', () => {
      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: '' }, log);
      expect(client.isConfigured()).to.be.false;
    });

    it('returns true when both are set', () => {
      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      expect(client.isConfigured()).to.be.true;
    });
  });

  describe('submitJob', () => {
    it('submits a job successfully', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', { provider_id: 'test', parameters: {} })
        .reply(200, { job_id: 'job-123' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.submitJob({ provider_id: 'test', parameters: {} });

      expect(result.job_id).to.equal('job-123');
      expect(log.info).to.have.been.calledTwice;
      scope.done();
    });

    it('throws when not configured', async () => {
      const client = new DrsClient({ apiBaseUrl: '', apiKey: '' }, log);
      await expect(client.submitJob({ provider_id: 'test' }))
        .to.be.rejectedWith('DRS client is not configured');
    });

    it('throws on HTTP error', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs')
        .reply(400, 'Bad request');

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      await expect(client.submitJob({ provider_id: 'test' }))
        .to.be.rejectedWith('DRS POST /jobs failed: 400');
      scope.done();
    });
  });

  describe('submitPromptGenerationJob', () => {
    it('submits a prompt generation job with correct payload', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.provider_id).to.equal('prompt_generation_base_url');
          expect(body.source).to.equal('onboarding');
          expect(body.parameters.base_url).to.equal('https://example.com');
          expect(body.parameters.brand).to.equal('Example');
          expect(body.parameters.audience).to.equal('consumers');
          expect(body.parameters.region).to.equal('US');
          expect(body.parameters.num_prompts).to.equal(50);
          expect(body.parameters.metadata.site_id).to.equal('site-1');
          expect(body.parameters.metadata.imsOrgId).to.equal('org-1');
          return true;
        })
        .reply(200, { job_id: 'prompt-job-1' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.submitPromptGenerationJob({
        baseUrl: 'https://example.com',
        brandName: 'Example',
        audience: 'consumers',
        siteId: 'site-1',
        imsOrgId: 'org-1',
      });

      expect(result.job_id).to.equal('prompt-job-1');
      scope.done();
    });

    it('allows custom source, region, and numPrompts', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.source).to.equal('config-change');
          expect(body.parameters.region).to.equal('DE');
          expect(body.parameters.num_prompts).to.equal(100);
          return true;
        })
        .reply(200, { job_id: 'prompt-job-2' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      await client.submitPromptGenerationJob({
        baseUrl: 'https://example.de',
        brandName: 'Example DE',
        audience: 'german consumers',
        region: 'DE',
        numPrompts: 100,
        source: 'config-change',
        siteId: 'site-2',
        imsOrgId: 'org-2',
      });

      scope.done();
    });
  });

  describe('triggerBrandDetection', () => {
    it('triggers brand detection for a site', async () => {
      const scope = nock(DRS_API_URL)
        .post('/sites/site-1/brand-detection', {})
        .reply(200, { status: 'triggered' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.triggerBrandDetection('site-1');

      expect(result.status).to.equal('triggered');
      expect(log.info).to.have.been.called;
      scope.done();
    });

    it('passes options like batchId', async () => {
      const scope = nock(DRS_API_URL)
        .post('/sites/site-1/brand-detection', { batchId: 'batch-abc', priority: 'HIGH' })
        .reply(200, { status: 'triggered' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      await client.triggerBrandDetection('site-1', { batchId: 'batch-abc', priority: 'HIGH' });

      scope.done();
    });
  });

  describe('getJob', () => {
    it('gets job details', async () => {
      const scope = nock(DRS_API_URL)
        .get('/jobs/job-123')
        .reply(200, { job_id: 'job-123', status: 'COMPLETED' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.getJob('job-123');

      expect(result.job_id).to.equal('job-123');
      expect(result.status).to.equal('COMPLETED');
      scope.done();
    });
  });

  describe('trailing slash handling', () => {
    it('strips trailing slash from apiBaseUrl', async () => {
      const scope = nock(DRS_API_URL)
        .get('/jobs/job-1')
        .reply(200, { job_id: 'job-1' });

      const client = new DrsClient({ apiBaseUrl: `${DRS_API_URL}/`, apiKey: DRS_API_KEY }, log);
      await client.getJob('job-1');

      scope.done();
    });
  });

  describe('non-json response', () => {
    it('returns null for non-json responses', async () => {
      const scope = nock(DRS_API_URL)
        .post('/sites/site-1/brand-detection')
        .reply(204, '', { 'content-type': 'text/plain' });

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.triggerBrandDetection('site-1');

      expect(result).to.be.null;
      scope.done();
    });

    it('returns null when content-type header is absent', async () => {
      const scope = nock(DRS_API_URL)
        .post('/sites/site-2/brand-detection')
        .reply(204);

      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      const result = await client.triggerBrandDetection('site-2');

      expect(result).to.be.null;
      scope.done();
    });
  });
});
