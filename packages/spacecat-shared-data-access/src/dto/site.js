/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { createSite } from '../models/site.js';

/**
 * Data transfer object for Site.
 */
export const SiteDto = {
  /**
   * Converts a Site object into a DynamoDB item.
   * @param {Readonly<Site>} site - Site object.
   * @returns {{createdAt, baseURL, GSI1PK: string, id, imsOrgId, updatedAt}}
   */
  toDynamoItem: (site) => ({
    id: site.getId(),
    baseURL: site.getBaseURL(),
    gitHubURL: site.getGitHubURL(),
    imsOrgId: site.getImsOrgId(),
    isLive: site.isLive(),
    createdAt: site.getCreatedAt(),
    updatedAt: site.getUpdatedAt(),
    GSI1PK: 'ALL_SITES',
  }),

  /**
   * Converts a DynamoDB item into a Site object.
   * @param {object } dynamoItem - DynamoDB item.
   * @returns {Readonly<Site>} Site object.
   */
  fromDynamoItem: (dynamoItem) => {
    const siteData = {
      id: dynamoItem.id,
      baseURL: dynamoItem.baseURL,
      gitHubURL: dynamoItem.gitHubURL,
      imsOrgId: dynamoItem.imsOrgId,
      isLive: dynamoItem.isLive,
      createdAt: dynamoItem.createdAt,
      updatedAt: dynamoItem.updatedAt,
    };

    return createSite(siteData);
  },
};
