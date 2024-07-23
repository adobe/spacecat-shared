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
import {
  createExperiment,
  DEFAULT_UPDATED_BY,
} from '../../../src/models/experiment.js';

const validExperimentData = {
  siteId: 'a48b583f-53f6-4250-b0a4-5a1ae5ccb38f',
  experimentId: 'experiment-test',
  name: 'Experiment Test',
  url: 'https://example0.com/page-1',
  status: 'active',
  type: 'full',
  variants: [
    {
      label: 'Challenger 1',
      name: 'challenger-1',
      interactionsCount: 40,
      p_value: 'coming soon',
      split: 0.5,
      url: 'https://example0.com/page-1/variant-1',
      views: 1100,
      metrics: [
        {
          selector: '.header .button',
          type: 'click',
          value: 40,
        }],
    },
    {
      label: 'Control',
      name: 'control',
      interactionsCount: 0,
      p_value: 'coming soon',
      metrics: [],
      split: 0.5,
      url: 'https://example0.com/page-1',
      views: 1090,
    },
  ],
  startDate: new Date().toISOString(),
  endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
  updatedAt: new Date().toISOString(),
  updatedBy: 'unit-test',
  conversionEventName: 'convert',
  conversionEventValue: 'addToCart',
};

describe('Experiment Model Tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if siteId is missing', () => {
      expect(() => createExperiment({ ...validExperimentData, siteId: undefined })).to.throw('Site ID must be provided');
    });

    it('throws an error if experimentId is missing', () => {
      expect(() => createExperiment({ ...validExperimentData, experimentId: undefined })).to.throw('Experiment ID must be provided');
    });

    it('uses default updated by if missing', () => {
      const experiment = createExperiment({ ...validExperimentData, updatedBy: undefined });
      expect(experiment.getUpdatedBy()).to.equal(DEFAULT_UPDATED_BY);
    });

    it('creates an experiment object with the given siteId', () => {
      const experiment = createExperiment({ ...validExperimentData });
      expect(experiment).to.be.an('object');
      expect(experiment.getSiteId()).to.equal(validExperimentData.siteId);
    });
  });

  describe('Experiment Object Functionality', () => {
    let experiment;

    beforeEach(() => {
      experiment = createExperiment(validExperimentData);
    });

    it('does use same values from the experiment object passed', () => {
      expect(experiment.getExperimentId()).to.equal(validExperimentData.experimentId);
      expect(experiment.getSiteId()).to.equal(validExperimentData.siteId);
      expect(experiment.getName()).to.equal(validExperimentData.name);
      expect(experiment.getUrl()).to.equal(validExperimentData.url);
      expect(experiment.getStatus()).to.equal(validExperimentData.status);
      expect(experiment.getType()).to.equal(validExperimentData.type);
      expect(experiment.getStartDate()).to.equal(validExperimentData.startDate);
      expect(experiment.getEndDate()).to.equal(validExperimentData.endDate);
      expect(new Date(experiment.getUpdatedAt()).getMilliseconds()).to.be.greaterThan(
        new Date(validExperimentData.updatedAt).getMilliseconds(),
      );
      expect(experiment.getUpdatedBy()).to.equal(validExperimentData.updatedBy);
      expect(experiment.getVariants()).to.deep.equal(validExperimentData.variants);
      expect(experiment.getConversionEventName()).to.equal(validExperimentData.conversionEventName);
      expect(experiment.getConversionEventValue()).to.equal(
        validExperimentData.conversionEventValue,
      );
    });
  });
});
