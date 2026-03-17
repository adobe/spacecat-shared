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
import DrsClient, { SCRAPE_DATASET_IDS, EXPERIMENT_PHASES } from '../src/index.js';

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

    it('caches newly created client on context', () => {
      const context = {
        env: { DRS_API_URL, DRS_API_KEY },
        log,
      };
      expect(context.drsClient).to.be.undefined;
      const client = DrsClient.createFrom(context);
      expect(context.drsClient).to.equal(client);

      // Second call returns the same cached instance
      const client2 = DrsClient.createFrom(context);
      expect(client2).to.equal(client);
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

  describe('SCRAPE_DATASET_IDS', () => {
    it('exports all expected dataset IDs', () => {
      expect(SCRAPE_DATASET_IDS).to.deep.equal({
        REDDIT_COMMENTS: 'reddit_comments',
        REDDIT_POSTS: 'reddit_posts',
        TOP_CITED: 'topCited',
        YOUTUBE_COMMENTS: 'youtube_comments',
        YOUTUBE_VIDEOS: 'youtube_videos',
        WIKIPEDIA: 'wikipedia',
      });
    });

    it('is frozen', () => {
      expect(Object.isFrozen(SCRAPE_DATASET_IDS)).to.be.true;
    });
  });

  describe('submitScrapeJob', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('submits a scrape job with defaults (priority HIGH)', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.provider_id).to.equal('brightdata');
          expect(body.priority).to.equal('HIGH');
          expect(body.parameters.dataset_id).to.equal(SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS);
          expect(body.parameters.site_id).to.equal('site-1');
          expect(body.parameters.urls).to.deep.equal(['https://youtube.com/watch?v=abc']);
          return true;
        })
        .reply(200, { job_id: 'scrape-1' });

      const result = await client.submitScrapeJob({
        datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS,
        siteId: 'site-1',
        urls: ['https://youtube.com/watch?v=abc'],
      });

      expect(result.job_id).to.equal('scrape-1');
      expect(log.info).to.have.been.calledWith(
        `Submitting DRS scrape job for dataset ${SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS}`,
        { datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS, siteId: 'site-1', urlCount: 1 },
      );
      scope.done();
    });

    it('accepts LOW priority', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => body.priority === 'LOW')
        .reply(200, { job_id: 'scrape-2' });

      const result = await client.submitScrapeJob({
        datasetId: SCRAPE_DATASET_IDS.REDDIT_POSTS,
        siteId: 'site-2',
        urls: ['https://reddit.com/r/test/comments/abc'],
        priority: 'LOW',
      });

      expect(result.job_id).to.equal('scrape-2');
      scope.done();
    });

    it('handles multiple URLs', async () => {
      const urls = [
        'https://youtube.com/watch?v=1',
        'https://youtube.com/watch?v=2',
        'https://youtube.com/watch?v=3',
      ];
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.parameters.urls).to.deep.equal(urls);
          return true;
        })
        .reply(200, { job_id: 'scrape-3' });

      await client.submitScrapeJob({ datasetId: SCRAPE_DATASET_IDS.YOUTUBE_COMMENTS, siteId: 'site-3', urls });
      scope.done();
    });

    it('accepts all valid dataset IDs', async () => {
      for (const value of Object.values(SCRAPE_DATASET_IDS)) {
        const scope = nock(DRS_API_URL)
          .post('/jobs', (body) => body.parameters.dataset_id === value)
          .reply(200, { job_id: `job-${value}` });

        // eslint-disable-next-line no-await-in-loop
        const result = await client.submitScrapeJob({
          datasetId: value, siteId: 'site-x', urls: ['https://example.com'],
        });

        expect(result.job_id).to.equal(`job-${value}`);
        scope.done();
      }
    });

    it('throws on invalid datasetId', async () => {
      await expect(client.submitScrapeJob({
        datasetId: 'invalid_dataset', siteId: 'site-1', urls: ['https://example.com'],
      })).to.be.rejectedWith('Invalid dataset_id "invalid_dataset". Must be one of:');
    });

    it('throws when urls is not a non-empty array', async () => {
      const params = { datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS, siteId: 'site-1' };
      await expect(client.submitScrapeJob({ ...params, urls: 'https://example.com' }))
        .to.be.rejectedWith('urls must be a non-empty array of strings');
      await expect(client.submitScrapeJob({ ...params, urls: [] }))
        .to.be.rejectedWith('urls must be a non-empty array of strings');
    });

    it('throws when siteId is missing or empty', async () => {
      const params = { datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS, urls: ['https://example.com'] };
      await expect(client.submitScrapeJob(params))
        .to.be.rejectedWith('siteId is required');
      await expect(client.submitScrapeJob({ ...params, siteId: '' }))
        .to.be.rejectedWith('siteId is required');
    });

    it('includes days_back for reddit_comments', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.parameters.days_back).to.equal(30);
          expect(body.parameters.dataset_id).to.equal(SCRAPE_DATASET_IDS.REDDIT_COMMENTS);
          return true;
        })
        .reply(200, { job_id: 'scrape-days' });

      const result = await client.submitScrapeJob({
        datasetId: SCRAPE_DATASET_IDS.REDDIT_COMMENTS,
        siteId: 'site-1',
        urls: ['https://reddit.com/r/test/comments/abc'],
        daysBack: 30,
      });

      expect(result.job_id).to.equal('scrape-days');
      scope.done();
    });

    it('omits days_back when not provided', async () => {
      const scope = nock(DRS_API_URL)
        .post('/jobs', (body) => {
          expect(body.parameters).to.not.have.property('days_back');
          return true;
        })
        .reply(200, { job_id: 'scrape-no-days' });

      await client.submitScrapeJob({
        datasetId: SCRAPE_DATASET_IDS.REDDIT_COMMENTS,
        siteId: 'site-1',
        urls: ['https://reddit.com/r/test/comments/abc'],
      });

      scope.done();
    });

    it('throws when daysBack is used with a non-reddit_comments dataset', async () => {
      await expect(client.submitScrapeJob({
        datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS,
        siteId: 'site-1',
        urls: ['https://youtube.com/watch?v=abc'],
        daysBack: 7,
      })).to.be.rejectedWith('daysBack is only supported for reddit_comments dataset');
    });
  });

  describe('lookupScrapeResults', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('looks up scrape results with correct payload', async () => {
      const urls = [
        'https://youtube.com/watch?v=abc',
        'https://youtube.com/watch?v=def',
        'https://youtube.com/watch?v=ghi',
      ];
      const responseBody = {
        results: [
          {
            url: urls[0], status: 'available', scraped_at: '2026-02-15T10:30:00Z', presigned_url: 'https://s3.amazonaws.com/results.ndjson?signed', expires_in: 3600,
          },
          {
            url: urls[1], status: 'scraping', job_id: 'job-abc', message: 'Scraping in progress, try again later',
          },
          {
            url: urls[2], status: 'not_found', message: 'No data found. Submit a scraping job via POST /jobs',
          },
        ],
        summary: {
          total: 3, available: 1, scraping: 1, not_found: 1,
        },
      };
      const scope = nock(DRS_API_URL)
        .post('/url-lookup', (body) => {
          expect(body.dataset_id).to.equal(SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS);
          expect(body.site_id).to.equal('site-1');
          expect(body.urls).to.deep.equal(urls);
          return true;
        })
        .reply(200, responseBody);

      const result = await client.lookupScrapeResults({
        datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS,
        siteId: 'site-1',
        urls,
      });

      expect(result).to.deep.equal(responseBody);
      expect(result.results).to.have.lengthOf(3);
      expect(result.results[0].status).to.equal('available');
      expect(result.results[0].presigned_url).to.be.a('string');
      expect(result.results[1].status).to.equal('scraping');
      expect(result.results[1].job_id).to.equal('job-abc');
      expect(result.results[2].status).to.equal('not_found');
      expect(result.summary).to.deep.equal({
        total: 3, available: 1, scraping: 1, not_found: 1,
      });
      expect(log.info).to.have.been.calledWith(
        `Looking up scrape results for dataset ${SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS}`,
        { datasetId: SCRAPE_DATASET_IDS.YOUTUBE_VIDEOS, siteId: 'site-1', urlCount: 3 },
      );
      scope.done();
    });

    it('throws on invalid datasetId', async () => {
      await expect(client.lookupScrapeResults({
        datasetId: 'bad', siteId: 'site-1', urls: ['https://example.com'],
      })).to.be.rejectedWith('Invalid dataset_id "bad". Must be one of:');
    });

    it('throws when urls is not a non-empty array', async () => {
      const params = { datasetId: SCRAPE_DATASET_IDS.WIKIPEDIA, siteId: 'site-1' };
      await expect(client.lookupScrapeResults({ ...params, urls: 'https://example.com' }))
        .to.be.rejectedWith('urls must be a non-empty array of strings');
      await expect(client.lookupScrapeResults({ ...params, urls: [] }))
        .to.be.rejectedWith('urls must be a non-empty array of strings');
    });

    it('throws when siteId is missing or empty', async () => {
      const params = { datasetId: SCRAPE_DATASET_IDS.REDDIT_COMMENTS, urls: ['https://example.com'] };
      await expect(client.lookupScrapeResults(params))
        .to.be.rejectedWith('siteId is required');
      await expect(client.lookupScrapeResults({ ...params, siteId: '' }))
        .to.be.rejectedWith('siteId is required');
    });
  });

  describe('EXPERIMENT_PHASES', () => {
    it('exports all expected phase values', () => {
      expect(EXPERIMENT_PHASES).to.deep.equal({
        PRE: 'pre',
        POST: 'post',
      });
    });

    it('is frozen', () => {
      expect(Object.isFrozen(EXPERIMENT_PHASES)).to.be.true;
    });
  });

  describe('submitExperiment', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('submits a pre-phase experiment with required params', async () => {
      const responseBody = {
        schedule_id: 'schedule-123',
        experiment_id: 'exp-site1-001',
        experiment_phase: 'pre',
        experiment_batch_id: 'exp-batch-001',
        parent_batch_id: 'bp-exp-batch-001',
        site_id: 'site-1',
        jobs_submitted: 6,
        jobs_failed: 0,
      };

      const scope = nock(DRS_API_URL)
        .post('/experiments', (body) => {
          expect(body.site_id).to.equal('site-1');
          expect(body.experiment_id).to.equal('exp-site1-001');
          expect(body.experiment_phase).to.equal('pre');
          expect(body.interval_minutes).to.equal(60);
          expect(body.duration_hours).to.equal(10);
          return true;
        })
        .reply(201, responseBody);

      const result = await client.submitExperiment({
        siteId: 'site-1',
        experimentId: 'exp-site1-001',
        experimentPhase: 'pre',
      });

      expect(result.experiment_id).to.equal('exp-site1-001');
      expect(result.experiment_batch_id).to.equal('exp-batch-001');
      expect(result.jobs_submitted).to.equal(6);
      expect(log.info).to.have.been.called;
      scope.done();
    });

    it('submits a post-phase experiment with all optional params', async () => {
      const scope = nock(DRS_API_URL)
        .post('/experiments', (body) => {
          expect(body.experiment_phase).to.equal('post');
          expect(body.experimentation_urls).to.deep.equal(['https://example.com/page1']);
          expect(body.platforms).to.deep.equal(['chatgpt_free', 'perplexity']);
          expect(body.interval_minutes).to.equal(30);
          expect(body.duration_hours).to.equal(24);
          expect(body.metadata).to.deep.equal({ triggered_by: 'spacecat' });
          return true;
        })
        .reply(201, { experiment_id: 'exp-2', experiment_batch_id: 'batch-2' });

      await client.submitExperiment({
        siteId: 'site-2',
        experimentId: 'exp-2',
        experimentPhase: 'post',
        experimentationUrls: ['https://example.com/page1'],
        platforms: ['chatgpt_free', 'perplexity'],
        intervalMinutes: 30,
        durationHours: 24,
        metadata: { triggered_by: 'spacecat' },
      });

      scope.done();
    });

    it('omits experimentation_urls when empty array', async () => {
      const scope = nock(DRS_API_URL)
        .post('/experiments', (body) => {
          expect(body).to.not.have.property('experimentation_urls');
          return true;
        })
        .reply(201, { experiment_id: 'exp-3', experiment_batch_id: 'batch-3' });

      await client.submitExperiment({
        siteId: 'site-3',
        experimentId: 'exp-3',
        experimentPhase: 'pre',
        experimentationUrls: [],
      });

      scope.done();
    });

    it('omits platforms when empty array', async () => {
      const scope = nock(DRS_API_URL)
        .post('/experiments', (body) => {
          expect(body).to.not.have.property('platforms');
          return true;
        })
        .reply(201, { experiment_id: 'exp-4', experiment_batch_id: 'batch-4' });

      await client.submitExperiment({
        siteId: 'site-4',
        experimentId: 'exp-4',
        experimentPhase: 'pre',
        platforms: [],
      });

      scope.done();
    });

    it('omits metadata when not provided', async () => {
      const scope = nock(DRS_API_URL)
        .post('/experiments', (body) => {
          expect(body).to.not.have.property('metadata');
          return true;
        })
        .reply(201, { experiment_id: 'exp-5', experiment_batch_id: 'batch-5' });

      await client.submitExperiment({
        siteId: 'site-5',
        experimentId: 'exp-5',
        experimentPhase: 'pre',
      });

      scope.done();
    });

    it('throws when siteId is missing', async () => {
      await expect(client.submitExperiment({
        experimentId: 'exp-1', experimentPhase: 'pre',
      })).to.be.rejectedWith('siteId is required');
    });

    it('throws when siteId is empty', async () => {
      await expect(client.submitExperiment({
        siteId: '', experimentId: 'exp-1', experimentPhase: 'pre',
      })).to.be.rejectedWith('siteId is required');
    });

    it('throws when experimentId is missing', async () => {
      await expect(client.submitExperiment({
        siteId: 'site-1', experimentPhase: 'pre',
      })).to.be.rejectedWith('experimentId is required');
    });

    it('throws when experimentId is empty', async () => {
      await expect(client.submitExperiment({
        siteId: 'site-1', experimentId: '', experimentPhase: 'pre',
      })).to.be.rejectedWith('experimentId is required');
    });

    it('throws when experimentPhase is invalid', async () => {
      await expect(client.submitExperiment({
        siteId: 'site-1', experimentId: 'exp-1', experimentPhase: 'during',
      })).to.be.rejectedWith('experimentPhase must be one of: pre, post');
    });

    it('throws on HTTP error', async () => {
      const scope = nock(DRS_API_URL)
        .post('/experiments')
        .reply(400, 'Bad request');

      await expect(client.submitExperiment({
        siteId: 'site-1', experimentId: 'exp-1', experimentPhase: 'pre',
      })).to.be.rejectedWith('DRS POST /experiments failed: 400');

      scope.done();
    });
  });

  describe('getExperimentStatus', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('gets experiment status without phase filter', async () => {
      const responseBody = {
        experiment_id: 'exp-1',
        status: 'RUNNING',
        phases: {
          pre: { phase: 'pre', status: 'COMPLETED', progress_percent: 100 },
          post: { phase: 'post', status: 'RUNNING', progress_percent: 33.3 },
        },
        summary: {
          total_jobs: 12, pre_jobs: 6, post_jobs: 6, phases_started: 2, phases_completed: 1,
        },
      };

      const scope = nock(DRS_API_URL)
        .get('/experiments/exp-1')
        .reply(200, responseBody);

      const result = await client.getExperimentStatus('exp-1');

      expect(result.experiment_id).to.equal('exp-1');
      expect(result.status).to.equal('RUNNING');
      expect(result.phases.pre.status).to.equal('COMPLETED');
      expect(result.phases.post.status).to.equal('RUNNING');
      expect(log.info).to.have.been.called;
      scope.done();
    });

    it('gets experiment status with phase filter', async () => {
      const scope = nock(DRS_API_URL)
        .get('/experiments/exp-2?phase=pre')
        .reply(200, { experiment_id: 'exp-2', status: 'COMPLETED' });

      const result = await client.getExperimentStatus('exp-2', 'pre');

      expect(result.experiment_id).to.equal('exp-2');
      scope.done();
    });

    it('gets experiment status with post phase filter', async () => {
      const scope = nock(DRS_API_URL)
        .get('/experiments/exp-3?phase=post')
        .reply(200, { experiment_id: 'exp-3', status: 'RUNNING' });

      const result = await client.getExperimentStatus('exp-3', 'post');

      expect(result.status).to.equal('RUNNING');
      scope.done();
    });

    it('throws when experimentId is missing', async () => {
      await expect(client.getExperimentStatus())
        .to.be.rejectedWith('experimentId is required');
    });

    it('throws when experimentId is empty', async () => {
      await expect(client.getExperimentStatus(''))
        .to.be.rejectedWith('experimentId is required');
    });

    it('throws when phase is invalid', async () => {
      await expect(client.getExperimentStatus('exp-1', 'during'))
        .to.be.rejectedWith('phase must be one of: pre, post');
    });

    it('throws on HTTP error', async () => {
      const scope = nock(DRS_API_URL)
        .get('/experiments/exp-404')
        .reply(404, 'Not found');

      await expect(client.getExperimentStatus('exp-404'))
        .to.be.rejectedWith('DRS GET /experiments/exp-404 failed: 404');

      scope.done();
    });
  });

  describe('createExperimentSchedule', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('creates a schedule with experiment cadence and immediate trigger', async () => {
      const scope = nock(DRS_API_URL)
        .post('/schedules', (body) => {
          expect(body.site_id).to.equal('site-1');
          expect(body.frequency).to.equal('cron');
          expect(body.cron_expression).to.equal('0 * * * *');
          expect(body.trigger_immediately).to.equal(true);
          expect(body.job_config.cadence).to.equal('experiment');
          expect(body.job_config.provider_ids).to.deep.equal(['brightdata']);
          expect(body.job_config.provider_parameters.brightdata.dataset_id).to.include('chatgpt_free');
          expect(body.job_config.experimentation_urls).to.deep.equal(['https://example.com/page-1']);
          expect(body.job_config.metadata.experiment_id).to.equal('exp-1');
          expect(body.job_config.metadata.experiment_phase).to.equal('pre');
          expect(body.job_config.metadata.triggered_by).to.equal('spacecat-edge-deploy');
          return true;
        })
        .reply(201, { schedule: { schedule_id: 'sched-1' } });

      const result = await client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'pre',
        experimentationUrls: ['https://example.com/page-1'],
        metadata: { triggered_by: 'spacecat-edge-deploy' },
      });

      expect(result.schedule.schedule_id).to.equal('sched-1');
      scope.done();
    });

    it('uses explicitly provided platforms', async () => {
      const scope = nock(DRS_API_URL)
        .post('/schedules', (body) => {
          expect(body.cron_expression).to.equal('0 0 * * *');
          expect(body.trigger_immediately).to.equal(false);
          expect(body.job_config.provider_parameters.brightdata.dataset_id).to.equal('gemini,perplexity');
          return true;
        })
        .reply(201, { schedule: { schedule_id: 'sched-2' } });

      await client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-2',
        experimentPhase: 'post',
        platforms: ['gemini', 'perplexity'],
      });

      scope.done();
    });

    it('allows overriding post triggerImmediately', async () => {
      const scope = nock(DRS_API_URL)
        .post('/schedules', (body) => {
          expect(body.cron_expression).to.equal('0 0 * * *');
          expect(body.trigger_immediately).to.equal(true);
          return true;
        })
        .reply(201, { schedule: { schedule_id: 'sched-3' } });

      await client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-3',
        experimentPhase: 'post',
        triggerImmediately: true,
      });

      scope.done();
    });

    it('supports top-level schedule_id response shape', async () => {
      const scope = nock(DRS_API_URL)
        .post('/schedules')
        .reply(201, { schedule_id: 'sched-flat-1' });

      const result = await client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-flat',
        experimentPhase: 'pre',
      });

      expect(result.schedule_id).to.equal('sched-flat-1');
      scope.done();
    });

    it('throws when siteId is missing', async () => {
      await expect(client.createExperimentSchedule({
        experimentId: 'exp-1',
        experimentPhase: 'pre',
      })).to.be.rejectedWith('siteId is required');
    });

    it('throws when experimentId is missing', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentPhase: 'pre',
      })).to.be.rejectedWith('experimentId is required');
    });

    it('throws when experimentPhase is invalid', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'during',
      })).to.be.rejectedWith('experimentPhase must be one of: pre, post');
    });
  });

  describe('getScheduleStatus', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('fetches schedule status with jobs summary', async () => {
      const scope = nock(DRS_API_URL)
        .get('/schedules/site-1/sched-1?include_jobs=true')
        .reply(200, {
          schedule: { schedule_id: 'sched-1', site_id: 'site-1' },
          jobs_summary: { total: 2, in_progress: 0, is_complete: true },
        });

      const result = await client.getScheduleStatus('site-1', 'sched-1');
      expect(result.schedule.schedule_id).to.equal('sched-1');
      expect(result.jobs_summary.is_complete).to.equal(true);
      scope.done();
    });

    it('throws when siteId is missing', async () => {
      await expect(client.getScheduleStatus('', 'sched-1'))
        .to.be.rejectedWith('siteId is required');
    });

    it('throws when scheduleId is missing', async () => {
      await expect(client.getScheduleStatus('site-1', ''))
        .to.be.rejectedWith('scheduleId is required');
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
