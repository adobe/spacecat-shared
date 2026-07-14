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

import type {
  Audit,
  BaseCollection,
  BaseModel,
  Experiment,
  KeyEvent,
  LatestAudit,
  Opportunity,
  Organization,
  Project,
  SiteCandidate,
  SiteEnrollment,
  SiteTopPage,
} from '../index.js';

export interface HlxConfig {
  hlxVersion: number; // helix (AEM Edge Delivery) major version
  rso: { // remote source origin configuration
    ref: string; // vcs (ie github) branch name
    site: string; // vcs (ie github) repo name
    owner: string; // vcs (ie github) owner (organization)
  };
}

/**
 * One entry per submodule declared in the parent repo's `.gitmodules`.
 * Each row carries both the importer-detected facts (declared section,
 * original URL, external flag) and any onboarding-resolved CM URL the
 * cm-client uses at clone/pull time to rewrite `.git/config`.
 *
 * Lifecycle:
 *   - Importer-written fields (`sectionName`, `gitmodulesUrl`, `external`)
 *     are refreshed on every import. Entries whose `sectionName` is no
 *     longer present in the parent's `.gitmodules` are dropped.
 *   - Onboarding-written fields (`resolvedUrl`) are preserved across
 *     imports for surviving entries — the importer cannot re-derive
 *     them (no CM Management API access from Lambda) and onboarding
 *     refreshes them out-of-band.
 */
export interface SubmoduleEntry {
  /**
   * The `<X>` from `[submodule "<X>"]` in `.gitmodules`. Used by
   * cm-client as the `.git/config` key when rewriting URLs (i.e.
   * `submodule.<sectionName>.url`). In every customer `.gitmodules`
   * we've seen this matches the `path = …` value, but git's lookup
   * is by section name so we capture it here.
   */
  sectionName: string;
  /**
   * The submodule URL exactly as declared in `.gitmodules`, with
   * basic-auth credentials stripped from https/http forms. Relative
   * (`../foo.git`) and SSH (`git@host:path`) forms are preserved as-is.
   */
  gitmodulesUrl: string;
  /**
   * True when this submodule's URL points to a host other than the
   * parent repo's host. Relative URLs (`../foo.git`) and SSH URLs
   * targeting the parent's host classify as internal (`false`).
   */
  external: boolean;
  /**
   * BYOG-only. Onboarding-populated URL the cm-client writes into
   * `.git/config submodule.<sectionName>.url` at clone/pull time.
   *
   * The CM repo service proxies BYOG clones through URLs of the form
   * `{CM_REPO_URL}/api/program/{programId}/repository/{numericId}.git`.
   * When `.gitmodules` uses relative or SSH URLs, git resolves them to
   * paths the proxy can't serve. The cm-client rewrites each submodule's
   * `.git/config` URL to a CM-reachable form before running
   * `git submodule update`. `.gitmodules` itself is never modified.
   *
   * URL form depends on the underlying repo type, decided at onboarding:
   *   - BYOG (`github`/`gitlab`/`bitbucket`/`azure_devops`):
   *       `{cmRepoUrl}/api/program/{programId}/repository/{numericId}.git`
   *   - `standard`:
   *       `https://git.cloudmanager.adobe.com/{orgName}/{repoName}/`
   *
   * The cm-client picks the auth scope to apply by parsing each
   * `resolvedUrl`'s host. URLs on the CM proxy host get
   * Bearer + x-api-key + x-gw-ims-org-id; URLs on
   * `https://git.cloudmanager.adobe.com/{orgName}/` get Basic auth
   * from `CM_STANDARD_REPO_CREDENTIALS[programId]` scoped to the org
   * prefix.
   *
   * Absent when:
   *   - the parent is `standard` (cm-client takes the native
   *     `--recurse-submodules` path and ignores this array entirely),
   *   - this submodule is `external` to a host outside CM's reach,
   *   - onboarding hasn't run for this site yet.
   *
   * When absent on a BYOG parent, cm-client logs a warning and skips
   * that submodule during `submodule update`.
   */
  resolvedUrl?: string;
}

/**
 * Per-submodule list captured during code import. Empty array when the
 * cloned repo has no `.gitmodules` file (and therefore no submodules).
 */
export type SubmodulesMetadata = SubmoduleEntry[];

/**
 * Metadata extracted during code import. Consumers should assume an
 * empty object when a field is absent.
 */
export interface CodeMetadata {
  submodules?: SubmodulesMetadata;
}

export interface CodeConfig {
  type: string;
  owner: string;
  repo: string;
  ref: string;
  installationId?: string;
  url: string;
  /**
   * S3 key (not full URL) where the imported repository ZIP is stored.
   * Written by the code importer after successful ingestion.
   */
  s3StoragePath?: string;
  /**
   * Metadata extracted from the cloned repository. Always overwritten
   * on each successful import — a re-import that finds no submodules
   * clears any submodule entries from an earlier import.
   */
  metadata?: CodeMetadata;
}

export interface DeliveryConfig {
  programId?: string;
  environmentId?: string;
  authorURL?: string;
  siteId?: string;
  tenantId?: string;
  ipAllowlistExists?: boolean;
  imsOrgId?: string;
  contentSourcePath?: string;
  [key: string]: unknown;
}

export type IMPORT_TYPES = {
  readonly ORGANIC_KEYWORDS: 'organic-keywords';
  readonly ORGANIC_TRAFFIC: 'organic-traffic';
  readonly TOP_PAGES: 'top-pages';
  readonly AHREF_PAID_PAGES: 'ahref-paid-pages';
  readonly TOP_FORMS: 'top-forms';
};

export type IMPORT_DESTINATIONS = {
  readonly DEFAULT: 'default';
};

export type IMPORT_SOURCES = {
  readonly SEO: 'seo';
  readonly GSC: 'google';
};

export type ImportType = 'organic-keywords' | 'organic-traffic' | 'top-pages' | 'top-forms' | 'ahref-paid-pages' ;
export type ImportDestination = 'default';
export type ImportSource = 'seo' | 'google';

export interface ImportConfig {
  type: ImportType;
  destinations: ImportDestination[];
  sources: ImportSource[];
  enabled: boolean;
  pageUrl?: string;
  geo?: string;
  limit?: number;
}

export type WellKnownLmmoTag = 'market' | 'product' | 'topic';
export type LmmoTag = `${WellKnownLmmoTag}:${string}` | string;

export interface LlmoQuestion {
  key: string;
  question: string;
  source?: string;
  volume?: string;
  importTime?: string;
  keyword?: string;
  url?: string;
  tags?: LmmoTag[];
}

export interface LlmoUrlPattern {
  urlPattern: string;
  tags?: LmmoTag[];
}

export interface LlmoCustomerIntent {
  key: string;
  value: string;
}

export type AuditTargetSource = 'manual' | 'moneyPages';

export interface AuditTargetEntry {
  url: string;
}

export interface AuditTargetEntryWithSource extends AuditTargetEntry {
  source: AuditTargetSource;
}

export interface AuditTargetURLs {
  manual?: AuditTargetEntry[];
  moneyPages?: AuditTargetEntry[];
}

export interface SiteConfig {
  state: {
    slack?: {
      workspace?: string;
      channel?: string;
      invitedUserCount?: number;
    };
    imports?: ImportConfig[];
    auditTargetURLs?: AuditTargetURLs;
    handlers?: Record<string, {
      mentions?: Record<string, string[]>;
      excludedURLs?: string[];
      autofixExcludedURLs?: string[];
      manualOverwrites?: Array<{
        brokenTargetURL?: string;
        targetURL?: string;
      }>;
      fixedURLs?: Array<{
        brokenTargetURL?: string;
        targetURL?: string;
      }>;
      includedURLs?: string[];
      groupedURLs?: Array<{
        name: string;
        pattern: string;
      }>;
      latestMetrics?: {
        pageViewsChange: number;
        ctrChange: number;
        projectedTrafficValue: number;
      };
      movingAvgThreshold?: number;
      percentageChangeThreshold?: number;
    }>;
    fetchConfig?: {
      headers?: Record<string, string>;
      overrideBaseURL?: string;
    };
    llmo?: {
      dataFolder: string;
      brand: string;
      questions?: {
        Human?: Array<LlmoQuestion>;
        AI?: Array<LlmoQuestion>;
      };
      urlPatterns?: Array<LlmoUrlPattern>;
      customerIntent?: Array<LlmoCustomerIntent>;
    };
    onboardConfig?: {
      lastProfile?: string;
      lastStartTime?: number;
      forcedOverride?: boolean;
      history?: Array<{ profile?: string; startTime?: number }>;
    };
  };
  extractWellKnownTags(tags: Array<string>): Partial<Record<WellKnownLmmoTag, string>>;
  getSlackConfig(): { workspace?: string; channel?: string; invitedUserCount?: number };
  getImports(): ImportConfig[];
  getImportConfig(type: ImportType): ImportConfig | undefined;
  isImportEnabled(type: ImportType): boolean;
  enableImport(type: ImportType, config?: Partial<ImportConfig>): void;
  disableImport(type: ImportType): void;
  getHandlers(): Record<string, object>;
  getHandlerConfig(type: string): object;
  getSlackMentions(type: string): string[] | undefined;
  getExcludedURLs(type: string): string[] | undefined;
  getAutofixExcludedURLs(type: string): string[] | undefined;
  getManualOverwrites(type: string):
    Array<{ brokenTargetURL?: string; targetURL?: string }> | undefined;
  getFixedURLs(type: string): Array<{ brokenTargetURL?: string; targetURL?: string }> | undefined;
  getIncludedURLs(type: string): string[] | undefined;
  getGroupedURLs(type: string): Array<{ name: string; pattern: string }> | undefined;
  getLatestMetrics(type: string):
    { pageViewsChange: number; ctrChange: number; projectedTrafficValue: number } | undefined;
  getFetchConfig(): { headers?: Record<string, string>, overrideBaseURL?: string } | undefined;
  getLlmoConfig(): {
    dataFolder: string;
    brand: string;
    questions?: { Human?: Array<LlmoQuestion>; AI?: Array<LlmoQuestion> };
    urlPatterns?: Array<LlmoUrlPattern>;
    customerIntent?: Array<LlmoCustomerIntent>;
  } | undefined;
  updateLlmoConfig(dataFolder: string, brand: string, questions?: {
    Human?: Array<LlmoQuestion>;
    AI?: Array<LlmoQuestion>;
  }, urlPatterns?: Array<LlmoUrlPattern>): void;
  updateLlmoDataFolder(dataFolder: string): void;
  updateLlmoBrand(brand: string): void;
  getLlmoDataFolder(): string | undefined;
  getLlmoBrand(): string | undefined;
  getLlmoHumanQuestions(): LlmoQuestion[] | undefined;
  getLlmoAIQuestions(): LlmoQuestion[] | undefined;
  getLlmoUrlPatterns(): Array<LlmoUrlPattern> | undefined;
  addLlmoHumanQuestions(questions: LlmoQuestion[]): void;
  addLlmoAIQuestions(questions: LlmoQuestion[]): void;
  removeLlmoQuestion(key: string): void;
  updateLlmoQuestion(key: string, questionUpdate: Partial<LlmoQuestion>): void;
  addLlmoUrlPatterns(urlPatterns: Array<LlmoUrlPattern>): void;
  removeLlmoUrlPattern(urlPattern: string): void;
  getLlmoCustomerIntent(): Array<LlmoCustomerIntent>;
  addLlmoCustomerIntent(customerIntentItems: Array<LlmoCustomerIntent>): void;
  removeLlmoCustomerIntent(intentKey: string): void;
  updateLlmoCustomerIntent(intentKey: string, updateData: Partial<LlmoCustomerIntent>): void;
  addLlmoTag(tag: string): void;
  removeLlmoTag(tag: string): void;
  getOnboardConfig(): { lastProfile?: string; lastStartTime?: number; forcedOverride?: boolean; history?: Array<{ profile?: string; startTime?: number }> } | undefined;
  updateOnboardConfig(onboardConfig: { lastProfile?: string; lastStartTime?: number; forcedOverride?: boolean }, options?: { maxHistory?: number }): void;
  getAuditTargetURLs(): AuditTargetEntryWithSource[];
  getAuditTargetURLsBySource(source: AuditTargetSource): AuditTargetEntry[];
  updateAuditTargetURLs(source: AuditTargetSource, urls: AuditTargetEntry[]): void;
  addAuditTargetURL(source: AuditTargetSource, urlObj: AuditTargetEntry): void;
  removeAuditTargetURL(source: AuditTargetSource, url: string): void;
}

export interface Site extends BaseModel {
  getAudits(): Promise<Audit>;
  getAuditsByAuditType(auditType: string): Promise<Audit>;
  getAuditsByAuditTypeAndAuditedAt(auditType: string, auditedAt: string): Promise<Audit>;
  getBaseURL(): string;
  getName(): string;
  getConfig(): SiteConfig;
  getDeliveryType(): string;
  getAuthoringType(): string;
  getExperiments(): Promise<Experiment[]>;
  getExperimentsByExpId(expId: string): Promise<Experiment[]>;
  getExperimentsByExpIdAndUrl(expId: string, url: string): Promise<Experiment[]>;
  getExperimentsByExpIdAndUrlAndUpdatedAt(
    expId: string, url: string, updatedAt: string
  ): Promise<Experiment[]>;
  getGitHubURL(): string;
  getHlxConfig(): HlxConfig;
  getCode(): CodeConfig;
  getDeliveryConfig(): object;
  getIsLive(): boolean;
  getIsSandbox(): boolean;
  getIsLiveToggledAt(): string;
  getKeyEvents(): Promise<KeyEvent[]>
  getKeyEventsByTimestamp(timestamp: string): Promise<KeyEvent[]>
  getLatestAudit(): Promise<LatestAudit>;
  getLatestAudits(): Promise<LatestAudit>;
  getLatestAuditByAuditType(auditType: string): Promise<LatestAudit>;
  getOpportunities(): Promise<Opportunity[]>;
  getOpportunitiesByStatus(status: string): Promise<Opportunity[]>;
  getOpportunitiesByStatusAndUpdatedAt(status: string, updatedAt: string): Promise<Opportunity[]>;
  getOrganization(): Promise<Organization>;
  getOrganizationId(): string;
  getProject(): Promise<Project>;
  getProjectId(): string;
  getIsPrimaryLocale(): boolean;
  getLanguage(): string;
  getRegion(): string;
  getSiteCandidates(): Promise<SiteCandidate[]>;
  getSiteEnrollments(): Promise<SiteEnrollment[]>;
  getSiteTopPages(): Promise<SiteTopPage[]>;
  getSiteTopPagesBySource(source: string): Promise<SiteTopPage[]>;
  getSiteTopPagesBySourceAndGeo(source: string, geo: string): Promise<SiteTopPage[]>;
  getSiteTopPagesBySourceAndGeoAndTraffic(
    source: string, geo: string, traffic: string
  ): Promise<SiteTopPage[]>;
  setBaseURL(baseURL: string): Site;
  setName(name: string): Site;
  setConfig(config: object): Site;
  setDeliveryType(deliveryType: string): Site;
  setAuthoringType(authoringType: string): Site;
  setGitHubURL(gitHubURL: string): Site;
  setHlxConfig(hlxConfig: HlxConfig): Site;
  setCode(code: CodeConfig): Site;
  setDeliveryConfig(deliveryConfig: object): Site;
  setIsLive(isLive: boolean): Site;
  setIsSandbox(isSandbox: boolean): Site;
  setIsLiveToggledAt(isLiveToggledAt: string): Site;
  setOrganizationId(organizationId: string): Site;
  setProjectId(projectId: string): Site;
  setIsPrimaryLocale(primaryLocale: boolean): Site;
  setLanguage(language: string): Site;
  setRegion(region: string): Site;
  toggleLive(): Site;
}

export interface SiteCollection extends BaseCollection<Site> {
  allByBaseURL(baseURL: string): Promise<Site[]>;
  allByDeliveryType(deliveryType: string): Promise<Site[]>;
  allByOrganizationId(organizationId: string): Promise<Site[]>;
  allByProjectId(projectId: string): Promise<Site[]>;
  allByProjectName(projectName: string): Promise<Site[]>;
  allByOrganizationIdAndProjectId(organizationId: string, projectId: string): Promise<Site[]>;
  allByOrganizationIdAndProjectName(organizationId: string, projectName: string): Promise<Site[]>;
  allSitesToAudit(): Promise<string[]>;
  allWithLatestAudit(auditType: string, order?: string, deliveryType?: string): Promise<Site[]>;
  findByBaseURL(baseURL: string): Promise<Site | null>;
  findByDeliveryType(deliveryType: string): Promise<Site | null>;
  findByOrganizationId(organizationId: string): Promise<Site | null>;
  findByProjectId(projectId: string): Promise<Site | null>;
  findByPreviewURL(previewURL: string): Promise<Site | null>;
  findByExternalOwnerIdAndExternalSiteId(
    externalOwnerId: string, externalSiteId: string
  ): Promise<Site | null>;
  allByExternalOwnerIdAndExternalSiteId(
    externalOwnerId: string, externalSiteId: string
  ): Promise<Site[]>;
}
