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

import { isObject, isValidUrl } from '@adobe/spacecat-shared-utils';
import { createSiteCandidate } from '../../models/site-candidate.js';
import { SiteCandidateDto } from '../../dto/site-candidate.js';

/**
 * Checks if a site candidate exists in site candidates table using base url
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} baseURL - base url of the site candidate.
 * @return {Promise<Readonly<Boolean>>} A promise that resolves to true if site candidate exist
 */
export const exists = async (dynamoClient, config, baseURL) => {
  const dynamoItem = await dynamoClient.getItem(config.tableNameSiteCandidates, { baseURL });

  return isObject(dynamoItem);
};

export const getSiteCandidateByBaseURL = async (
  dynamoClient,
  config,
  log,
  baseURL,
) => {
  const dynamoItem = await dynamoClient.getItem(config.tableNameSiteCandidates, { baseURL });

  return isObject(dynamoItem) ? SiteCandidateDto.fromDynamoItem(dynamoItem) : null;
};

/**
 * Upserts a site candidate.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {object} log - the logger object
 * @param {object} siteCandidateData - The site candidate data.
 * @returns {Promise<Readonly<SiteCandidate>>} newly created site candidate if hadn't created before
 */
export const upsertSiteCandidate = async (
  dynamoClient,
  config,
  log,
  siteCandidateData,
) => {
  const siteCandidate = createSiteCandidate(siteCandidateData);
  const siteCandidateExists = await exists(dynamoClient, config, siteCandidate.getBaseURL());

  if (siteCandidateExists) {
    log.info(`Ignoring the site candidate with base url ${siteCandidate.getBaseURL()} because it already exists`);
    return siteCandidate;
  }

  await dynamoClient.putItem(
    config.tableNameSiteCandidates,
    SiteCandidateDto.toDynamoItem(siteCandidate),
  );

  return siteCandidate;
};

/**
 * Updates a site candidate.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {SiteCandidate} siteCandidate - The site candidate object to be updated.
 * @returns {Promise<Readonly<Site>>} - The updated site candidate.
 */
export const updateSiteCandidate = async (
  dynamoClient,
  config,
  siteCandidate,
) => {
  const siteCandidateExists = await exists(dynamoClient, config, siteCandidate.getBaseURL());

  if (!siteCandidateExists) {
    throw new Error(`Site candidate with base url ${siteCandidate.getBaseURL()} does not exist`);
  }

  await dynamoClient.putItem(
    config.tableNameSiteCandidates,
    SiteCandidateDto.toDynamoItem(siteCandidate),
  );

  return siteCandidate;
};

/**
 * Removes a site candidate.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The site candidate object to be updated.
 * @param {String} baseUrl - Base Url of the site candidate to remove.
 * @returns {Promise<void>} - The updated site candidate.
 */
export const removeSiteCandidate = async (
  dynamoClient,
  config,
  log,
  baseUrl,
) => {
  if (isValidUrl(baseUrl)) {
    const tableName = config.tableNameSiteCandidates;
    await dynamoClient.removeItem(
      tableName,
      { baseURL: baseUrl },
    );
  }
};
