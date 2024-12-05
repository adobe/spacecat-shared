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

import { createClient } from '@adobe/spacecat-shared-dynamo';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

import AWSXray from 'aws-xray-sdk';
import { Service } from 'electrodb';

import ModelFactory from '../v2/models/base/model.factory.js';

import ApiKeyCollection from '../v2/models/api-key/api-key.collection.js';
import AuditCollection from '../v2/models/audit/audit.collection.js';
import ConfigurationCollection from '../v2/models/configuration/configuration.collection.js';
import ExperimentCollection from '../v2/models/experiment/experiment.collection.js';
import KeyEventCollection from '../v2/models/key-event/key-event.collection.js';
import ImportJobCollection from '../v2/models/import-job/import-job.collection.js';
import ImportUrlCollection from '../v2/models/import-url/import-url.collection.js';
import OpportunityCollection from '../v2/models/opportunity/opportunity.collection.js';
import OrganizationCollection from '../v2/models/organization/organization.collection.js';
import SiteCandidateCollection from '../v2/models/site-candidate/site-candidate.collection.js';
import SiteCollection from '../v2/models/site/site.collection.js';
import SiteTopPageCollection from '../v2/models/site-top-page/site-top-page.collection.js';
import SuggestionCollection from '../v2/models/suggestion/suggestion.collection.js';

import ApiKeySchema from '../v2/models/api-key/api-key.schema.js';
import AuditSchema from '../v2/models/audit/audit.schema.js';
import ConfigurationSchema from '../v2/models/configuration/configuration.schema.js';
import ExperimentSchema from '../v2/models/experiment/experiment.schema.js';
import KeyEventSchema from '../v2/models/key-event/key-event.schema.js';
import ImportJobSchema from '../v2/models/import-job/import-job.schema.js';
import ImportUrlSchema from '../v2/models/import-url/import-url.schema.js';
import OpportunitySchema from '../v2/models/opportunity/opportunity.schema.js';
import OrganizationSchema from '../v2/models/organization/organization.schema.js';
import SiteCandidateSchema from '../v2/models/site-candidate/site-candidate.schema.js';
import SiteSchema from '../v2/models/site/site.schema.js';
import SiteTopPageSchema from '../v2/models/site-top-page/site-top-page.schema.js';
import SuggestionSchema from '../v2/models/suggestion/suggestion.schema.js';

import { auditFunctions } from './audits/index.js';
import { keyEventFunctions } from './key-events/index.js';
import { siteFunctions } from './sites/index.js';
import { siteCandidateFunctions } from './site-candidates/index.js';
import { organizationFunctions } from './organizations/index.js';
import { configurationFunctions } from './configurations/index.js';
import { siteTopPagesFunctions } from './site-top-pages/index.js';
import { importJobFunctions } from './import-job/index.js';
import { importUrlFunctions } from './import-url/index.js';
import { experimentFunctions } from './experiments/index.js';
import { apiKeyFunctions } from './api-key/index.js';

const createRawClient = () => {
  const dbClient = AWSXray.captureAWSv3Client(new DynamoDB());
  return DynamoDBDocument.from(dbClient, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
    },
  });
};

const createElectroService = (client, config, log) => {
  const { tableNameData: table } = config;
  /* c8 ignore start */
  const logger = (event) => {
    log.debug(JSON.stringify(event, null, 4));
  };
  /* c8 ignore end */
  return new Service(
    {
      apiKey: ApiKeySchema,
      audit: AuditSchema,
      configuration: ConfigurationSchema,
      experiment: ExperimentSchema,
      importJob: ImportJobSchema,
      importUrl: ImportUrlSchema,
      keyEvent: KeyEventSchema,
      opportunity: OpportunitySchema,
      organization: OrganizationSchema,
      site: SiteSchema,
      siteCandidate: SiteCandidateSchema,
      siteTopPage: SiteTopPageSchema,
      suggestion: SuggestionSchema,
    },
    {
      client,
      table,
      logger,
    },
  );
};

/**
 * Creates a data access object.
 *
 * @param {{pkAllSites: string, pkAllLatestAudits: string, indexNameAllLatestAuditScores: string,
 * tableNameAudits: string,tableNameLatestAudits: string, indexNameAllSitesOrganizations: string,
 * tableNameSites: string, tableNameOrganizations: string, tableNameExperiments: string,
 * indexNameAllSites: string,
 * tableNameImportJobs: string, pkAllImportJobs: string, indexNameAllImportJobs: string,
 * tableNameSiteTopPages: string, indexNameAllOrganizations: string,
 * indexNameAllOrganizationsByImsOrgId: string, pkAllOrganizations: string}} config configuration
 * @param {Logger} log logger
 * @returns {object} data access object
 */
export const createDataAccess = (config, log = console) => {
  const dynamoClient = createClient(log);

  const auditFuncs = auditFunctions(dynamoClient, config, log);
  const keyEventFuncs = keyEventFunctions(dynamoClient, config, log);
  const siteFuncs = siteFunctions(dynamoClient, config, log);
  const siteCandidateFuncs = siteCandidateFunctions(dynamoClient, config, log);
  const organizationFuncs = organizationFunctions(dynamoClient, config, log);
  const configurationFuncs = configurationFunctions(dynamoClient, config);
  const siteTopPagesFuncs = siteTopPagesFunctions(dynamoClient, config);
  const importJobFuncs = importJobFunctions(dynamoClient, config, log);
  const importUrlFuncs = importUrlFunctions(dynamoClient, config, log);
  const experimentFuncs = experimentFunctions(dynamoClient, config, log);
  const apiKeyFuncs = apiKeyFunctions(dynamoClient, config, log);

  // electro-based data access objects
  const rawClient = createRawClient();
  const electroService = createElectroService(rawClient, config, log);
  const modelFactory = new ModelFactory(electroService, log);

  const ApiKey = modelFactory.getCollection(ApiKeyCollection.name);
  const Audit = modelFactory.getCollection(AuditCollection.name);
  const Configuration = modelFactory.getCollection(ConfigurationCollection.name);
  const Experiment = modelFactory.getCollection(ExperimentCollection.name);
  const ImportJob = modelFactory.getCollection(ImportJobCollection.name);
  const ImportUrl = modelFactory.getCollection(ImportUrlCollection.name);
  const KeyEvent = modelFactory.getCollection(KeyEventCollection.name);
  const Opportunity = modelFactory.getCollection(OpportunityCollection.name);
  const Organization = modelFactory.getCollection(OrganizationCollection.name);
  const Site = modelFactory.getCollection(SiteCollection.name);
  const SiteCandidate = modelFactory.getCollection(SiteCandidateCollection.name);
  const SiteTopPage = modelFactory.getCollection(SiteTopPageCollection.name);
  const Suggestion = modelFactory.getCollection(SuggestionCollection.name);

  return {
    ...auditFuncs,
    ...keyEventFuncs,
    ...siteFuncs,
    ...siteCandidateFuncs,
    ...organizationFuncs,
    ...configurationFuncs,
    ...siteTopPagesFuncs,
    ...importJobFuncs,
    ...importUrlFuncs,
    ...experimentFuncs,
    ...apiKeyFuncs,
    // electro-based data access objects
    ApiKey,
    Audit,
    Configuration,
    Experiment,
    ImportJob,
    ImportUrl,
    KeyEvent,
    Opportunity,
    Organization,
    Site,
    SiteCandidate,
    SiteTopPage,
    Suggestion,
  };
};
