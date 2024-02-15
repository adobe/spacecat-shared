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

import { hasText, isValidUrl } from '@adobe/spacecat-shared-utils';

import { Base } from './base.js';

export const DEFAULT_UPDATED_BY = 'spacecat';

export const SITE_CANDIDATE_SOURCES = {
  SPACECAT_SLACK_BOT: 'SPACECAT_SLACK_BOT',
  RUM: 'RUM',
  CDN: 'CDN',
};

export const SITE_CANDIDATE_STATUS = {
  PENDING: 'PENDING', // site candidate notification sent and waiting for human input
  IGNORED: 'IGNORED', // site candidate discarded: not to be added to star catalogue
  APPROVED: 'APPROVED', // site candidate is added to star catalogue
  ERROR: 'ERROR', // site candidate is discovered
};

/**
 * Creates a new Site Candidate.
 *
 * @param {object} data - site candidate data
 * @returns {Readonly<SiteCandidate>} new site candidate
 */
const SiteCandidate = (data = {}) => {
  const self = Base({
    updatedBy: DEFAULT_UPDATED_BY,
    ...data,
  });
  delete self.state.id; // no id property used in SiteCandidate modal

  self.getBaseURL = () => self.state.baseURL;
  self.getSiteId = () => self.state.siteId;
  self.getSource = () => self.state.source;
  self.getStatus = () => self.state.status;
  self.getUpdatedBy = () => self.state.updatedBy;

  self.setSiteId = (siteId) => {
    self.state.siteId = siteId;
    self.touch();
    return self;
  };

  self.setSource = (source) => {
    self.state.source = source;
    self.touch();
    return self;
  };

  self.setStatus = (status) => {
    self.state.status = status;
    self.touch();
    return self;
  };

  self.setUpdatedBy = (updatedBy) => {
    self.state.updatedBy = updatedBy;
    self.touch();
    return self;
  };

  return Object.freeze(self);
};

/**
 * Creates a new Site Candidate.
 *
 * @param {object} data - site candidate data
 * @returns {Readonly<SiteCandidate>} new site candidate
 */
export const createSiteCandidate = (data) => {
  const newState = { ...data };

  if (!isValidUrl(newState.baseURL)) {
    throw new Error('Base URL must be a valid URL');
  }

  if (!hasText(newState.updatedBy)) {
    newState.updatedBy = DEFAULT_UPDATED_BY;
  }

  return SiteCandidate(newState);
};
