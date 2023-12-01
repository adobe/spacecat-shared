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

import {
  getAuditsForSite,
  getLatestAuditForSite,
  getLatestAudits, removeAuditsForSite,
} from '../audits/accessPatterns.js';

import { createSite } from '../../models/site.js';
import { SiteDto } from '../../dto/site.js';

const INDEX_NAME_ALL_SITES = 'all_sites';
const PK_ALL_SITES = 'ALL_SITES';
const TABLE_NAME_SITES = 'sites';

/**
 * Retrieves all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @returns {Promise<Array<Site>>} A promise that resolves to an array of all sites.
 */
export const getSites = async (dynamoClient) => {
  const dynamoItems = await dynamoClient.query({
    TableName: TABLE_NAME_SITES,
    IndexName: INDEX_NAME_ALL_SITES, // GSI name
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': PK_ALL_SITES,
    },
  });

  return dynamoItems.map((dynamoItem) => SiteDto.fromDynamoItem(dynamoItem));
};

/**
 * Retrieves a list of base URLs for all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @returns {Promise<Array<string>>} A promise that resolves to an array of base URLs for all sites.
 */
export const getSitesToAudit = async (dynamoClient) => {
  const sites = await getSites(dynamoClient);

  return sites.map((site) => site.getBaseURL());
};

/**
 * Retrieves sites with their latest audit of a specified type.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} auditType - The type of the latest audits to retrieve for each site.
 * @param {boolean} [sortAuditsAscending] - Optional. Determines if the audits
 * should be sorted ascending or descending by scores.
 * @returns {Promise<Array>} A promise that resolves to an array of site objects,
 * each with its latest audit of the specified type.
 */
export const getSitesWithLatestAudit = async (
  dynamoClient,
  log,
  auditType,
  sortAuditsAscending = true,
) => {
  const [sites, latestAudits] = await Promise.all([
    getSites(dynamoClient),
    getLatestAudits(dynamoClient, log, auditType, sortAuditsAscending),
  ]);

  const sitesMap = new Map(sites.map((site) => [site.getId(), site]));

  return latestAudits.reduce((result, audit) => {
    const site = sitesMap.get(audit.getSiteId());
    if (site) {
      site.setAudits([audit]);
      result.push(site);
    }
    return result;
  }, []);
};

/**
 * Retrieves a site by its base URL.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseURL - The base URL of the site to retrieve.
 * @returns {Promise<Site|null>} A promise that resolves to the site object if found,
 * otherwise null.
 */
export const getSiteByBaseURL = async (
  dynamoClient,
  log,
  baseURL,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: TABLE_NAME_SITES,
    IndexName: INDEX_NAME_ALL_SITES,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND baseURL = :baseURL',
    ExpressionAttributeValues: {
      ':gsi1pk': PK_ALL_SITES,
      ':baseURL': baseURL,
    },
    Limit: 1,
  });

  if (dynamoItems.length === 0) {
    return null;
  }

  return SiteDto.fromDynamoItem(dynamoItems[0]);
};

/**
 * Retrieves a site by its base URL, along with associated audit information.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @param {boolean} [latestOnly=false] - Determines if only the latest audit should be retrieved.
 * @returns {Promise<Site|null>} A promise that resolves to the site object with audit
 * data if found, otherwise null.
 */
export const getSiteByBaseURLWithAuditInfo = async (
  dynamoClient,
  log,
  baseUrl,
  auditType,
  latestOnly = false,
) => {
  const site = await getSiteByBaseURL(dynamoClient, log, baseUrl);

  if (!isObject(site)) {
    return null;
  }

  const audits = latestOnly
    ? [await getLatestAuditForSite(
      dynamoClient,
      log,
      site.getId(),
      auditType,
    )].filter((audit) => audit != null)
    : await getAuditsForSite(
      dynamoClient,
      log,
      site.getId(),
      auditType,
    );

  site.setAudits(audits);

  return site;
};

/**
 * Retrieves a site by its base URL, including all its audits.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @returns {Promise<Site|null>} A promise that resolves to the site object with all its audits.
 */
export const getSiteByBaseURLWithAudits = async (
  dynamoClient,
  log,
  baseUrl,
  auditType,
) => getSiteByBaseURLWithAuditInfo(dynamoClient, log, baseUrl, auditType, false);

/**
 * Retrieves a site by its base URL, including only its latest audit.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of the latest audit to retrieve for the site.
 * @returns {Promise<Site|null>} A promise that resolves to the site object with its latest audit.
 */
export const getSiteByBaseURLWithLatestAudit = async (
  dynamoClient,
  log,
  baseUrl,
  auditType,
) => getSiteByBaseURLWithAuditInfo(dynamoClient, log, baseUrl, auditType, true);

/**
 * Adds a site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {object} siteData - The site data.
 * @returns {Promise<Readonly<Site>>}
 */
export const addSite = async (dynamoClient, log, siteData) => {
  const site = createSite(siteData);
  const existingSite = await getSiteByBaseURL(
    dynamoClient,
    log,
    site.getBaseURL(),
  );

  if (isObject(existingSite)) {
    throw new Error('Site already exists');
  }

  await dynamoClient.putItem(TABLE_NAME_SITES, SiteDto.toDynamoItem(site));

  return site;
};

/**
 * Updates a site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {Site} site - The site.
 * @returns {Promise<Site>} - The updated site.
 */
export const updateSite = async (dynamoClient, log, site) => {
  const existingSite = await getSiteByBaseURL(dynamoClient, log, site.getBaseURL());

  if (!isObject(existingSite)) {
    throw new Error('Site not found');
  }

  await dynamoClient.putItem(TABLE_NAME_SITES, SiteDto.toDynamoItem(site));

  return site;
};

/**
 * Removes a site and its related audits.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site to remove.
 * @returns {Promise<void>}
 */
export const removeSite = async (dynamoClient, log, siteId) => {
  try {
    await removeAuditsForSite(dynamoClient, log, siteId);

    await dynamoClient.removeItem(TABLE_NAME_SITES, { siteId });
  } catch (error) {
    log.error(`Error removing site: ${error.message}`);
    throw error;
  }
};
