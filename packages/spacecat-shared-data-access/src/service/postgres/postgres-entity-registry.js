/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { DataAccessError } from '../../errors/index.js';
import { collectionNameToEntityName, decapitalize } from '../../util/util.js';
import ConfigurationCollection from '../../models/configuration/configuration.collection.js';

/* eslint-disable max-len */
// Postgres collection imports
import PostgresApiKeyCollection from '../../models/postgres/api-key/api-key.pg.collection.js';
import PostgresAsyncJobCollection from '../../models/postgres/async-job/async-job.pg.collection.js';
import PostgresAuditCollection from '../../models/postgres/audit/audit.pg.collection.js';
import PostgresAuditUrlCollection from '../../models/postgres/audit-url/audit-url.pg.collection.js';
import PostgresEntitlementCollection from '../../models/postgres/entitlement/entitlement.pg.collection.js';
import PostgresExperimentCollection from '../../models/postgres/experiment/experiment.pg.collection.js';
import PostgresFixEntityCollection from '../../models/postgres/fix-entity/fix-entity.pg.collection.js';
import PostgresFixEntitySuggestionCollection from '../../models/postgres/fix-entity-suggestion/fix-entity-suggestion.pg.collection.js';
import PostgresImportJobCollection from '../../models/postgres/import-job/import-job.pg.collection.js';
import PostgresImportUrlCollection from '../../models/postgres/import-url/import-url.pg.collection.js';
import PostgresKeyEventCollection from '../../models/postgres/key-event/key-event.pg.collection.js';
import PostgresLatestAuditCollection from '../../models/postgres/latest-audit/latest-audit.pg.collection.js';
import PostgresOpportunityCollection from '../../models/postgres/opportunity/opportunity.pg.collection.js';
import PostgresOrganizationCollection from '../../models/postgres/organization/organization.pg.collection.js';
import PostgresPageCitabilityCollection from '../../models/postgres/page-citability/page-citability.pg.collection.js';
import PostgresPageIntentCollection from '../../models/postgres/page-intent/page-intent.pg.collection.js';
import PostgresProjectCollection from '../../models/postgres/project/project.pg.collection.js';
import PostgresReportCollection from '../../models/postgres/report/report.pg.collection.js';
import PostgresScrapeJobCollection from '../../models/postgres/scrape-job/scrape-job.pg.collection.js';
import PostgresScrapeUrlCollection from '../../models/postgres/scrape-url/scrape-url.pg.collection.js';
import PostgresSentimentGuidelineCollection from '../../models/postgres/sentiment-guideline/sentiment-guideline.pg.collection.js';
import PostgresSentimentTopicCollection from '../../models/postgres/sentiment-topic/sentiment-topic.pg.collection.js';
import PostgresSiteCandidateCollection from '../../models/postgres/site-candidate/site-candidate.pg.collection.js';
import PostgresSiteCollection from '../../models/postgres/site/site.pg.collection.js';
import PostgresSiteEnrollmentCollection from '../../models/postgres/site-enrollment/site-enrollment.pg.collection.js';
import PostgresSiteTopFormCollection from '../../models/postgres/site-top-form/site-top-form.pg.collection.js';
import PostgresSiteTopPageCollection from '../../models/postgres/site-top-page/site-top-page.pg.collection.js';
import PostgresSuggestionCollection from '../../models/postgres/suggestion/suggestion.pg.collection.js';
import PostgresTrialUserCollection from '../../models/postgres/trial-user/trial-user.pg.collection.js';
import PostgresTrialUserActivityCollection from '../../models/postgres/trial-user-activity/trial-user-activity.pg.collection.js';

// Schema imports (reuse existing v2 schemas - they are storage-agnostic)
import ApiKeySchema from '../../models/api-key/api-key.schema.js';
import AsyncJobSchema from '../../models/async-job/async-job.schema.js';
import AuditSchema from '../../models/audit/audit.schema.js';
import AuditUrlSchema from '../../models/audit-url/audit-url.schema.js';
import EntitlementSchema from '../../models/entitlement/entitlement.schema.js';
import ExperimentSchema from '../../models/experiment/experiment.schema.js';
import FixEntitySchema from '../../models/fix-entity/fix-entity.schema.js';
import FixEntitySuggestionSchema from '../../models/fix-entity-suggestion/fix-entity-suggestion.schema.js';
import ImportJobSchema from '../../models/import-job/import-job.schema.js';
import ImportUrlSchema from '../../models/import-url/import-url.schema.js';
import KeyEventSchema from '../../models/key-event/key-event.schema.js';
import LatestAuditSchema from '../../models/latest-audit/latest-audit.schema.js';
import OpportunitySchema from '../../models/opportunity/opportunity.schema.js';
import OrganizationSchema from '../../models/organization/organization.schema.js';
import PageCitabilitySchema from '../../models/page-citability/page-citability.schema.js';
import PageIntentSchema from '../../models/page-intent/page-intent.schema.js';
import ProjectSchema from '../../models/project/project.schema.js';
import ReportSchema from '../../models/report/report.schema.js';
import ScrapeJobSchema from '../../models/scrape-job/scrape-job.schema.js';
import ScrapeUrlSchema from '../../models/scrape-url/scrape-url.schema.js';
import SentimentGuidelineSchema from '../../models/sentiment-guideline/sentiment-guideline.schema.js';
import SentimentTopicSchema from '../../models/sentiment-topic/sentiment-topic.schema.js';
import SiteCandidateSchema from '../../models/site-candidate/site-candidate.schema.js';
import SiteSchema from '../../models/site/site.schema.js';
import SiteEnrollmentSchema from '../../models/site-enrollment/site-enrollment.schema.js';
import SiteTopFormSchema from '../../models/site-top-form/site-top-form.schema.js';
import SiteTopPageSchema from '../../models/site-top-page/site-top-page.schema.js';
import SuggestionSchema from '../../models/suggestion/suggestion.schema.js';
import TrialUserSchema from '../../models/trial-user/trial-user.schema.js';
import TrialUserActivitySchema from '../../models/trial-user-activity/trial-user-activity.schema.js';
/* eslint-enable max-len */

/**
 * PostgresEntityRegistry - A registry class responsible for managing Postgres-backed entities,
 * their schema and collection. Mirrors the v2 EntityRegistry interface but creates
 * PostgresBase* instances instead of ElectroDB-backed ones.
 *
 * @class PostgresEntityRegistry
 */
class PostgresEntityRegistry {
  static entities = {};

  /**
   * Constructs an instance of PostgresEntityRegistry.
   * @constructor
   * @param {Object} postgrestClient - The PostgREST client for database operations.
   * @param {Object} config - Configuration with optional s3 service.
   * @param {{s3Client: S3Client, s3Bucket: string}|null} [config.s3] - S3 config for
   *   Configuration collection.
   * @param {Object} log - A logger for capturing logging information.
   */
  constructor(postgrestClient, config, log) {
    this.postgrestClient = postgrestClient;
    this.config = config;
    this.log = log;
    this.collections = new Map();

    this.#initialize();
  }

  /**
   * Initializes all registered entity collections.
   * PostgREST-backed collections receive the PostgREST client.
   * Configuration collection continues to use S3.
   * @private
   */
  #initialize() {
    Object.values(PostgresEntityRegistry.entities).forEach(
      ({ collection: Collection, schema }) => {
        const collection = new Collection(this.postgrestClient, this, schema, this.log);
        this.collections.set(Collection.COLLECTION_NAME, collection);
      },
    );

    // Configuration: stays S3-based
    if (this.config.s3) {
      const configCollection = new ConfigurationCollection(this.config.s3, this.log);
      this.collections.set(ConfigurationCollection.COLLECTION_NAME, configCollection);
    }
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {DataAccessError} - If the collection is not found.
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new DataAccessError(`Collection ${collectionName} not found`, this);
    }
    return collection;
  }

  /**
   * Gets all collections keyed by entity name (without "Collection" suffix).
   * @returns {Object} - Dictionary of collections.
   */
  getCollections() {
    const collections = {};
    for (const [key, value] of this.collections) {
      collections[collectionNameToEntityName(key)] = value;
    }
    return collections;
  }

  /**
   * Registers an entity (schema + collection class) in the registry.
   * @param {Schema} schema - The schema for the entity.
   * @param {Function} collection - The collection class.
   */
  static registerEntity(schema, collection) {
    this.entities[decapitalize(schema.getEntityName())] = { schema, collection };
  }
}

// Register all Postgres-backed entities (Configuration is handled separately via S3)
PostgresEntityRegistry.registerEntity(ApiKeySchema, PostgresApiKeyCollection);
PostgresEntityRegistry.registerEntity(AsyncJobSchema, PostgresAsyncJobCollection);
PostgresEntityRegistry.registerEntity(AuditSchema, PostgresAuditCollection);
PostgresEntityRegistry.registerEntity(AuditUrlSchema, PostgresAuditUrlCollection);
PostgresEntityRegistry.registerEntity(EntitlementSchema, PostgresEntitlementCollection);
PostgresEntityRegistry.registerEntity(ExperimentSchema, PostgresExperimentCollection);
PostgresEntityRegistry.registerEntity(FixEntitySchema, PostgresFixEntityCollection);
// eslint-disable-next-line max-len
PostgresEntityRegistry.registerEntity(FixEntitySuggestionSchema, PostgresFixEntitySuggestionCollection);
PostgresEntityRegistry.registerEntity(ImportJobSchema, PostgresImportJobCollection);
PostgresEntityRegistry.registerEntity(ImportUrlSchema, PostgresImportUrlCollection);
PostgresEntityRegistry.registerEntity(KeyEventSchema, PostgresKeyEventCollection);
PostgresEntityRegistry.registerEntity(LatestAuditSchema, PostgresLatestAuditCollection);
PostgresEntityRegistry.registerEntity(OpportunitySchema, PostgresOpportunityCollection);
PostgresEntityRegistry.registerEntity(OrganizationSchema, PostgresOrganizationCollection);
PostgresEntityRegistry.registerEntity(PageCitabilitySchema, PostgresPageCitabilityCollection);
PostgresEntityRegistry.registerEntity(PageIntentSchema, PostgresPageIntentCollection);
PostgresEntityRegistry.registerEntity(ProjectSchema, PostgresProjectCollection);
PostgresEntityRegistry.registerEntity(ReportSchema, PostgresReportCollection);
PostgresEntityRegistry.registerEntity(ScrapeJobSchema, PostgresScrapeJobCollection);
PostgresEntityRegistry.registerEntity(ScrapeUrlSchema, PostgresScrapeUrlCollection);
// eslint-disable-next-line max-len
PostgresEntityRegistry.registerEntity(SentimentGuidelineSchema, PostgresSentimentGuidelineCollection);
PostgresEntityRegistry.registerEntity(SentimentTopicSchema, PostgresSentimentTopicCollection);
PostgresEntityRegistry.registerEntity(SiteSchema, PostgresSiteCollection);
PostgresEntityRegistry.registerEntity(SiteCandidateSchema, PostgresSiteCandidateCollection);
PostgresEntityRegistry.registerEntity(SiteEnrollmentSchema, PostgresSiteEnrollmentCollection);
PostgresEntityRegistry.registerEntity(SiteTopFormSchema, PostgresSiteTopFormCollection);
PostgresEntityRegistry.registerEntity(SiteTopPageSchema, PostgresSiteTopPageCollection);
PostgresEntityRegistry.registerEntity(SuggestionSchema, PostgresSuggestionCollection);
PostgresEntityRegistry.registerEntity(TrialUserSchema, PostgresTrialUserCollection);
PostgresEntityRegistry.registerEntity(TrialUserActivitySchema, PostgresTrialUserActivityCollection);

export default PostgresEntityRegistry;
