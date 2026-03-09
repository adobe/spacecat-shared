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

import type PostgrestClient from '@supabase/postgrest-js/dist/cjs/PostgrestClient';

import type { ApiKeyCollection } from '../models/api-key';
import type { AsyncJobCollection } from '../models/async-job';
import type { AuditCollection } from '../models/audit';
import type { AuditUrlCollection } from '../models/audit-url';
import type { ConfigurationCollection } from '../models/configuration';
import type { ConsumerCollection } from '../models/consumer';
import type { EntitlementCollection } from '../models/entitlement';
import type { ExperimentCollection } from '../models/experiment';
import type { FixEntityCollection } from '../models/fix-entity';
import type { FixEntitySuggestionCollection } from '../models/fix-entity-suggestion';
import type { ImportJobCollection } from '../models/import-job';
import type { ImportUrlCollection } from '../models/import-url';
import type { KeyEventCollection } from '../models/key-event';
import type { LatestAuditCollection } from '../models/latest-audit';
import type { OpportunityCollection } from '../models/opportunity';
import type { OrganizationCollection } from '../models/organization';
import type { PageCitabilityCollection } from '../models/page-citability';
import type { PageIntentCollection } from '../models/page-intent';
import type { PlgOnboardingCollection } from '../models/plg-onboarding';
import type { ProjectCollection } from '../models/project';
import type { ReportCollection } from '../models/report';
import type { ScrapeJobCollection } from '../models/scrape-job';
import type { ScrapeUrlCollection } from '../models/scrape-url';
import type { SentimentGuidelineCollection } from '../models/sentiment-guideline';
import type { SentimentTopicCollection } from '../models/sentiment-topic';
import type { SiteCollection } from '../models/site';
import type { SiteCandidateCollection } from '../models/site-candidate';
import type { SiteEnrollmentCollection } from '../models/site-enrollment';
import type { SiteTopFormCollection } from '../models/site-top-form';
import type { SiteTopPageCollection } from '../models/site-top-page';
import type { SuggestionCollection } from '../models/suggestion';
import type { TrialUserCollection } from '../models/trial-user';
import type { TrialUserActivityCollection } from '../models/trial-user-activity';

interface DataAccessConfig {
  postgrestUrl: string;
  postgrestSchema?: string;
  postgrestApiKey?: string;
  postgrestHeaders?: object;
  s3Bucket?: string;
  region?: string;
}

export interface DataAccessServices {
  postgrestClient: PostgrestClient;
}

export interface DataAccess {
  services: DataAccessServices;
  ApiKey: ApiKeyCollection;
  AsyncJob: AsyncJobCollection;
  Audit: AuditCollection;
  AuditUrl: AuditUrlCollection;
  Configuration: ConfigurationCollection;
  Consumer: ConsumerCollection;
  Entitlement: EntitlementCollection;
  Experiment: ExperimentCollection;
  FixEntity: FixEntityCollection;
  FixEntitySuggestion: FixEntitySuggestionCollection;
  ImportJob: ImportJobCollection;
  ImportUrl: ImportUrlCollection;
  KeyEvent: KeyEventCollection;
  LatestAudit: LatestAuditCollection;
  Opportunity: OpportunityCollection;
  Organization: OrganizationCollection;
  PageCitability: PageCitabilityCollection;
  PageIntent: PageIntentCollection;
  PlgOnboarding: PlgOnboardingCollection;
  Project: ProjectCollection;
  Report: ReportCollection;
  ScrapeJob: ScrapeJobCollection;
  ScrapeUrl: ScrapeUrlCollection;
  SentimentGuideline: SentimentGuidelineCollection;
  SentimentTopic: SentimentTopicCollection;
  Site: SiteCollection;
  SiteCandidate: SiteCandidateCollection;
  SiteEnrollment: SiteEnrollmentCollection;
  SiteTopForm: SiteTopFormCollection;
  SiteTopPage: SiteTopPageCollection;
  Suggestion: SuggestionCollection;
  TrialUser: TrialUserCollection;
  TrialUserActivity: TrialUserActivityCollection;
}

export function createDataAccess(
  config: DataAccessConfig,
  logger: object,
  client?: object,
): DataAccess;
