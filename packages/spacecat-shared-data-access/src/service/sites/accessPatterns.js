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

/**
 * Retrieves all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @returns {Promise<Readonly<Site>[]>} A promise that resolves to an array of all sites.
 */
export const getSites = async (dynamoClient, config) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameSites,
    IndexName: config.indexNameAllSites,
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllSites,
    },
  });

  return dynamoItems.map((dynamoItem) => SiteDto.fromDynamoItem(dynamoItem));
};

/**
 * Retrieves all sites of a specific delivery type.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} deliveryType - The delivery type.
 * @return {Promise<Readonly<Site>[]>} A promise that resolves to an array of all sites of the
 * specified delivery type.
 */
export const getSitesByDeliveryType = async (dynamoClient, config, deliveryType) => {
  if (deliveryType === 'all') {
    return getSites(dynamoClient, config);
  }

  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameSites,
    IndexName: config.indexNameAllSitesByDeliveryType,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND deliveryType = :deliveryType',
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllSites,
      ':deliveryType': deliveryType,
    },
  });

  return dynamoItems.map((dynamoItem) => SiteDto.fromDynamoItem(dynamoItem));
};

/**
 * Retrieves a list of site IDs of all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @returns {Promise<Array<string>>} A promise that resolves to an array of site IDs of all sites.
 */
export const getSitesToAudit = async (dynamoClient, config) => {
  const sites = await getSites(dynamoClient, config);

  return sites.map((site) => site.getId());
};

/**
 * Retrieves all sites with their latest audit. Sites without a latest audit will be included
 * in the result, but will have an empty audits array. The sites are sorted by their latest
 * audit scores in ascending order by default. The sortAuditsAscending parameter can be used
 * to change the sort order. If a site has no latest audit, it will be sorted at the end of
 * the list.
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} auditType - The type of audits to retrieve for the sites.
 * @param {boolean} [sortAuditsAscending=true] - Determines if the audits should be sorted in
 * ascending order.
 * @param {string} [deliveryType=DEFAULT_DELIVERY_TYPE] - The delivery type of the sites
 * to retrieve.
 * @return {Promise<Readonly<Site>[]>} A promise that resolves to an array of sites with their
 * latest audit.
 */
export const getSitesWithLatestAudit = async (
  dynamoClient,
  config,
  log,
  auditType,
  sortAuditsAscending = true,
  deliveryType = 'all',
) => {
  const [sites, latestAudits] = await Promise.all([
    getSitesByDeliveryType(dynamoClient, config, deliveryType),
    getLatestAudits(dynamoClient, config, log, auditType, sortAuditsAscending),
  ]);

  const sitesMap = new Map(sites.map((site) => [site.getId(), site]));
  const orderedSites = [];

  // First, append sites with a latest audit in the sorted order
  latestAudits.forEach((audit) => {
    const site = sitesMap.get(audit.getSiteId());
    if (site) {
      site.setAudits([audit]);
      orderedSites.push(site);
      sitesMap.delete(site.getId()); // Remove the site from the map to avoid adding it again
    }
  });

  // Then, append the remaining sites (without a latest audit)
  sitesMap.forEach((site) => {
    site.setAudits([]);
    orderedSites.push(site);
  });

  return orderedSites;
};

/**
 * Retrieves a site by its base URL.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} baseURL - The base URL of the site to retrieve.
 * @returns {Promise<Readonly<Site>|null>} A promise that resolves to the site object if found,
 * otherwise null.
 */
export const getSiteByBaseURL = async (
  dynamoClient,
  config,
  log,
  baseURL,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameSites,
    IndexName: config.indexNameAllSites,
    KeyConditionExpression: 'GSI1PK = :gsi1pk AND baseURL = :baseURL',
    ExpressionAttributeValues: {
      ':gsi1pk': config.pkAllSites,
      ':baseURL': baseURL,
    },
    Limit: 1,
  });

  return dynamoItems.length > 0 ? SiteDto.fromDynamoItem(dynamoItems[0]) : null;
};

/**
 * Retrieves a site by its base URL, along with associated audit information.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @param {boolean} [latestOnly=false] - Determines if only the latest audit should be retrieved.
 * @returns {Promise<Readonly<Site>|null>} A promise that resolves to the site object with audit
 * data if found, otherwise null.
 */
export const getSiteByBaseURLWithAuditInfo = async (
  dynamoClient,
  config,
  log,
  baseUrl,
  auditType,
  latestOnly = false,
) => {
  const site = await getSiteByBaseURL(dynamoClient, config, log, baseUrl);

  if (!isObject(site)) {
    return null;
  }

  const audits = latestOnly
    ? [await getLatestAuditForSite(
      dynamoClient,
      config,
      log,
      site.getId(),
      auditType,
    )].filter((audit) => audit != null)
    : await getAuditsForSite(
      dynamoClient,
      config,
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
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @returns {Promise<Readonly<Site>|null>} A promise that resolves to the site object
 * with all its audits.
 */
export const getSiteByBaseURLWithAudits = async (
  dynamoClient,
  config,
  log,
  baseUrl,
  auditType,
) => getSiteByBaseURLWithAuditInfo(dynamoClient, config, log, baseUrl, auditType, false);

/**
 * Retrieves a site by its base URL, including only its latest audit.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of the latest audit to retrieve for the site.
 * @returns {Promise<Readonly<Site>|null>} A promise that resolves to the site object
 * with its latest audit.
 */
export const getSiteByBaseURLWithLatestAudit = async (
  dynamoClient,
  config,
  log,
  baseUrl,
  auditType,
) => getSiteByBaseURLWithAuditInfo(dynamoClient, config, log, baseUrl, auditType, true);

export const getSitesByOrganizationId = async (
  dynamoClient,
  config,
  log,
  organizationId,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameSites,
    IndexName: config.indexNameAllSitesOrganizations,
    KeyConditionExpression: 'organizationId = :organizationId',
    ExpressionAttributeValues: {
      ':organizationId': organizationId,
    },
    Limit: 1,
  });

  return dynamoItems.length > 0 ? SiteDto.fromDynamoItem(dynamoItems[0]) : null;
};

/**
 * Retrieves a site by its ID.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site to retrieve.
 * @returns {Promise<Readonly<Site>|null>} A promise that resolves to the site object if found,
 * otherwise null.
 */
export const getSiteByID = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  const dynamoItem = await dynamoClient.getItem(config.tableNameSites, { id: siteId });

  return isObject(dynamoItem) ? SiteDto.fromDynamoItem(dynamoItem) : null;
};

/**
 * Adds a site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {object} siteData - The site data.
 * @returns {Promise<Readonly<Site>>}
 */
export const addSite = async (
  dynamoClient,
  config,
  log,
  siteData,
) => {
  const site = createSite(siteData);
  const existingSite = await getSiteByBaseURL(
    dynamoClient,
    config,
    log,
    site.getBaseURL(),
  );

  if (isObject(existingSite)) {
    throw new Error('Site already exists');
  }

  await dynamoClient.putItem(config.tableNameSites, SiteDto.toDynamoItem(site));

  return site;
};

/**
 * Updates a site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {Site} site - The site.
 * @returns {Promise<Readonly<Site>>} - The updated site.
 */
export const updateSite = async (
  dynamoClient,
  config,
  log,
  site,
) => {
  const existingSite = await getSiteByBaseURL(dynamoClient, config, log, site.getBaseURL());

  if (!isObject(existingSite)) {
    throw new Error('Site not found');
  }

  await dynamoClient.putItem(config.tableNameSites, SiteDto.toDynamoItem(site));

  return site;
};

/**
 * Removes a site and its related audits.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site to remove.
 * @returns {Promise<void>}
 */
export const removeSite = async (
  dynamoClient,
  config,
  log,
  siteId,
) => {
  try {
    // TODO: Add transaction support
    await removeAuditsForSite(dynamoClient, config, log, siteId);

    await dynamoClient.removeItem(config.tableNameSites, { id: siteId });
  } catch (error) {
    log.error(`Error removing site: ${error.message}`);
    throw error;
  }
};
