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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import GeoExperiment from '../../../../src/models/geo-experiment/geo-experiment.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('GeoExperimentModel', () => {
  let instance;
  let mockElectroService;

  const mockRecord = {
    geoExperimentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    siteId: '2c1f0868-cc2d-4358-ba26-a7b5965ee403',
    opportunityId: '3b7de19c-4bf8-4687-a337-b9f4a5d56f8e',
    preScheduleId: 'drs-pre-schedule-id',
    postScheduleId: 'drs-post-schedule-id',
    type: GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT,
    status: GeoExperiment.STATUSES.COMPLETED,
    phase: GeoExperiment.PHASES.POST_ANALYSIS_DONE,
    suggestionIds: ['4d56efe4-9473-4e9a-95f3-c7536ffc56a3'],
    name: 'Test RCV Experiment',
    promptsCount: 5,
    promptsLocation: 'geo-experiments/site-123/exp-456-prompts.json',
    metadata: { deployType: 'edge' },
    insightsLocation: 'geo-experiments/site-123/exp-456-insights.json',
    error: { message: 'none' },
    updatedBy: 'spacecat-api-service',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(GeoExperiment, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  it('initializes correctly', () => {
    expect(instance).to.be.an('object');
    expect(instance.record).to.deep.equal(mockRecord);
  });

  it('gets and sets preScheduleId', () => {
    expect(instance.getPreScheduleId()).to.equal('drs-pre-schedule-id');
    instance.setPreScheduleId('pre-2');
    expect(instance.getPreScheduleId()).to.equal('pre-2');
  });

  it('gets and sets postScheduleId', () => {
    expect(instance.getPostScheduleId()).to.equal('drs-post-schedule-id');
    instance.setPostScheduleId('post-2');
    expect(instance.getPostScheduleId()).to.equal('post-2');
  });

  it('exposes SCHEDULE_CONFIG_ENV_VAR constant', () => {
    expect(GeoExperiment.SCHEDULE_CONFIG_ENV_VAR).to.equal('EXPERIMENT_SCHEDULE_CONFIG');
  });

  it('exposes METADATA_KEYS constant', () => {
    expect(GeoExperiment.METADATA_KEYS).to.deep.equal({
      SCHEDULE_CONFIG: 'scheduleConfig',
      IMPACT_MEASUREMENT_TASK_ID: 'impactMeasurementTaskId',
      VALIDATION: 'validation',
      ROUTING_VALIDATION: 'routingValidation',
      OAE_VALIDATION_JOBS: 'oaeValidationJobs',
      BASELINE_MEASUREMENT: 'baselineMeasurement',
    });
  });

  it('exposes SCHEDULE_CONFIG_KEYS constant', () => {
    expect(GeoExperiment.SCHEDULE_CONFIG_KEYS).to.deep.equal({
      CRON_EXPRESSION: 'cronExpression',
      EXPIRY_MS: 'expiryMs',
      PLATFORMS: 'platforms',
      PROVIDER_IDS: 'providerIds',
    });
  });

  it('gets and sets type', () => {
    expect(instance.getType()).to.equal(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
    instance.setType(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
    expect(instance.getType()).to.equal(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
  });

  it('gets and sets status', () => {
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.COMPLETED);
    instance.setStatus(GeoExperiment.STATUSES.GENERATING_BASELINE);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.GENERATING_BASELINE);
    instance.setStatus(GeoExperiment.STATUSES.IN_PROGRESS);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.IN_PROGRESS);
    instance.setStatus(GeoExperiment.STATUSES.FAILED);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.FAILED);
  });

  it('gets and sets phase', () => {
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.POST_ANALYSIS_DONE);
    instance.setPhase(GeoExperiment.PHASES.INITIATED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.INITIATED);
    instance.setPhase(GeoExperiment.PHASES.ROUTING_VALIDATION);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.ROUTING_VALIDATION);
    instance.setPhase(GeoExperiment.PHASES.PROMPT_GENERATION_STARTED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.PROMPT_GENERATION_STARTED);
    instance.setPhase(GeoExperiment.PHASES.PROMPT_GENERATION_COMPLETED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.PROMPT_GENERATION_COMPLETED);
    instance.setPhase(GeoExperiment.PHASES.PRE_ANALYSIS_STARTED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.PRE_ANALYSIS_STARTED);
    instance.setPhase(GeoExperiment.PHASES.PRE_ANALYSIS_DONE);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.PRE_ANALYSIS_DONE);
    instance.setPhase(GeoExperiment.PHASES.DEPLOYMENT_STARTED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.DEPLOYMENT_STARTED);
    instance.setPhase(GeoExperiment.PHASES.DEPLOYMENT_DONE);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.DEPLOYMENT_DONE);
    instance.setPhase(GeoExperiment.PHASES.POST_ANALYSIS_STARTED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.POST_ANALYSIS_STARTED);
    instance.setPhase(GeoExperiment.PHASES.IMPACT_MEASUREMENT_STARTED);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.IMPACT_MEASUREMENT_STARTED);
    instance.setPhase(GeoExperiment.PHASES.IMPACT_MEASUREMENT_DONE);
    expect(instance.getPhase()).to.equal(GeoExperiment.PHASES.IMPACT_MEASUREMENT_DONE);
  });

  it('exposes the impact-measurement phases', () => {
    expect(GeoExperiment.PHASES.IMPACT_MEASUREMENT_STARTED).to.equal('impact_measurement_started');
    expect(GeoExperiment.PHASES.IMPACT_MEASUREMENT_DONE).to.equal('impact_measurement_done');
  });

  it('exposes the routing-validation phase', () => {
    expect(GeoExperiment.PHASES.ROUTING_VALIDATION).to.equal('routing_validation');
  });

  it('exposes the baseline-measurement phases', () => {
    expect(GeoExperiment.PHASES.PRE_ANALYSIS_MEASUREMENT_STARTED).to.equal('pre_analysis_measurement_started');
    expect(GeoExperiment.PHASES.PRE_ANALYSIS_MEASUREMENT_DONE).to.equal('pre_analysis_measurement_done');
  });

  describe('insights entries', () => {
    const baseline = {
      window: 0, type: 'baseline', label: 'Baseline (runs 1-14)', location: 'geo-experiments/e/baseline/insights.json',
    };
    const post = {
      window: 1, type: 'post_analysis', label: 'Post-analysis (runs 1-14)', location: 'geo-experiments/e/insights.json',
    };
    const legacy = 'geo-experiments/site-123/exp-456-insights.json';
    const legacyEntry = {
      window: 1, type: 'post_analysis', label: 'Post-analysis', location: legacy,
    };

    beforeEach(() => {
      instance.setInsightsLocation(legacy);
      instance.setInsightsList(null);
    });

    it('exposes INSIGHTS_TYPES and INSIGHTS_WINDOWS', () => {
      expect(GeoExperiment.INSIGHTS_TYPES).to.deep.equal({
        BASELINE: 'baseline', POST_ANALYSIS: 'post_analysis', EXTENSION: 'extension',
      });
      expect(GeoExperiment.INSIGHTS_WINDOWS).to.deep.equal({ BASELINE: 0, POST_ANALYSIS: 1 });
    });

    it('validates entries', () => {
      expect(GeoExperiment.isValidInsightsEntry(baseline)).to.equal(true);
      const withRange = { ...baseline, runRange: { from: 1, to: 14 }, completedAt: '2026-09-25T00:00:00Z' };
      expect(GeoExperiment.isValidInsightsEntry(withRange)).to.equal(true);
      expect(GeoExperiment.isValidInsightsEntry(null)).to.equal(false);
      expect(GeoExperiment.isValidInsightsEntry({ ...baseline, window: -1 })).to.equal(false);
      expect(GeoExperiment.isValidInsightsEntry({ ...baseline, window: 0.5 })).to.equal(false);
      expect(GeoExperiment.isValidInsightsEntry({ ...baseline, type: 'unknown' })).to.equal(false);
      expect(GeoExperiment.isValidInsightsEntry({ ...baseline, label: '' })).to.equal(false);
      expect(GeoExperiment.isValidInsightsEntry({ ...baseline, location: '' })).to.equal(false);
    });

    it('validates insightsList values', () => {
      expect(GeoExperiment.isValidInsightsList(undefined)).to.equal(true);
      expect(GeoExperiment.isValidInsightsList(null)).to.equal(true);
      expect(GeoExperiment.isValidInsightsList([])).to.equal(true);
      expect(GeoExperiment.isValidInsightsList([baseline, post])).to.equal(true);
      const duplicateWindow = [baseline, { ...post, window: 0 }];
      expect(GeoExperiment.isValidInsightsList(duplicateWindow)).to.equal(false);
      expect(GeoExperiment.isValidInsightsList([{ ...baseline, type: 'x' }])).to.equal(false);
      expect(GeoExperiment.isValidInsightsList('geo-experiments/e/insights.json')).to.equal(false);
      expect(GeoExperiment.isValidInsightsList({ window: 0 })).to.equal(false);
      expect(GeoExperiment.isValidInsightsList(42)).to.equal(false);
    });

    it('falls back to the legacy insightsLocation as the window 1 entry', () => {
      expect(instance.getInsightsEntries()).to.deep.equal([legacyEntry]);
      instance.setInsightsList([]);
      expect(instance.getInsightsEntries()).to.deep.equal([legacyEntry]);
    });

    it('reads no insights as no entries', () => {
      instance.setInsightsLocation(null);
      expect(instance.getInsightsEntries()).to.deep.equal([]);
    });

    it('prefers insightsList, sorted by window, without mutating the stored value', () => {
      const stored = [post, baseline];
      instance.setInsightsList(stored);
      expect(instance.getInsightsEntries()).to.deep.equal([baseline, post]);
      expect(stored).to.deep.equal([post, baseline]);
      expect(instance.getInsightsLocation()).to.equal(legacy);
    });

    it('upserts an entry, replacing the same window and keeping the rest', () => {
      instance.setInsightsLocation(null);
      const withBaseline = instance.upsertInsightsEntry(baseline);
      expect(withBaseline).to.deep.equal([baseline]);

      instance.setInsightsList(withBaseline);
      const withPost = instance.upsertInsightsEntry(post);
      expect(withPost).to.deep.equal([baseline, post]);
      expect(instance.getInsightsList()).to.deep.equal([baseline]);

      instance.setInsightsList(withPost);
      const rerun = { ...baseline, label: 'Baseline (runs 1-15)' };
      expect(instance.upsertInsightsEntry(rerun)).to.deep.equal([rerun, post]);
    });

    it('upserts next to the legacy insightsLocation entry', () => {
      expect(instance.upsertInsightsEntry(baseline)).to.deep.equal([baseline, legacyEntry]);
    });

    it('rejects an invalid entry on upsert', () => {
      expect(() => instance.upsertInsightsEntry({ window: 0 })).to.throw('Invalid insights entry');
    });
  });

  it('gets and sets promptsLocation', () => {
    expect(instance.getPromptsLocation()).to.equal('geo-experiments/site-123/exp-456-prompts.json');
    instance.setPromptsLocation('geo-experiments/site-123/exp-789-prompts.json');
    expect(instance.getPromptsLocation()).to.equal('geo-experiments/site-123/exp-789-prompts.json');
  });

  it('gets and sets suggestionIds', () => {
    expect(instance.getSuggestionIds()).to.deep.equal(['4d56efe4-9473-4e9a-95f3-c7536ffc56a3']);
    instance.setSuggestionIds(['73684b8d-22fc-4ac8-b5e3-502f6a256eb7']);
    expect(instance.getSuggestionIds()).to.deep.equal(['73684b8d-22fc-4ac8-b5e3-502f6a256eb7']);
  });

  it('gets and sets name', () => {
    expect(instance.getName()).to.equal('Test RCV Experiment');
    instance.setName('Updated Experiment Name');
    expect(instance.getName()).to.equal('Updated Experiment Name');
  });

  it('gets and sets promptsCount', () => {
    expect(instance.getPromptsCount()).to.equal(5);
    instance.setPromptsCount(10);
    expect(instance.getPromptsCount()).to.equal(10);
  });

  it('gets and sets startTime', () => {
    expect(instance.getStartTime()).to.be.undefined;
    instance.setStartTime('2026-03-29T12:00:00.000Z');
    expect(instance.getStartTime()).to.equal('2026-03-29T12:00:00.000Z');
  });

  it('gets and sets completionDate', () => {
    expect(instance.getEndTime()).to.be.undefined;
    instance.setEndTime('2026-04-12T08:00:00.000Z');
    expect(instance.getEndTime()).to.equal('2026-04-12T08:00:00.000Z');
  });

  it('gets and sets metadata and error', () => {
    expect(instance.getMetadata()).to.deep.equal({ deployType: 'edge' });
    expect(instance.getError()).to.deep.equal({ message: 'none' });
    instance.setMetadata({ attempt: 2 });
    instance.setError({ message: 'failed' });
    expect(instance.getMetadata()).to.deep.equal({ attempt: 2 });
    expect(instance.getError()).to.deep.equal({ message: 'failed' });
  });

  it('gets and sets insightsLocation', () => {
    expect(instance.getInsightsLocation()).to.equal('geo-experiments/site-123/exp-456-insights.json');
    instance.setInsightsLocation('geo-experiments/site-123/exp-789-insights.json');
    expect(instance.getInsightsLocation()).to.equal('geo-experiments/site-123/exp-789-insights.json');
  });

  it('gets and sets updatedBy', () => {
    expect(instance.getUpdatedBy()).to.equal('spacecat-api-service');
    instance.setUpdatedBy('spacecat-audit-worker');
    expect(instance.getUpdatedBy()).to.equal('spacecat-audit-worker');
  });
});
