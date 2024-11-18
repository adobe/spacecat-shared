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

/* eslint-disable no-console */

import { v4 as uuidv4 } from 'uuid';

import { SITE_CANDIDATE_STATUS } from '../../src/models/site-candidate.js';
import { dbClient, docClient as client } from './db.js';
import { generateRandomAudit } from './auditUtils.js';
import { createTable, deleteTable } from './tableOperations.js';

import schema from '../../docs/schema.json' with { type: 'json' };
import { createKeyEvent, KEY_EVENT_TYPES } from '../../src/models/key-event.js';
import { KeyEventDto } from '../../src/dto/key-event.js';

/**
 * Creates all tables defined in a schema.
 *
 * Iterates over a predefined schema object and creates each table using the createTable function.
 * The schema object should define all required attributes and configurations for each table.
 */
async function createTablesFromSchema() {
  const creationPromises = schema.DataModel.map(
    (tableDefinition) => createTable(dbClient, tableDefinition),
  );
  await Promise.all(creationPromises);
}

/**
 * Deletes a predefined set of tables from the database.
 *
 * Iterates over a list of table names and deletes each one using the deleteTable function.
 * This is typically used to clean up the database before creating new tables or
 * generating test data.
 *
 * @param {Array<string>} tableNames - An array of table names to delete.
 * @returns {Promise<void>} A promise that resolves when all tables have been deleted.
 */
export async function deleteExistingTables(tableNames) {
  const deletionPromises = tableNames.map((tableName) => deleteTable(dbClient, tableName));
  await Promise.all(deletionPromises);
}

/**
 * Performs a batch write operation for a specified table in DynamoDB.
 *
 * @param {string} tableName - The name of the table to perform the batch write operation on.
 * @param {Array<Object>} items - An array of items to be written to the table.
 *
 * @example
 * // Example usage
 * const itemsToWrite = [{ id: '1', data: 'example' }, { id: '2', data: 'sample' }];
 * batchWrite('myTable', itemsToWrite);
 */
async function batchWrite(tableName, items) {
  const batchWriteRequests = [];
  while (items.length) {
    const batch = items.splice(0, 25).map((item) => ({
      PutRequest: { Item: item },
    }));

    batchWriteRequests.push(client.batchWrite({
      RequestItems: { [tableName]: batch },
    }));
  }

  await Promise.all(batchWriteRequests);
}

/**
 * Generates audit data for a specific site.
 *
 * @param {DataAccessConfig} config - The data access config.
 * @param {string} siteId - The ID of the site for which to generate audit data.
 * @param {Array<string>} auditTypes - An array of audit types to generate data for.
 * @param {number} numberOfAuditsPerType - The number of audits to generate for each type.
 * @returns {Object} An object containing arrays of audit data and latest audit data for the site.
 *
 * @example
 * // Example usage
 * const audits = generateAuditData('site123', ['lhs-mobile', 'cwv'], 5);
 */
function generateAuditData(
  config,
  siteId,
  auditTypes,
  numberOfAuditsPerType,
) {
  const latestAudits = {};
  const auditData = [];

  for (const type of auditTypes) {
    for (let j = 0; j < numberOfAuditsPerType; j += 1) {
      const audit = generateRandomAudit(siteId, type);
      auditData.push(audit);

      // Update latest audit for each type
      if (!latestAudits[type]
        || new Date(audit.auditedAt) > new Date(latestAudits[type].auditedAt)) {
        latestAudits[type] = audit;
      }
    }
  }

  const latestAuditData = Object.values(latestAudits).map((audit) => {
    // Modify the audit data for the latest_audits table
    let GSI1SK = `${audit.auditType}#`;
    if (audit.auditType === 'lhs-mobile') {
      GSI1SK += Object.values(audit.auditResult.scores).map((score) => (parseFloat(score) * 100).toFixed(0)).join('#');
    } else {
      GSI1SK += Object.values(audit.auditResult).join('#');
    }

    return {
      ...audit,
      GSI1PK: config.pkAllLatestAudits,
      GSI1SK,
    };
  });

  return { auditData, latestAuditData };
}

/**
 * Generates sample data for testing purposes.
 *
 * @param {DataAccessConfig} config - The data access config.
 * @param {number} [numberOfOrganizations=3] - The number of organizations to generate.
 * @param {number} [numberOfSites=10] - The number of sites to generate.
 * @param {number} [numberOfSiteCandidates=10] - The number of sites candidates to generate.
 * @param {number} [numberOfAuditsPerType=5] - The number of audits per type to generate
 * for each site.
 * @param {number} [numberOfSiteTopPages=5] - The number of site top pages to generate
 * @param {number} [numberOfKeyEvents=5] - The number of key events to generate
 * @param {number} [numberOfExperiments=3] - The number of experiments to generate
 * @example
 * // Example usage
 * generateSampleData(20, 10); // Generates 20 sites with 10 audits per type for each site
 */
export default async function generateSampleData(
  config,
  numberOfOrganizations = 3,
  numberOfSites = 10,
  numberOfSiteCandidates = 10,
  numberOfAuditsPerType = 5,
  numberOfSiteTopPages = 50,
  numberOfKeyEvents = 10,
  numberOfExperiments = 3,
) {
  console.time('Sample data generated in');
  await deleteExistingTables([
    config.tableNameSites,
    config.tableNameSiteCandidates,
    config.tableNameAudits,
    config.tableNameLatestAudits,
    config.tableNameOrganizations,
    config.tableNameConfigurations,
    config.tableNameSiteTopPages,
    config.tableNameKeyEvents,
    config.tableNameExperiments,
    config.tableNameApiKeys,
    config.tableNameImportJobs,
    config.tableNameImportUrls,
  ]);
  await createTablesFromSchema();

  const auditTypes = ['lhs-mobile', 'cwv'];
  const sites = [];
  const siteCandidates = [];
  const siteTopPages = [];
  const organizations = [];
  const auditItems = [];
  const latestAuditItems = [];
  const keyEvents = [];
  const experiments = [];
  const nowIso = new Date().toISOString();

  // Generate organization data
  for (let i = 0; i < numberOfOrganizations; i += 1) {
    const organizationId = uuidv4();
    organizations.push({
      id: organizationId,
      imsOrgId: `${i}-1234@AdobeOrg`,
      name: `${i}-1234Name`,
      GSI1PK: config.pkAllOrganizations,
      createdAt: nowIso,
      updatedAt: nowIso,
      config: {
        slack: {
          workspace: `${i}-workspace`,
          channel: `${i}-channel`,
        },
        handlers: {
          404: {
            mentions: { slack: [`${i}-slackId`] },
          },
          'organic-keywords': {
            country: 'RO',
          },
        },
      },
    });
  }
  // Generate site data
  for (let i = 0; i < numberOfSites; i += 1) {
    const siteId = uuidv4();
    sites.push({
      id: siteId,
      baseURL: `https://example${i}.com`,
      deliveryType: i % 2 === 0 ? 'aem_edge' : 'aem_cs',
      gitHubURL: `https://github.com/org-${i}/test-repo`,
      organizationId: organizations[i % 3].id,
      isLive: true,
      isLiveToggledAt: nowIso,
      GSI1PK: config.pkAllSites,
      createdAt: nowIso,
      updatedAt: nowIso,
      config: {
        slack: {
          workspace: `${i}-workspace`,
          channel: `${i}-channel`,
        },
        handlers: {
          404: {
            byOrg: true,
            mentions: { slack: [`${i}-slackId`] },
          },
          'lhs-mobile': {
            excludedURLs: ['https://example.com/excluded'],
          },
        },
      },
    });

    if (i % 10 !== 0) { // Every tenth site will not have any audits
      const latestAudits = generateAuditData(
        config,
        siteId,
        auditTypes,
        numberOfAuditsPerType,
      );
      auditItems.push(...latestAudits.auditData);
      latestAuditItems.push(...latestAudits.latestAuditData);
    }
  }

  const configurations = [{
    jobs: [
      {
        group: 'audits',
        type: 'lhs-mobile',
        interval: 'daily',
      }, {
        group: 'audits',
        type: '404',
        interval: 'daily',
      }, {
        group: 'imports',
        type: 'rum-ingest',
        interval: 'daily',
      }, {
        group: 'reports',
        type: '404-external-digest',
        interval: 'weekly',
      }, {
        group: 'audits',
        type: 'apex',
        interval: 'weekly',
      },
    ],
    handlers: {
      404: {
        enabledByDefault: true,
      },
      'organic-keywords': {
        enabledByDefault: false,
      },
      cwv: {
        enabledByDefault: true,
        disabled: { sites: sites.map((site) => site.id) },
      },
      'lhs-mobile': {
        enabledByDefault: true,
      },
    },
    queues: {
      audits: 'sqs://.../spacecat-services-audit-jobs',
      imports: 'sqs://.../spacecat-services-import-jobs',
      reports: 'sqs://.../spacecat-services-report-jobs',
    },
    version: 2,
    PK: config.pkAllConfigurations,
  },
  {
    jobs: [
      {
        group: 'audits',
        type: 'lhs-mobile',
        interval: 'daily',
      },
      {
        group: 'reports',
        type: '404-external-digest',
        interval: 'weekly',
      },
    ],
    queues: {
      audits: 'sqs://.../spacecat-services-audit-jobs',
      reports: 'sqs://.../spacecat-services-report-jobs',
    },
    version: 1,
    PK: config.pkAllConfigurations,
  }];

  // Generate site candidate data
  for (let i = 0; i < numberOfSiteCandidates; i += 1) {
    siteCandidates.push({
      baseURL: `https://example${i}.com`,
      status: SITE_CANDIDATE_STATUS.PENDING,
    });
  }

  // Generate site top pages data
  for (let i = 0; i < numberOfSiteTopPages; i += 1) {
    const traffic = (i + 1) * 12345;
    siteTopPages.push({
      siteId: sites[i % numberOfSites].id,
      SK: `ahrefs#global#${String(traffic).padStart(12, '0')}`,
      url: `${sites[i % numberOfSites].baseURL}/page-${i}`,
      traffic,
      topKeyword: `keyword-${i}`,
      source: 'ahrefs',
      geo: 'global',
      importedAt: nowIso,
    });
  }

  sites.forEach((site) => {
    for (let i = 0; i < numberOfKeyEvents; i += 1) {
      const keyEvent = createKeyEvent({
        siteId: site.id,
        name: `key-event-#${i}`,
        type: Object.values(KEY_EVENT_TYPES).at(i % Object.keys(KEY_EVENT_TYPES).length),
        time: new Date().toISOString(),
      });

      keyEvents.push(KeyEventDto.toDynamoItem(keyEvent));
    }
  });

  // Generate experiment data
  for (let i = 1; i <= numberOfExperiments; i += 1) {
    experiments.push({
      siteId: sites[0].id,
      experimentId: `experiment-${i}`,
      name: `Experiment ${i}`,
      url: `${sites[0].baseURL}/page-${i}`,
      status: 'active',
      type: 'full',
      variants: [
        {
          label: `Challenger ${i}`,
          name: `challenger-${i}`,
          interactionsCount: i * 10,
          p_value: 'coming soon',
          split: 0.8,
          url: `${sites[0].baseURL}/page-${i}/variant-${i}`,
          views: i * 100,
          metrics: [
            {
              selector: '.header .button',
              type: 'click',
              value: i * 2,
            }],
        },
        {
          label: `Challenger ${i + 1}`,
          name: `challenger-${i + 1}`,
          interactionsCount: (i + 1) * 10,
          p_value: 'coming soon',
          metrics: [],
          split: 0.8,
          url: `${sites[0].baseURL}/page-${i + 1}/variant-${i + 1}`,
          views: (i + 1) * 100,
        },
      ],
      startDate: nowIso,
      endDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString(),
      updatedAt: nowIso,
      updatedBy: 'scheduled-experiment-audit',
      SK: `experiment-${i}#${sites[0].baseURL}/page-${i}`,
    });
  }

  await batchWrite(config.tableNameSites, sites);
  await batchWrite(config.tableNameSiteCandidates, siteCandidates);
  await batchWrite(config.tableNameOrganizations, organizations);
  await batchWrite(config.tableNameAudits, auditItems);
  await batchWrite(config.tableNameLatestAudits, latestAuditItems);
  await batchWrite(config.tableNameConfigurations, configurations);
  await batchWrite(config.tableNameSiteTopPages, siteTopPages);
  await batchWrite(config.tableNameKeyEvents, keyEvents);
  await batchWrite(config.tableNameExperiments, experiments);

  console.log(`Generated ${numberOfOrganizations} organizations`);
  console.log(`Generated ${numberOfSites} sites with ${numberOfAuditsPerType} audits per type for each site`);
  console.log(`Generated ${numberOfExperiments} Experiments`);
  console.timeEnd('Sample data generated in');
}
