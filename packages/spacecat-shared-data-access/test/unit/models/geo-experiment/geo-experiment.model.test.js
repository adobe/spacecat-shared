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
    status: GeoExperiment.STATUSES.POST_ANALYSIS_DONE,
    suggestionIds: ['4d56efe4-9473-4e9a-95f3-c7536ffc56a3'],
    name: 'Test RCV Experiment',
    promptsCount: 5,
    metadata: { deployType: 'edge' },
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

  it('gets and sets type', () => {
    expect(instance.getType()).to.equal(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
    instance.setType(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
    expect(instance.getType()).to.equal(GeoExperiment.TYPES.ONSITE_OPPORTUNITY_DEPLOYMENT);
  });

  it('gets and sets status', () => {
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.POST_ANALYSIS_DONE);
    instance.setStatus(GeoExperiment.STATUSES.INITIATED);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.INITIATED);
    instance.setStatus(GeoExperiment.STATUSES.PRE_ANALYSIS_FAILED);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.PRE_ANALYSIS_FAILED);
    instance.setStatus(GeoExperiment.STATUSES.POST_ANALYSIS_FAILED);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.POST_ANALYSIS_FAILED);
    instance.setStatus(GeoExperiment.STATUSES.FAILED);
    expect(instance.getStatus()).to.equal(GeoExperiment.STATUSES.FAILED);
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

  it('gets and sets baselineDate', () => {
    expect(instance.getBaselineDate()).to.be.undefined;
    instance.setBaselineDate('2026-03-29T12:00:00.000Z');
    expect(instance.getBaselineDate()).to.equal('2026-03-29T12:00:00.000Z');
  });

  it('gets and sets completionDate', () => {
    expect(instance.getCompletionDate()).to.be.undefined;
    instance.setCompletionDate('2026-04-12T08:00:00.000Z');
    expect(instance.getCompletionDate()).to.equal('2026-04-12T08:00:00.000Z');
  });

  it('gets and sets metadata and error', () => {
    expect(instance.getMetadata()).to.deep.equal({ deployType: 'edge' });
    expect(instance.getError()).to.deep.equal({ message: 'none' });
    instance.setMetadata({ attempt: 2 });
    instance.setError({ message: 'failed' });
    expect(instance.getMetadata()).to.deep.equal({ attempt: 2 });
    expect(instance.getError()).to.deep.equal({ message: 'failed' });
  });

  it('gets and sets updatedBy', () => {
    expect(instance.getUpdatedBy()).to.equal('spacecat-api-service');
    instance.setUpdatedBy('spacecat-audit-worker');
    expect(instance.getUpdatedBy()).to.equal('spacecat-audit-worker');
  });
});
