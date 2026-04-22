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
          expect(body.expires_at).to.equal('2099-01-01T00:00:00.000Z');
          expect(body.trigger_immediately).to.equal(true);
          expect(body.job_config.cadence).to.equal('experiment');
          expect(body.job_config.provider_ids).to.deep.equal(['brightdata', 'openai_web_search']);
          expect(body.job_config.provider_parameters.brightdata.dataset_id).to.include('chatgpt_free');
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
        cronExpression: '0 * * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['chatgpt_free', 'chatgpt_paid'],
        providerIds: ['brightdata', 'openai_web_search'],
        triggerImmediately: true,
        metadata: { triggered_by: 'spacecat-edge-deploy' },
      });

      expect(result.schedule.schedule_id).to.equal('sched-1');
      scope.done();
    });

    it('uses explicitly provided providerIds', async () => {
      const scope = nock(DRS_API_URL)
        .post('/schedules', (body) => {
          expect(body.job_config.provider_ids).to.deep.equal(['brightdata']);
          return true;
        })
        .reply(201, { schedule: { schedule_id: 'sched-custom' } });

      await client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-custom',
        experimentPhase: 'pre',
        cronExpression: '0 * * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['chatgpt_free'],
        providerIds: ['brightdata'],
      });

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
        cronExpression: '0 0 * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['gemini', 'perplexity'],
        providerIds: ['brightdata'],
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
        cronExpression: '0 0 * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['chatgpt_free'],
        providerIds: ['brightdata'],
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
        cronExpression: '0 * * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['chatgpt_free'],
        providerIds: ['brightdata'],
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

    it('throws when cronExpression is missing', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'pre',
      })).to.be.rejectedWith('cronExpression is required');
    });

    it('throws when expiresAt is missing', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'pre',
        cronExpression: '0 * * * *',
      })).to.be.rejectedWith('expiresAt is required');
    });

    it('throws when platforms is missing', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'pre',
        cronExpression: '0 * * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
      })).to.be.rejectedWith('platforms must be a non-empty array');
    });

    it('throws when providerIds is missing', async () => {
      await expect(client.createExperimentSchedule({
        siteId: 'site-1',
        experimentId: 'exp-1',
        experimentPhase: 'pre',
        cronExpression: '0 * * * *',
        expiresAt: '2099-01-01T00:00:00.000Z',
        platforms: ['chatgpt_free'],
      })).to.be.rejectedWith('providerIds must be a non-empty array');
    });
  });

  describe('getScheduleStatus', () => {
    let client;

    beforeEach(() => {
      client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
    });

    it('fetches schedule status with jobs summary', async () => {
      const scope = nock(DRS_API_URL)
        .get('/schedules/site-1/sched-1')
        .reply(200, {
          schedule: { schedule_id: 'sched-1', site_id: 'site-1' },
          jobs_summary: { total: 2, in_progress: 0, is_complete: true },
        });

      const result = await client.getScheduleStatus('site-1', 'sched-1');
      expect(result.schedule.schedule_id).to.equal('sched-1');
      expect(result.jobs_summary.is_complete).to.equal(true);
      scope.done();
    });

    it('fetches schedule status with include_jobs flag', async () => {
      const scope = nock(DRS_API_URL)
        .get('/schedules/site-1/sched-1?include_jobs=true')
        .reply(200, { schedule: { schedule_id: 'sched-1' }, jobs: [] });

      const result = await client.getScheduleStatus('site-1', 'sched-1', { includeJobs: true });
      expect(result.schedule.schedule_id).to.equal('sched-1');
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

  describe('isS3Configured', () => {
    it('returns false when s3Bucket is missing', () => {
      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY, snsTopicArn: 'arn:aws:sns:us-east-1:123:topic',
      }, log);
      expect(client.isS3Configured()).to.be.false;
    });

    it('returns false when snsTopicArn is missing', () => {
      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY, s3Bucket: 'drs-bucket',
      }, log);
      expect(client.isS3Configured()).to.be.false;
    });

    it('returns true when both s3Bucket and snsTopicArn are set', () => {
      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY, s3Bucket: 'drs-bucket', snsTopicArn: 'arn:aws:sns:us-east-1:123:topic',
      }, log);
      expect(client.isS3Configured()).to.be.true;
    });
  });

  describe('uploadExcelToDrs', () => {
    const S3_BUCKET = 'drs-bucket';
    const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:drs-topic';
    let s3ClientStub;
    let s3Client;

    beforeEach(() => {
      s3ClientStub = sinon.stub();
      s3Client = { send: s3ClientStub };
    });

    it('uploads Excel and returns the S3 URI', async () => {
      s3ClientStub.resolves({});

      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL,
        apiKey: DRS_API_KEY,
        s3Bucket: S3_BUCKET,
        snsTopicArn: SNS_TOPIC_ARN,
        s3Client,
      }, log);

      const excelBuffer = Buffer.from('fake-excel-bytes');
      const result = await client.uploadExcelToDrs({
        siteId: 'site-1',
        brandSlug: 'acme',
        jobId: 'job-abc',
        excelBuffer,
      });

      expect(result).to.equal('s3://drs-bucket/external/spacecat/site-1/acme/job-abc/source.xlsx');
      expect(s3ClientStub).to.have.been.calledOnce;
      const [cmd] = s3ClientStub.args[0];
      expect(cmd.input.Bucket).to.equal(S3_BUCKET);
      expect(cmd.input.Key).to.equal('external/spacecat/site-1/acme/job-abc/source.xlsx');
      expect(cmd.input.ContentType).to.equal('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(cmd.input.ServerSideEncryption).to.equal('AES256');
      expect(cmd.input.Body).to.equal(excelBuffer);
      expect(log.info).to.have.been.calledWith('Uploading Excel to DRS S3', { siteId: 'site-1', jobId: 'job-abc', key: 'external/spacecat/site-1/acme/job-abc/source.xlsx' });
      expect(log.info).to.have.been.calledWith('Excel uploaded to DRS S3', { uri: result });
    });

    it('throws when not S3 configured', async () => {
      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      await expect(client.uploadExcelToDrs({ siteId: 'site-1', brandSlug: 'acme', jobId: 'job-1', excelBuffer: Buffer.from('x') }))
        .to.be.rejectedWith('DRS S3 is not configured');
    });

    it('throws when siteId is missing', async () => {
      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, s3Client,
      }, log);
      await expect(client.uploadExcelToDrs({ brandSlug: 'acme', jobId: 'job-1', excelBuffer: Buffer.from('x') }))
        .to.be.rejectedWith('siteId is required');
    });

    it('throws when jobId is missing', async () => {
      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, s3Client,
      }, log);
      await expect(client.uploadExcelToDrs({ siteId: 'site-1', brandSlug: 'acme', excelBuffer: Buffer.from('x') }))
        .to.be.rejectedWith('jobId is required');
    });

    it('throws when excelBuffer is missing', async () => {
      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, s3Client,
      }, log);
      await expect(client.uploadExcelToDrs({ siteId: 'site-1', brandSlug: 'acme', jobId: 'job-1' }))
        .to.be.rejectedWith('excelBuffer is required and must be non-empty');
    });

    it('throws when excelBuffer is empty', async () => {
      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, s3Client,
      }, log);
      await expect(client.uploadExcelToDrs({ siteId: 'site-1', brandSlug: 'acme', jobId: 'job-1', excelBuffer: Buffer.alloc(0) }))
        .to.be.rejectedWith('excelBuffer is required and must be non-empty');
    });

    it('propagates S3 send errors', async () => {
      s3ClientStub.rejects(new Error('S3 access denied'));

      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL,
        apiKey: DRS_API_KEY,
        s3Bucket: S3_BUCKET,
        snsTopicArn: SNS_TOPIC_ARN,
        s3Client,
      }, log);

      await expect(client.uploadExcelToDrs({
        siteId: 'site-1',
        brandSlug: 'acme',
        jobId: 'job-1',
        excelBuffer: Buffer.from('x'),
      })).to.be.rejectedWith('S3 access denied');
    });
  });

  describe('publishBrandPresenceAnalyze', () => {
    const S3_BUCKET = 'drs-bucket';
    const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:drs-topic';
    let snsClientStub;
    let snsClient;

    beforeEach(() => {
      snsClientStub = sinon.stub();
      snsClient = { send: snsClientStub };
    });

    it('publishes JOB_COMPLETED SNS event with all fields', async () => {
      snsClientStub.resolves({});

      const client = new DrsClient({
        apiBaseUrl: DRS_API_URL,
        apiKey: DRS_API_KEY,
        s3Bucket: S3_BUCKET,
        snsTopicArn: SNS_TOPIC_ARN,
        snsClient,
      }, log);

      await client.publishBrandPresenceAnalyze({
        jobId: 'job-abc',
        siteId: 'site-1',
        brandName: 'Acme',
        imsOrgId: 'org-123',
        resultLocation: 's3://drs-bucket/external/spacecat/site-1/acme/job-abc/source.xlsx',
        platform: 'chatgpt_free',
        week: 12,
        year: 2026,
      });

      expect(snsClientStub).to.have.been.calledOnce;
      const [cmd] = snsClientStub.args[0];
      expect(cmd.input.TopicArn).to.equal(SNS_TOPIC_ARN);
      const message = JSON.parse(cmd.input.Message);
      expect(message.event_type).to.equal('JOB_COMPLETED');
      expect(message.job_id).to.equal('job-abc');
      expect(message.provider_id).to.equal('external_spacecat');
      expect(message.result_location).to.equal('s3://drs-bucket/external/spacecat/site-1/acme/job-abc/source.xlsx');
      expect(message.reanalysis).to.be.true;
      expect(message.metadata).to.deep.equal({ site: 'site-1', brand: 'Acme', imsOrgId: 'org-123' });
      expect(message.platform).to.equal('chatgpt_free');
      expect(message.week).to.equal(12);
      expect(message.year).to.equal(2026);
      expect(cmd.input.MessageAttributes.event_type.StringValue).to.equal('JOB_COMPLETED');
      expect(cmd.input.MessageAttributes.provider_id.StringValue).to.equal('external_spacecat');
    });

    it('omits optional fields when not provided', async () => {
      snsClientStub.resolves({});

      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, snsClient,
      }, log);

      await client.publishBrandPresenceAnalyze({
        jobId: 'job-1',
        siteId: 'site-1',
        resultLocation: 's3://drs-bucket/external/spacecat/site-1/acme/job-1/source.xlsx',
      });

      const [cmd] = snsClientStub.args[0];
      const message = JSON.parse(cmd.input.Message);
      expect(message).to.not.have.property('platform');
      expect(message).to.not.have.property('week');
      expect(message).to.not.have.property('year');
    });

    it('throws when not S3 configured', async () => {
      const client = new DrsClient({ apiBaseUrl: DRS_API_URL, apiKey: DRS_API_KEY }, log);
      await expect(client.publishBrandPresenceAnalyze({ jobId: 'j', siteId: 's', resultLocation: 's3://x' }))
        .to.be.rejectedWith('DRS S3 is not configured');
    });

    it('throws when jobId is missing', async () => {
      const client = new DrsClient({ s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, snsClient }, log);
      await expect(client.publishBrandPresenceAnalyze({ siteId: 'site-1', resultLocation: 's3://x' }))
        .to.be.rejectedWith('jobId is required');
    });

    it('throws when siteId is missing', async () => {
      const client = new DrsClient({ s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, snsClient }, log);
      await expect(client.publishBrandPresenceAnalyze({ jobId: 'job-1', resultLocation: 's3://x' }))
        .to.be.rejectedWith('siteId is required');
    });

    it('throws when resultLocation is missing', async () => {
      const client = new DrsClient({ s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, snsClient }, log);
      await expect(client.publishBrandPresenceAnalyze({ jobId: 'job-1', siteId: 'site-1' }))
        .to.be.rejectedWith('resultLocation is required');
    });

    it('propagates SNS send errors', async () => {
      snsClientStub.rejects(new Error('SNS publish failed'));

      const client = new DrsClient({
        s3Bucket: S3_BUCKET, snsTopicArn: SNS_TOPIC_ARN, snsClient,
      }, log);

      await expect(client.publishBrandPresenceAnalyze({
        jobId: 'job-1',
        siteId: 'site-1',
        resultLocation: 's3://drs-bucket/external/spacecat/site-1/acme/job-1/source.xlsx',
      })).to.be.rejectedWith('SNS publish failed');
    });
  });

  describe('createFrom with S3/SNS config', () => {
    it('reads DRS_S3_BUCKET and DRS_SNS_TOPIC_ARN from env', () => {
      const context = {
        env: {
          DRS_API_URL,
          DRS_API_KEY,
          DRS_S3_BUCKET: 'drs-bucket',
          DRS_SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:123:topic',
          AWS_REGION: 'us-east-1',
        },
        log,
      };
      const client = DrsClient.createFrom(context);
      expect(client.isS3Configured()).to.be.true;
    });

    it('isS3Configured returns false when S3 env vars are absent', () => {
      const context = {
        env: { DRS_API_URL, DRS_API_KEY },
        log,
      };
      const client = DrsClient.createFrom(context);
      expect(client.isS3Configured()).to.be.false;
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
