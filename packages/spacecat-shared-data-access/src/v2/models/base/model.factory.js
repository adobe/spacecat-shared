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

import ApiKeyCollection from '../api-key/api-key.collection.js';
import AuditCollection from '../audit/audit.collection.js';
import ConfigurationCollection from '../configuration/configuration.collection.js';
import ExperimentCollection from '../experiment/experiment.collection.js';
import ImportJobCollection from '../import-job/import-job.collection.js';
import ImportUrlCollection from '../import-url/import-url.collection.js';
import KeyEventCollection from '../key-event/key-event.collection.js';
import OpportunityCollection from '../opportunity/opportunity.collection.js';
import OrganizationCollection from '../organization/organization.collection.js';
import SiteCandidateCollection from '../site-candidate/site-candidate.collection.js';
import SiteCollection from '../site/site.collection.js';
import SiteTopPageCollection from '../site-top-page/site-top-page.collection.js';
import SuggestionCollection from '../suggestion/suggestion.collection.js';

import ApiKeySchema from '../api-key/api-key.schema.js';
import AuditSchema from '../audit/audit.schema.js';
import ConfigurationSchema from '../configuration/configuration.schema.js';
import ExperimentSchema from '../experiment/experiment.schema.js';
import ImportJobSchema from '../import-job/import-job.schema.js';
import ImportUrlSchema from '../import-url/import-url.schema.js';
import KeyEventSchema from '../key-event/key-event.schema.js';
import OpportunitySchema from '../opportunity/opportunity.schema.js';
import OrganizationSchema from '../organization/organization.schema.js';
import SiteSchema from '../site/site.schema.js';
import SiteCandidateSchema from '../site-candidate/site-candidate.schema.js';
import SiteTopPageSchema from '../site-top-page/site-top-page.schema.js';
import SuggestionSchema from '../suggestion/suggestion.schema.js';
import { collectionNameToEntityName } from '../../util/util.js';

export const ENTITIES = {
  apiKey: { schema: ApiKeySchema, collection: ApiKeyCollection },
  audit: { schema: AuditSchema, collection: AuditCollection },
  configuration: { schema: ConfigurationSchema, collection: ConfigurationCollection },
  experiment: { schema: ExperimentSchema, collection: ExperimentCollection },
  importJob: { schema: ImportJobSchema, collection: ImportJobCollection },
  importUrl: { schema: ImportUrlSchema, collection: ImportUrlCollection },
  keyEvent: { schema: KeyEventSchema, collection: KeyEventCollection },
  opportunity: { schema: OpportunitySchema, collection: OpportunityCollection },
  organization: { schema: OrganizationSchema, collection: OrganizationCollection },
  site: { schema: SiteSchema, collection: SiteCollection },
  siteCandidate: { schema: SiteCandidateSchema, collection: SiteCandidateCollection },
  siteTopPage: { schema: SiteTopPageSchema, collection: SiteTopPageCollection },
  suggestion: { schema: SuggestionSchema, collection: SuggestionCollection },
}; // todo: could be established by enumerating files in the schema directory

/**
 * ModelFactory - A factory class responsible for creating and managing collections
 * of different models. This class serves as a centralized point for accessing and
 * instantiating model collections.
 *
 * @class ModelFactory
 */
class ModelFactory {
  /**
   * Constructs an instance of ModelFactory.
   * @constructor
   * @param {Object} service - The ElectroDB service instance used to manage entities.
   * @param {Object} logger - A logger for capturing and logging information.
   */
  constructor(service, logger) {
    this.service = service;
    this.logger = logger;
    this.collections = new Map();

    this.#initialize();
  }

  /**
   * Initializes the collections managed by the ModelFactory.
   * This method creates instances of each collection and stores them in an internal map.
   * @private
   */
  #initialize() {
    Object.values(ENTITIES).forEach(({ collection: Collection }) => {
      const collection = new Collection(this.service, this, this.logger);
      this.collections.set(Collection.name, collection);
    });
  }

  /**
   * Gets a collection instance by its name.
   * @param {string} collectionName - The name of the collection to retrieve.
   * @returns {Object} - The requested collection instance.
   * @throws {Error} - Throws an error if the collection with the specified name is not found.
   */
  getCollection(collectionName) {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
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
    return Object.keys(ENTITIES).reduce((acc, key) => {
      acc[key] = ENTITIES[key].schema;
      return acc;
    }, {});
  }
}

export default ModelFactory;
