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

import { S3Client } from '@aws-sdk/client-s3';

export interface TokawakaPatch {
  op: 'replace' | 'insertAfter' | 'insertBefore' | 'appendChild';
  selector: string;
  value: string | object;
  valueFormat: 'text' | 'hast';
  tag?: string;
  currValue?: string;
  target: 'ai-bots' | 'bots' | 'all';
  opportunityId: string;
  suggestionId?: string;
  prerenderRequired: boolean;
  lastUpdated: number;
}

export const TARGET_USER_AGENTS_CATEGORIES: {
  AI_BOTS: 'ai-bots';
  BOTS: 'bots';
  ALL: 'all';
};

export interface TokowakaMetaconfig {
  siteId: string;
  apiKeys?: string[];
  prerender?: {
    allowList?: string[];
  } | boolean;
}

export interface TokowakaConfig {
  url: string;
  version: string;
  forceFail: boolean;
  prerender: boolean;
  patches: TokawakaPatch[];
}

export interface CdnInvalidationResult {
  status: string;
  provider: string;
  purgeId?: string;
  invalidationId?: string;
  invalidationStatus?: string;
  createTime?: string;
  estimatedSeconds?: number;
  paths?: number;
  totalPaths?: number;
  totalKeys?: number;
  successCount?: number;
  failedCount?: number;
  serviceId?: string;
  duration?: number;
  results?: Array<{
    key: string;
    status: string;
    statusCode?: number;
    error?: string;
  }>;
  message?: string;
  error?: string;
}

export interface DeploymentResult {
  s3Paths: string[];
  cdnInvalidations: CdnInvalidationResult[];
  succeededSuggestions: Array<any>;
  failedSuggestions: Array<{ suggestion: any; reason: string }>;
}

export interface RollbackResult {
  s3Paths: string[];
  cdnInvalidations: CdnInvalidationResult[];
  succeededSuggestions: Array<any>;
  failedSuggestions: Array<{ suggestion: any; reason: string }>;
  removedPatchesCount: number;
}

export interface PreviewResult {
  s3Path: string;
  config: TokowakaConfig;
  cdnInvalidations: CdnInvalidationResult[];
  succeededSuggestions: Array<any>;
  failedSuggestions: Array<{ suggestion: any; reason: string }>;
  html: {
    url: string;
    originalHtml: string;
    optimizedHtml: string;
  };
}

export interface SiteConfig {
  getTokowakaConfig(): {
    apiKey?: string;
    forwardedHost?: string;
  };
  getFetchConfig?(): {
    overrideBaseURL?: string;
  };
}

export interface Site {
  getId(): string;
  getBaseURL(): string;
  getConfig(): SiteConfig;
}

export interface Opportunity {
  getId(): string;
  getType(): string;
}

export interface Suggestion {
  getId(): string;
  getData(): Record<string, any>;
  getUpdatedAt(): string;
}

export interface FastlyKVEntry {
  key: string;
  suggestionId: string;
  url: string;
}

export class FastlyKVClient {
  constructor(env: {
    FASTLY_KV_STORE_ID: string;
    FASTLY_API_TOKEN: string;
    FASTLY_KV_TIMEOUT?: number;
  }, log: any);

  listAllStaleKeys(options?: {
    pageSize?: number;
    maxPages?: number;
  }): Promise<FastlyKVEntry[]>;
}

/**
 * Compute the forwarded host for edge optimize (bare domain → www; subdomains unchanged).
 * @param url - Full base URL (e.g. https://example.com)
 * @param logger - Optional logger with debug and error methods
 * @returns Host to use (e.g. www.example.com)
 */
export function calculateForwardedHost(url: string, logger?: { debug?: (msg: string) => void; error?: (msg: string) => void }): string;

/**
 * Temporary AWS credentials returned by {@link assumeConnectorRole}.
 */
export interface EdgeOptimizeCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}

/**
 * One row of the Edge Optimize deploy/plan step contract.
 */
export interface EdgeOptimizeStep {
  key: string;
  label: string;
  status?: string;
  action?: string;
  detail?: string;
  probe?: Record<string, any>;
}

// ── CloudFront "Optimize at Edge" control-plane (free functions) ──────────────

/**
 * Assume the customer's cross-account connector role and return short-lived credentials.
 */
export function assumeConnectorRole(params: {
  accountId: string;
  externalId: string;
  roleName?: string;
  region?: string;
}): Promise<{ roleArn: string; accountId: string; credentials: EdgeOptimizeCredentials }>;

/**
 * List the CloudFront distributions in the customer account using assumed-role credentials.
 */
export function listCloudFrontDistributions(
  credentials: EdgeOptimizeCredentials,
  region?: string,
): Promise<Array<{
  id: string;
  domainName: string;
  aliases: string[];
  status: string;
  enabled: boolean;
  comment: string;
}>>;

/**
 * Fetch a single CloudFront distribution's configuration using assumed-role credentials.
 */
export function getDistributionConfig(
  credentials: EdgeOptimizeCredentials,
  distributionId: string,
  region?: string,
): Promise<{
  origins: Array<{ id: string; domainName: string; originPath: string }>;
  defaultCacheBehavior: { pathPattern: string; targetOriginId: string } | null;
  cacheBehaviors: Array<{ pathPattern: string; targetOriginId: string }>;
}>;

/**
 * Add the Edge Optimize origin to a CloudFront distribution (idempotent + self-healing).
 */
export function createEdgeOptimizeOrigin(
  credentials: EdgeOptimizeCredentials,
  distributionId: string,
  originDomain?: string,
  headers?: { apiKey?: string; forwardedHost?: string; fetcherKey?: string },
  region?: string,
): Promise<{ created: boolean; alreadyExisted: boolean; updated: boolean; originId: string }>;

/**
 * Create or update the routing CloudFront Function and publish it to LIVE (idempotent).
 */
export function createEdgeOptimizeRoutingFunction(
  credentials: EdgeOptimizeCredentials,
  defaultOriginId: string,
  distributionId: string,
  targetedPaths?: string[] | null,
  region?: string,
): Promise<{ name: string; created: boolean; stage: string }>;

/**
 * Add the Edge Optimize routing headers to the cache key for the target behavior.
 */
export function applyEdgeOptimizeCacheHeaders(
  credentials: EdgeOptimizeCredentials,
  distributionId: string,
  pathPattern: string,
  opts?: { setMinTTLZero?: boolean; region?: string },
): Promise<{
  scenario: string;
  policyId: string | null;
  updated: boolean;
  alreadyForwarded: boolean;
  reused?: boolean;
}>;

/**
 * Create (or update) the Edge Optimize Lambda@Edge function and publish a version (idempotent).
 */
export function createEdgeOptimizeLambda(
  credentials: EdgeOptimizeCredentials,
  accountId: string,
  opts?: {
    region?: string;
    distributionId?: string;
    originDomain?: string;
    roleWaitMs?: number;
    retryDelayMs?: number;
  },
): Promise<{
  status: string;
  functionArn?: string;
  versionArn: string | null;
  version?: string;
  roleArn: string;
  created: boolean;
  alreadyExisted?: boolean;
}>;

/**
 * Read-only status of the Edge Optimize Lambda@Edge function and its execution role.
 */
export function getEdgeOptimizeLambdaStatus(
  credentials: EdgeOptimizeCredentials,
  distributionId: string,
  region?: string,
): Promise<{
  exists: boolean;
  roleExists: boolean;
  roleOk: boolean;
  state?: string;
  lastUpdateStatus?: string;
  functionArn?: string;
  versionArn: string | null;
  version?: string;
  ready: boolean;
}>;

/**
 * Wire the routing CloudFront Function and the Lambda@Edge function onto a cache behavior.
 */
export function applyEdgeOptimizeAssociations(
  credentials: EdgeOptimizeCredentials,
  distributionId: string,
  pathPattern: string,
  lambdaVersionArn: string,
  region?: string,
): Promise<{ cfFunctionArn: string; lambdaArn: string }>;

/**
 * Verify Edge Optimize routing end-to-end by probing as a bot and as a human.
 */
export function verifyEdgeOptimizeRouting(url: string): Promise<{
  passed: boolean;
  requestId: string | null;
  details: { bot: Record<string, any>; human: Record<string, any> };
}>;

/**
 * Run one poll of the idempotent Edge Optimize "Deploy routing" orchestrator.
 */
export function runEdgeOptimizeDeployStep(
  credentials: EdgeOptimizeCredentials,
  params: {
    distributionId: string;
    originId: string;
    behavior: string;
    originDomain?: string;
    originHeaders?: { apiKey?: string; forwardedHost?: string; fetcherKey?: string };
    accountId: string;
  },
  region?: string,
): Promise<{ routingDeployed: boolean; verified: boolean; steps: EdgeOptimizeStep[] }>;

/**
 * Read-only "preview" of what {@link runEdgeOptimizeDeployStep} would do, without mutating.
 */
export function planEdgeOptimizeDeploy(
  credentials: EdgeOptimizeCredentials,
  params: {
    distributionId: string;
    originId?: string;
    behavior: string;
    originDomain?: string;
    originHeaders?: { apiKey?: string; forwardedHost?: string; fetcherKey?: string };
    accountId?: string;
  },
  region?: string,
): Promise<{ canProceed: boolean; blocker: string | null; steps: EdgeOptimizeStep[] }>;

/**
 * Build the CloudFront Function (viewer-request) routing code.
 */
export function buildRoutingFunctionCode(
  defaultOriginId: string,
  targetedPaths?: string[] | null,
): string;

/**
 * Build the Lambda@Edge origin-request/response handler source code.
 */
export function buildEdgeOptimizeLambdaCode(eoOriginDomain: string): string;

/**
 * Build an in-memory zip containing a single file (used to package the Lambda@Edge code).
 */
export function buildLambdaZip(filename: string, content: string | Buffer): Buffer;

/**
 * Build the per-distribution name for a cache policy cloned from a managed (AWS) policy.
 */
export function buildEoClonedCachePolicyName(sourceName: string, distributionId: string): string;

/** Per-distribution routing CloudFront Function name. */
export function eoRoutingFunctionName(distributionId: string): string;
/** Per-distribution Lambda@Edge function name. */
export function eoLambdaFunctionName(distributionId: string): string;
/** Per-distribution Lambda@Edge execution role name. */
export function eoLambdaRoleName(distributionId: string): string;

export const EDGE_OPTIMIZE_REGION: string;
export const EDGE_OPTIMIZE_DEFAULT_ROLE_NAME: string;
export const EDGE_OPTIMIZE_ORIGIN_ID: string;
export const EDGE_OPTIMIZE_DEFAULT_ORIGIN_DOMAIN: string;
export const EDGE_OPTIMIZE_FUNCTION_NAME: string;
export const EDGE_OPTIMIZE_LAMBDA_FUNCTION_NAME: string;
export const EDGE_OPTIMIZE_LAMBDA_ROLE_NAME: string;
export const EDGE_OPTIMIZE_CACHE_HEADERS: string[];
export const EDGE_OPTIMIZE_CACHE_POLICY_NAME: string;
export const EDGE_OPTIMIZE_MIN_TTL_KEEP_THRESHOLD: number;
export const EDGE_OPTIMIZE_DEPLOY_STEPS: EdgeOptimizeStep[];

/**
 * Base class for opportunity mappers
 * Extend this class to create custom mappers for new opportunity types
 */
export abstract class BaseOpportunityMapper {
  protected log: any;
  
  constructor(log: any);
  
  /**
   * Returns the opportunity type this mapper handles
   */
  abstract getOpportunityType(): string;
  
  /**
   * Determines if prerendering is required for this opportunity type
   */
  abstract requiresPrerender(): boolean;
  
  /**
   * Converts suggestions to Tokowaka patches
   */
  abstract suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string,
    existingConfig: TokowakaConfig | null
  ): TokawakaPatch[];
  
  /**
   * Checks if a suggestion can be deployed for this opportunity type
   * This method should validate all eligibility and data requirements
   */
  abstract canDeploy(suggestion: Suggestion): {
    eligible: boolean;
    reason?: string;
  };
  
  /**
   * Helper method to create base patch structure
   */
  protected createBasePatch(
    suggestion: Suggestion,
    opportunityId: string
  ): Partial<TokawakaPatch>;
}

/**
 * Headings opportunity mapper
 * Handles conversion of heading suggestions (heading-empty, heading-missing-h1, heading-h1-length) to Tokowaka patches
 */
export class HeadingsMapper extends BaseOpportunityMapper {
  constructor(log: any);
  
  getOpportunityType(): string;
  requiresPrerender(): boolean;
  suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string
  ): TokawakaPatch[];
  canDeploy(suggestion: Suggestion): { eligible: boolean; reason?: string };
}

/**
 * Readability opportunity mapper
 * Handles conversion of readability suggestions to Tokowaka patches
 */
export class ReadabilityMapper extends BaseOpportunityMapper {
  constructor(log: any);
  
  getOpportunityType(): string;
  requiresPrerender(): boolean;
  suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string
  ): TokawakaPatch[];
  canDeploy(suggestion: Suggestion): { eligible: boolean; reason?: string };
}

/**
 * Content summarization opportunity mapper
 * Handles conversion of content summarization suggestions to Tokowaka patches with HAST format
 */
export class ContentSummarizationMapper extends BaseOpportunityMapper {
  constructor(log: any);
  
  getOpportunityType(): string;
  requiresPrerender(): boolean;
  suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string
  ): TokawakaPatch[];
  canDeploy(suggestion: Suggestion): { eligible: boolean; reason?: string };
}

/**
 * FAQ opportunity mapper
 * Handles conversion of FAQ suggestions to Tokowaka patches
 */
export class FaqMapper extends BaseOpportunityMapper {
  constructor(log: any);
  
  getOpportunityType(): string;
  requiresPrerender(): boolean;
  canDeploy(suggestion: Suggestion): { eligible: boolean; reason?: string };
  
  /**
   * Creates patches for FAQ suggestions
   * First patch is heading (h2) if it doesn't exist, then individual FAQ divs
   * @throws {Error} if suggestionToPatch is called directly
   */
  suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string,
    existingConfig: TokowakaConfig | null
  ): TokawakaPatch[];
}

/**
 * Table of Contents (TOC) opportunity mapper
 * Handles conversion of TOC suggestions to Tokowaka patches with HAST format
 */
export class TocMapper extends BaseOpportunityMapper {
  constructor(log: any);
  
  getOpportunityType(): string;
  requiresPrerender(): boolean;
  suggestionsToPatches(
    urlPath: string,
    suggestions: Suggestion[],
    opportunityId: string
  ): TokawakaPatch[];
  canDeploy(suggestion: Suggestion): { eligible: boolean; reason?: string };
}

/**
 * Registry for opportunity mappers
 */
export class MapperRegistry {
  constructor(log: any);
  
  registerMapper(MapperClass: typeof BaseOpportunityMapper): void;
  getMapper(opportunityType: string): BaseOpportunityMapper | null;
  getSupportedOpportunityTypes(): string[];
}

/**
 * Base class for CDN clients
 * Extend this class to create custom CDN clients for different providers
 */
export abstract class BaseCdnClient {
  protected env: any;
  protected log: any;
  
  constructor(env: any, log: any);
  
  /**
   * Returns the CDN provider name
   */
  abstract getProviderName(): string;
  
  /**
   * Validates the CDN configuration
   */
  abstract validateConfig(): boolean;
  
  /**
   * Invalidates the CDN cache for the given paths
   */
  abstract invalidateCache(paths: string[]): Promise<CdnInvalidationResult>;
}

/**
 * CloudFront CDN client implementation
 */
export class CloudFrontCdnClient extends BaseCdnClient {
  constructor(env: {
    TOKOWAKA_CDN_CONFIG: string; // JSON string with cloudfront config
  }, log: any);
  
  getProviderName(): string;
  validateConfig(): boolean;
  invalidateCache(paths: string[]): Promise<CdnInvalidationResult>;
}

/**
 * Fastly CDN client implementation
 */
export class FastlyCdnClient extends BaseCdnClient {
  constructor(env: {
    TOKOWAKA_CDN_CONFIG: string; // JSON string with fastly config
  }, log: any);
  
  getProviderName(): string;
  validateConfig(): boolean;
  invalidateCache(paths: string[]): Promise<CdnInvalidationResult>;
}

/**
 * Registry for CDN clients
 */
export class CdnClientRegistry {
  constructor(env: Record<string, any>, log: any);
  
  registerClient(provider: string, ClientClass: typeof BaseCdnClient): void;
  getClient(provider: string): BaseCdnClient | null;
  getSupportedProviders(): string[];
  isProviderSupported(provider: string): boolean;
}

/**
 * Main Tokowaka Client for managing edge optimization configurations
 */
export default class TokowakaClient {
  constructor(config: {
    bucketName: string;
    previewBucketName?: string;
    s3Client: S3Client;
    env?: Record<string, any>;
  }, log: any);
  
  static createFrom(context: {
    env: {
      TOKOWAKA_SITE_CONFIG_BUCKET: string;
      TOKOWAKA_PREVIEW_BUCKET?: string;
      TOKOWAKA_CDN_PROVIDER?: string | string[]; // Single provider or comma-separated list
      TOKOWAKA_CDN_CONFIG?: string; // JSON with cloudfront and/or fastly config
      TOKOWAKA_EDGE_URL?: string;
    };
    log?: any;
    s3: { s3Client: S3Client };
    tokowakaClient?: TokowakaClient;
  }): TokowakaClient;

  /**
   * Generates Tokowaka configuration from suggestions for a specific URL
   */
  generateConfig(
    url: string,
    opportunity: Opportunity,
    suggestions: Suggestion[]
  ): TokowakaConfig | null;

  /**
   * Uploads configuration to S3 for a specific URL
   */
  uploadConfig(url: string, config: TokowakaConfig, isPreview?: boolean): Promise<string>;
  
  /**
   * Fetches existing Tokowaka configuration from S3 for a specific URL
   */
  fetchConfig(url: string, isPreview?: boolean): Promise<TokowakaConfig | null>;
  
  /**
   * Fetches domain-level metaconfig from S3
   */
  fetchMetaconfig(url: string): Promise<TokowakaMetaconfig | null>;
  
  /**
   * Uploads domain-level metaconfig to S3
   */
  uploadMetaconfig(url: string, metaconfig: TokowakaMetaconfig): Promise<string>;
  
  /**
   * Merges existing configuration with new configuration
   */
  mergeConfigs(existingConfig: TokowakaConfig, newConfig: TokowakaConfig): TokowakaConfig;
  
  /**
   * Invalidates CDN cache for a specific URL
   * Supports multiple CDN providers in parallel
   */
  invalidateCdnCache(url: string, providers?: string | string[], isPreview?: boolean): Promise<CdnInvalidationResult[]>;

  /**
   * Batch invalidates CDN cache for multiple URLs at once
   * More efficient than individual invalidations when processing multiple URLs
   */
  batchInvalidateCdnCache(urls: string[], providers?: string | string[], isPreview?: boolean): Promise<CdnInvalidationResult[]>;

  /**
   * Deploys suggestions to Tokowaka edge
   */
  deploySuggestions(
    site: Site,
    opportunity: Opportunity,
    suggestions: Suggestion[]
  ): Promise<DeploymentResult>;
  
  /**
   * Rolls back deployed suggestions
   */
  rollbackSuggestions(
    site: Site,
    opportunity: Opportunity,
    suggestions: Suggestion[]
  ): Promise<RollbackResult>;
  
  /**
   * Previews suggestions (all must belong to same URL)
   */
  previewSuggestions(
    site: Site,
    opportunity: Opportunity,
    suggestions: Suggestion[],
    options?: {
      warmupDelayMs?: number;
      maxRetries?: number;
      retryDelayMs?: number;
    }
  ): Promise<PreviewResult>;
  
  /**
   * Registers a custom mapper for an opportunity type
   */
  registerMapper(mapper: BaseOpportunityMapper): void;
  
  /**
   * Gets list of supported opportunity types
   */
  getSupportedOpportunityTypes(): string[];
}

