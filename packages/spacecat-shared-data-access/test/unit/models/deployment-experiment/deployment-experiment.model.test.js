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

import DeploymentExperiment from '../../../../src/models/deployment-experiment/deployment-experiment.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('DeploymentExperimentModel', () => {
  let instance;
  let mockElectroService;

  const mockRecord = {
    deploymentExperimentId: 'e12345',
    siteId: '2c1f0868-cc2d-4358-ba26-a7b5965ee403',
    opportunityId: '3b7de19c-4bf8-4687-a337-b9f4a5d56f8e',
    preDeploymentId: 'drs-pre-schedule-id',
    postDeploymentId: 'drs-post-schedule-id',
    status: DeploymentExperiment.STATUSES.POST_ANALYSIS_DONE,
    suggestionIds: ['4d56efe4-9473-4e9a-95f3-c7536ffc56a3'],
    metadata: { deployType: 'edge' },
    error: { message: 'none' },
    updatedBy: 'spacecat-api-service',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(DeploymentExperiment, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  it('initializes correctly', () => {
    expect(instance).to.be.an('object');
    expect(instance.record).to.deep.equal(mockRecord);
  });

  it('gets and sets preDeploymentId', () => {
    expect(instance.getPreDeploymentId()).to.equal('drs-pre-schedule-id');
    instance.setPreDeploymentId('pre-2');
    expect(instance.getPreDeploymentId()).to.equal('pre-2');
  });

  it('gets and sets postDeploymentId', () => {
    expect(instance.getPostDeploymentId()).to.equal('drs-post-schedule-id');
    instance.setPostDeploymentId('post-2');
    expect(instance.getPostDeploymentId()).to.equal('post-2');
  });

  it('gets and sets status', () => {
    expect(instance.getStatus()).to.equal(DeploymentExperiment.STATUSES.POST_ANALYSIS_DONE);
    instance.setStatus(DeploymentExperiment.STATUSES.DEPLOYED);
    expect(instance.getStatus()).to.equal(DeploymentExperiment.STATUSES.DEPLOYED);
  });

  it('gets and sets suggestionIds', () => {
    expect(instance.getSuggestionIds()).to.deep.equal(['4d56efe4-9473-4e9a-95f3-c7536ffc56a3']);
    instance.setSuggestionIds(['73684b8d-22fc-4ac8-b5e3-502f6a256eb7']);
    expect(instance.getSuggestionIds()).to.deep.equal(['73684b8d-22fc-4ac8-b5e3-502f6a256eb7']);
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
