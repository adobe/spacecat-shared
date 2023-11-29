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

import {
  getAuditsForSite,
  getLatestAuditForSite,
  getLatestAudits,
} from '../audits/accessPatterns.js';

/**
 * Retrieves all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @returns {Promise<Array>} A promise that resolves to an array of all sites.
 */
export const getSites = async (dynamoClient) => dynamoClient.query({
  TableName: 'sites',
  IndexName: 'all_sites', // GSI name
  KeyConditionExpression: 'GSI1PK = :gsi1pk',
  ExpressionAttributeValues: {
    ':gsi1pk': 'ALL_SITES',
  },
});

/**
 * Retrieves a list of base URLs for all sites.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @returns {Promise<Array<string>>} A promise that resolves to an array of base URLs for all sites.
 */
export const getSitesToAudit = async (dynamoClient, log) => {
  const sites = await getSites(dynamoClient, log);

  return sites.map((item) => item.baseURL);
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

  const sitesMap = new Map(sites.map((site) => [site.id, site]));

  return latestAudits.reduce((result, audit) => {
    const site = sitesMap.get(audit.siteId);
    if (site) {
      site.audits = [audit];
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
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @returns {Promise<Object|null>} A promise that resolves to the site object if found,
 * otherwise null.
 */
export const getSiteByBaseURL = async (
  dynamoClient,
  log,
  baseUrl,
) => dynamoClient.getItem('sites', {
  GSI1PK: 'ALL_SITES',
  baseUrl,
});

/**
 * Retrieves a site by its base URL, along with associated audit information.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @param {boolean} [latestOnly=false] - Determines if only the latest audit should be retrieved.
 * @returns {Promise<Object|null>} A promise that resolves to the site object with audit
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

  if (!site) {
    return null;
  }

  site.audits = latestOnly
    ? [await getLatestAuditForSite(
      dynamoClient,
      log,
      site.id,
      auditType,
    )].filter((audit) => audit != null)
    : await getAuditsForSite(
      dynamoClient,
      log,
      site.id,
      auditType,
    );

  return site;
};

/**
 * Retrieves a site by its base URL, including all its audits.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {Logger} log - The logger.
 * @param {string} baseUrl - The base URL of the site to retrieve.
 * @param {string} auditType - The type of audits to retrieve for the site.
 * @returns {Promise<Object|null>} A promise that resolves to the site object with all its audits.
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
 * @returns {Promise<Object|null>} A promise that resolves to the site object with its latest audit.
 */
export const getSiteByBaseURLWithLatestAudit = async (
  dynamoClient,
  log,
  baseUrl,
  auditType,
) => getSiteByBaseURLWithAuditInfo(dynamoClient, log, baseUrl, auditType, true);
