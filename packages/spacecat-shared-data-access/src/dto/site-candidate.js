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

import { createSiteCandidate } from '../models/site-candidate.js';

/**
 * Data transfer object for Site Candidate.
 */
export const SiteCandidateDto = {
  /**
   * Converts a Site Candidate object into a DynamoDB item.
   * @param {Readonly<SiteCandidate>} siteCandidate - Site Candidate object.
   * @returns {{baseURL, siteId, source, status, createdAt, updatedAt, updatedBy}}
   */
  toDynamoItem: (siteCandidate) => ({
    baseURL: siteCandidate.getBaseURL(),
    hlxConfig: siteCandidate.getHlxConfig(),
    siteId: siteCandidate.getSiteId(),
    source: siteCandidate.getSource(),
    status: siteCandidate.getStatus(),
    createdAt: siteCandidate.getCreatedAt(),
    updatedAt: siteCandidate.getUpdatedAt(),
    updatedBy: siteCandidate.getUpdatedBy(),
  }),

  /**
   * Converts a DynamoDB item into Site Candidate object;
   * @param {object } dynamoItem - DynamoDB item.
   * @returns {Readonly<SiteCandidate>} SiteCandidate object.
   */
  fromDynamoItem: (dynamoItem) => {
    const siteCandidateData = {
      baseURL: dynamoItem.baseURL,
      hlxConfig: dynamoItem.hlxConfig,
      siteId: dynamoItem.siteId,
      source: dynamoItem.source,
      status: dynamoItem.status,
      createdAt: dynamoItem.createdAt,
      updatedAt: dynamoItem.updatedAt,
      updatedBy: dynamoItem.updatedBy,
    };

    return createSiteCandidate(siteCandidateData);
  },
};
