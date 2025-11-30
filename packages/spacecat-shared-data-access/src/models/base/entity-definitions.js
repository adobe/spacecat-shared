/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { decapitalize } from '../../util/util.js';

// Import all schemas
import ApiKeySchema from '../api-key/api-key.schema.js';
import AsyncJobSchema from '../async-job/async-job.schema.js';
import AuditSchema from '../audit/audit.schema.js';
import ConfigurationSchema from '../configuration/configuration.schema.js';
import EntitlementSchema from '../entitlement/entitlement.schema.js';
import FixEntitySchema from '../fix-entity/fix-entity.schema.js';
import FixEntitySuggestionSchema from '../fix-entity-suggestion/fix-entity-suggestion.schema.js';
import ExperimentSchema from '../experiment/experiment.schema.js';
import ImportJobSchema from '../import-job/import-job.schema.js';
import ImportUrlSchema from '../import-url/import-url.schema.js';
import KeyEventSchema from '../key-event/key-event.schema.js';
import LatestAuditSchema from '../latest-audit/latest-audit.schema.js';
import OpportunitySchema from '../opportunity/opportunity.schema.js';
import OrganizationSchema from '../organization/organization.schema.js';
import ProjectSchema from '../project/project.schema.js';
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
import PageCitabilitySchema from '../page-citability/page-citability.schema.js';

// Import all collections
import ApiKeyCollection from '../api-key/api-key.collection.js';
import AsyncJobCollection from '../async-job/async-job.collection.js';
import AuditCollection from '../audit/audit.collection.js';
import ConfigurationCollection from '../configuration/configuration.collection.js';
import EntitlementCollection from '../entitlement/entitlement.collection.js';
import FixEntityCollection from '../fix-entity/fix-entity.collection.js';
import FixEntitySuggestionCollection from '../fix-entity-suggestion/fix-entity-suggestion.collection.js';
import ExperimentCollection from '../experiment/experiment.collection.js';
import ImportJobCollection from '../import-job/import-job.collection.js';
import ImportUrlCollection from '../import-url/import-url.collection.js';
import KeyEventCollection from '../key-event/key-event.collection.js';
import LatestAuditCollection from '../latest-audit/latest-audit.collection.js';
import OpportunityCollection from '../opportunity/opportunity.collection.js';
import OrganizationCollection from '../organization/organization.collection.js';
import ProjectCollection from '../project/project.collection.js';
import ScrapeJobCollection from '../scrape-job/scrape-job.collection.js';
import ScrapeUrlCollection from '../scrape-url/scrape-url.collection.js';
import SiteCollection from '../site/site.collection.js';
import SiteCandidateCollection from '../site-candidate/site-candidate.collection.js';
import SiteEnrollmentCollection from '../site-enrollment/site-enrollment.collection.js';
import SiteTopFormCollection from '../site-top-form/site-top-form.collection.js';
import SiteTopPageCollection from '../site-top-page/site-top-page.collection.js';
import SuggestionCollection from '../suggestion/suggestion.collection.js';
import PageIntentCollection from '../page-intent/page-intent.collection.js';
import ReportCollection from '../report/report.collection.js';
import TrialUserCollection from '../trial-user/trial-user.collection.js';
import TrialUserActivityCollection from '../trial-user-activity/trial-user-activity.collection.js';
import PageCitabilityCollection from '../page-citability/page-citability.collection.js';

/**
 * Central registry of all entity definitions.
 * This is a plain constant array with no side effects.
 * Each entry pairs a schema with its collection class.
 */
export const ENTITY_DEFINITIONS = [
  { schema: ApiKeySchema, collection: ApiKeyCollection },
  { schema: AsyncJobSchema, collection: AsyncJobCollection },
  { schema: AuditSchema, collection: AuditCollection },
  { schema: ConfigurationSchema, collection: ConfigurationCollection },
  { schema: EntitlementSchema, collection: EntitlementCollection },
  { schema: FixEntitySchema, collection: FixEntityCollection },
  { schema: FixEntitySuggestionSchema, collection: FixEntitySuggestionCollection },
  { schema: ExperimentSchema, collection: ExperimentCollection },
  { schema: ImportJobSchema, collection: ImportJobCollection },
  { schema: ImportUrlSchema, collection: ImportUrlCollection },
  { schema: KeyEventSchema, collection: KeyEventCollection },
  { schema: LatestAuditSchema, collection: LatestAuditCollection },
  { schema: OpportunitySchema, collection: OpportunityCollection },
  { schema: OrganizationSchema, collection: OrganizationCollection },
  { schema: ProjectSchema, collection: ProjectCollection },
  { schema: ScrapeJobSchema, collection: ScrapeJobCollection },
  { schema: ScrapeUrlSchema, collection: ScrapeUrlCollection },
  { schema: SiteSchema, collection: SiteCollection },
  { schema: SiteCandidateSchema, collection: SiteCandidateCollection },
  { schema: SiteEnrollmentSchema, collection: SiteEnrollmentCollection },
  { schema: SiteTopFormSchema, collection: SiteTopFormCollection },
  { schema: SiteTopPageSchema, collection: SiteTopPageCollection },
  { schema: SuggestionSchema, collection: SuggestionCollection },
  { schema: PageIntentSchema, collection: PageIntentCollection },
  { schema: ReportSchema, collection: ReportCollection },
  { schema: TrialUserSchema, collection: TrialUserCollection },
  { schema: TrialUserActivitySchema, collection: TrialUserActivityCollection },
  { schema: PageCitabilitySchema, collection: PageCitabilityCollection },
];

/**
 * Converts entity definitions to ElectroDB schema format.
 * This is a pure function with no side effects.
 *
 * @returns {Object} Map of entity names to ElectroDB schemas
 */
export function getEntitySchemas() {
  return ENTITY_DEFINITIONS.reduce((acc, { schema }) => {
    acc[decapitalize(schema.getEntityName())] = schema.toElectroDBSchema();
    return acc;
  }, {});
}
