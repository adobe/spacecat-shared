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

import { isObject } from '@adobe/spacecat-shared-utils';

import { createOrganization } from '../../models/organization.js';
import { OrganizationDto } from '../../dto/organization.js';

/**
 * Retrieves all organizations.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @returns {Promise<Readonly<Organization>[]>} A promise that resolves to an array of all
 * organizations.
 */
export const getOrganizations = async (dynamoClient, config) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameOrganizations,
    IndexName: config.indexNameAllOrganizations,
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllOrganizations,
    },
  });

  return dynamoItems.map((dynamoItem) => OrganizationDto.fromDynamoItem(dynamoItem));
};

export const getOrganizationByID = async (
  dynamoClient,
  config,
  organizationId,
) => {
  const dynamoItem = await dynamoClient.getItem(
    config.tableNameOrganizations,
    { id: organizationId },
  );

  return isObject(dynamoItem) ? OrganizationDto.fromDynamoItem(dynamoItem) : null;
};

/**
 * Adds an organization.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {object} organizationData - The organization data.
 * @returns {Promise<Readonly<Organization>>}
 */
export const addOrganization = async (
  dynamoClient,
  config,
  log,
  organizationData,
) => {
  const organization = createOrganization(organizationData);

  await dynamoClient.putItem(
    config.tableNameOrganizations,
    OrganizationDto.toDynamoItem(organization),
  );

  return organization;
};

/**
 * Updates an organization.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {Organization} organization - The organization.
 * @returns {Promise<Readonly<Organization>>} - The updated organization.
 */
export const updateOrganization = async (
  dynamoClient,
  config,
  log,
  organization,
) => {
  const existingOrganization = await getOrganizationByID(
    dynamoClient,
    config,
    organization.getId(),
  );

  if (!isObject(existingOrganization)) {
    throw new Error('Organization not found');
  }

  await dynamoClient.putItem(
    config.tableNameOrganizations,
    OrganizationDto.toDynamoItem(organization),
  );

  return organization;
};

/**
 * Removes an organization.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} organizationId - The ID of the organization to remove.
 * @returns {Promise<void>}
 */
export const removeOrganization = async (
  dynamoClient,
  config,
  log,
  organizationId,
) => {
  try {
    await dynamoClient.removeItem(config.tableNameOrganizations, { id: organizationId });
  } catch (error) {
    log.error(`Error removing organization: ${error.message}`);
    throw error;
  }
};
