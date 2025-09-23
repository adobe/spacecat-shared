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

import { DataAccessError } from '../../errors/index.js';
import { collectionNameToEntityName, decapitalize } from '../../util/util.js';

import ApiKeyCollection from '../api-key/api-key.collection.js';
import AsyncJobCollection from '../async-job/async-job.collection.js';
import AuditCollection from '../audit/audit.collection.js';
import ConfigurationCollection from '../configuration/configuration.collection.js';
import ExperimentCollection from '../experiment/experiment.collection.js';
import EntitlementCollection from '../entitlement/entitlement.collection.js';
import FixEntityCollection from '../fix-entity/fix-entity.collection.js';
import ImportJobCollection from '../import-job/import-job.collection.js';
import ImportUrlCollection from '../import-url/import-url.collection.js';
import KeyEventCollection from '../key-event/key-event.collection.js';
import LatestAuditCollection from '../latest-audit/latest-audit.collection.js';
import OpportunityCollection from '../opportunity/opportunity.collection.js';
import OrganizationCollection from '../organization/organization.collection.js';
import ScrapeJobCollection from '../scrape-job/scrape-job.collection.js';
import ScrapeUrlCollection from '../scrape-url/scrape-url.collection.js';
import SiteCandidateCollection from '../site-candidate/site-candidate.collection.js';
import SiteCollection from '../site/site.collection.js';
import SiteEnrollmentCollection from '../site-enrollment/site-enrollment.collection.js';
import SiteTopFormCollection from '../site-top-form/site-top-form.collection.js';
import SiteTopPageCollection from '../site-top-page/site-top-page.collection.js';
import SuggestionCollection from '../suggestion/suggestion.collection.js';
import PageIntentCollection from '../page-intent/page-intent.collection.js';
import ReportCollection from '../report/report.collection.js';
import TrialUserCollection from '../trial-user/trial-user.collection.js';
import TrialUserActivityCollection from '../trial-user-activity/trial-user-activity.collection.js';

import ApiKeySchema from '../api-key/api-key.schema.js';
import AsyncJobSchema from '../async-job/async-job.schema.js';
import AuditSchema from '../audit/audit.schema.js';
import ConfigurationSchema from '../configuration/configuration.schema.js';
import EntitlementSchema from '../entitlement/entitlement.schema.js';
import FixEntitySchema from '../fix-entity/fix-entity.schema.js';
import ExperimentSchema from '../experiment/experiment.schema.js';
import ImportJobSchema from '../import-job/import-job.schema.js';
import ImportUrlSchema from '../import-url/import-url.schema.js';
import KeyEventSchema from '../key-event/key-event.schema.js';
import LatestAuditSchema from '../latest-audit/latest-audit.schema.js';
import OpportunitySchema from '../opportunity/opportunity.schema.js';
import OrganizationSchema from '../organization/organization.schema.js';
import ScrapeJobSchema from '../scrape-job/scrape-job.schema.js';
import ScrapeUrlSchema from '../scrape-url/scrape-url.schema.js';
import SiteSchema from '../site/site.schema.js';
import SiteCandidateSchema from '../site-candidate/site-candidate.schema.js';
import SiteEnrollmentSchema from '../site-enrollment/site-enrollment.schema.js';
import SiteTopFormSchema from '../site-top-form/site-top-form.schema.js';
import SiteTopPageSchema from '../site-top-page/site-top-page.schema.js';
import SuggestionSchema from '../suggestion/suggestion.schema.js';
import PageIntentSchema from '../page-intent/page-intent.schema.js';
import ReportSchema from '../report/report.schema.js';
import TrialUserSchema from '../trial-user/trial-user.schema.js';
import TrialUserActivitySchema from '../trial-user-activity/trial-user-activity.schema.js';

/**
 * EntityRegistry - A registry class responsible for managing entities, their schema and collection.
 *
 * @class EntityRegistry
 */
class EntityRegistry {
  static entities = {};

  /**
   * Constructs an instance of EntityRegistry.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage entities.
   * @param {Object} log - A logger for capturing and logging information.
   */
  constructor(service, log) {
    this.service = service;
    this.log = log;
    this.collections = new Map();

    this.#initialize();
  }

  /**
   * Initializes the collections managed by the EntityRegistry.
   * This method creates instances of each collection and stores them in an internal map.
   * @private
   */
  #initialize() {
    Object.values(EntityRegistry.entities).forEach(({ collection: Collection, schema }) => {
      const collection = new Collection(this.service, this, schema, this.log);
      this.collections.set(Collection.name, collection);
    });

    this.#logIndexes();
  }

  #logIndexes() {
    // reduce collection schema indexes into object
    const indexes = Object.values(EntityRegistry.entities).reduce((acc, { schema }) => {
      acc[schema.getEntityName()] = schema.indexes;
      return acc;
    }, {});

    this.log.debug('Indexes:', JSON.stringify(indexes, null, 2));
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {DataAccessError} - Throws an error if the collection with the
   * specified name is not found.
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new DataAccessError(`Collection ${collectionName} not found`, this);
    }
    return collection;
  }

  getCollections() {
    const collections = {};
    for (const [key, value] of this.collections) {
      collections[collectionNameToEntityName(key)] = value;
    }
    return collections;
  }

  static getEntities() {
    return Object.keys(this.entities).reduce((acc, key) => {
      acc[key] = this.entities[key].schema.toElectroDBSchema();
      return acc;
    }, {});
  }

  static registerEntity(schema, collection) {
    this.entities[decapitalize(schema.getEntityName())] = { schema, collection };
  }
}

EntityRegistry.registerEntity(ApiKeySchema, ApiKeyCollection);
EntityRegistry.registerEntity(AsyncJobSchema, AsyncJobCollection);
EntityRegistry.registerEntity(AuditSchema, AuditCollection);
EntityRegistry.registerEntity(ConfigurationSchema, ConfigurationCollection);
EntityRegistry.registerEntity(EntitlementSchema, EntitlementCollection);
EntityRegistry.registerEntity(FixEntitySchema, FixEntityCollection);
EntityRegistry.registerEntity(ExperimentSchema, ExperimentCollection);
EntityRegistry.registerEntity(ImportJobSchema, ImportJobCollection);
EntityRegistry.registerEntity(ImportUrlSchema, ImportUrlCollection);
EntityRegistry.registerEntity(KeyEventSchema, KeyEventCollection);
EntityRegistry.registerEntity(LatestAuditSchema, LatestAuditCollection);
EntityRegistry.registerEntity(OpportunitySchema, OpportunityCollection);
EntityRegistry.registerEntity(OrganizationSchema, OrganizationCollection);
EntityRegistry.registerEntity(ScrapeJobSchema, ScrapeJobCollection);
EntityRegistry.registerEntity(ScrapeUrlSchema, ScrapeUrlCollection);
EntityRegistry.registerEntity(SiteSchema, SiteCollection);
EntityRegistry.registerEntity(SiteCandidateSchema, SiteCandidateCollection);
EntityRegistry.registerEntity(SiteEnrollmentSchema, SiteEnrollmentCollection);
EntityRegistry.registerEntity(SiteTopFormSchema, SiteTopFormCollection);
EntityRegistry.registerEntity(SiteTopPageSchema, SiteTopPageCollection);
EntityRegistry.registerEntity(SuggestionSchema, SuggestionCollection);
EntityRegistry.registerEntity(PageIntentSchema, PageIntentCollection);
EntityRegistry.registerEntity(ReportSchema, ReportCollection);
EntityRegistry.registerEntity(TrialUserSchema, TrialUserCollection);
EntityRegistry.registerEntity(TrialUserActivitySchema, TrialUserActivityCollection);

export default EntityRegistry;
