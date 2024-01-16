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

import Config from '../models/site/config.js';
import { createOrganization } from '../models/organization.js';

/**
 * Data transfer object for Organization.
 */
export const OrganizationDto = {
  /**
     * Converts an Organization object into a DynamoDB item.
     * @param {Readonly<Organization>} organization - Organization object.
     * @returns {{createdAt, baseURL, GSI1PK: string, id, imsOrgId, updatedAt}}
     */
  toDynamoItem: (organization) => ({
    id: organization.getId(),
    name: organization.getName(),
    imsOrgId: organization.getImsOrgId(),
    createdAt: organization.getCreatedAt(),
    updatedAt: organization.getUpdatedAt(),
    GSI1PK: 'ALL_ORGANIZATIONS',
    config: Config.toDynamoItem(organization.getConfig()),
  }),

  /**
     * Converts a DynamoDB item into a Organization object.
     * @param {object } dynamoItem - DynamoDB item.
     * @returns {Readonly<Organization>} Organization object.
     */
  fromDynamoItem: (dynamoItem) => {
    const organizationData = {
      id: dynamoItem.id,
      name: dynamoItem.name,
      imsOrgId: dynamoItem.imsOrgId,
      createdAt: dynamoItem.createdAt,
      updatedAt: dynamoItem.updatedAt,
      config: dynamoItem.config,
    };

    return createOrganization(organizationData);
  },
};
