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

import { hasText } from '@adobe/spacecat-shared-utils';

import { Base } from './base.js';

export const DEFAULT_UPDATED_BY = 'spacecat';

/**
 * Creates a new Experiment.
 *
 * @param {object} data - experiment data
 * @returns {Readonly<SiteCandidate>} new experiment
 */
const Experiment = (data = {}) => {
  const self = Base(data);

  self.getSiteId = () => self.state.siteId;
  self.getExperimentId = () => self.state.experimentId;
  self.getName = () => self.state.name;
  self.getUrl = () => self.state.url;
  self.getStatus = () => self.state.status;
  self.getType = () => self.state.type;
  self.getStartDate = () => self.state.startDate;
  self.getEndDate = () => self.state.endDate;
  self.getVariants = () => self.state.variants;
  self.getUpdatedAt = () => self.state.updatedAt;
  self.getUpdatedBy = () => self.state.updatedBy;
  self.conversionEventName = () => self.state.conversionEventName;
  self.conversionEventValue = () => self.state.conversionEventValue;

  return Object.freeze(self);
};

/**
 * Creates a new Experiment.
 *
 * @param {object} data - experiment data
 * @returns {Readonly<SiteCandidate>} new experiment
 */
export const createExperiment = (data) => {
  const newState = { ...data };

  if (!hasText(newState.siteId)) {
    throw new Error('Site ID must be provided');
  }

  if (!hasText(newState.experimentId)) {
    throw new Error('Experiment ID must be provided');
  }

  if (!hasText(newState.updatedBy)) {
    newState.updatedBy = DEFAULT_UPDATED_BY;
  }

  return Experiment(newState);
};
