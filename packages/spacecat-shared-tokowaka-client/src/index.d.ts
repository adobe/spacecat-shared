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
  op: 'replace' | 'add' | 'prerender';
  selector?: string;
  value?: string;
  attribute?: string;
  element?: string;
  attributes?: Record<string, string>;
  opportunityId: string;
  suggestionId: string;
  prerenderRequired: boolean;
  lastUpdated: number;
}

export interface TokowakaUrlOptimization {
  prerender: boolean;
  patches: TokawakaPatch[];
}

export interface TokowakaConfig {
  siteId: string;
  baseURL: string;
  version: string;
  tokowakaForceFail: boolean;
  tokowakaOptimizations: Record<string, TokowakaUrlOptimization>;
}

export interface CdnInvalidationResult {
  status: string;
  provider?: string;
  purgeId?: string;
  estimatedSeconds?: number;
  paths?: number;
  message?: string;
}

export interface DeploymentResult {
  tokowakaApiKey: string;
  s3Key: string | null;
  config: TokowakaConfig | null;
  cdnInvalidation: CdnInvalidationResult | null;
  succeededSuggestions: Array<any>;
  failedSuggestions: Array<{ suggestion: any; reason: string }>;
}

export interface Site {
  getId(): string;
  getBaseURL(): string;
  getConfig(): Record<string, any>;
}

export interface Opportunity {
  getId(): string;
  getType(): string;
}

export interface Suggestion {
  getId(): string;
  getData(): Record<string, any>;
}

/**
 * Base class for opportunity mappers
 * Extend this class to create custom mappers for new opportunity types
 */
export abstract class BaseOpportunityMapper {
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
   * Converts a suggestion to a Tokowaka patch
   */
  abstract suggestionToPatch(
    suggestion: Suggestion,
    opportunityId: string
  ): TokawakaPatch | null;
  
  /**
   * Validates suggestion data before conversion
   */
  validateSuggestionData(data: Record<string, any>): boolean;
  
  /**
   * Helper method to create base patch structure
   */
  protected createBasePatch(
    suggestionId: string,
    opportunityId: string
  ): Partial<TokawakaPatch>;
}

/**
 * Base class for CDN clients
 * Extend this class to create custom CDN clients for different providers
 */
export abstract class BaseCdnClient {
  constructor(config: Record<string, any>, log: any);
  
  /**
   * Returns the CDN provider name
   */
  abstract getProviderName(): string;
  
  /**
   * Validates the CDN configuration
   */
  validateConfig(): boolean;
  
  /**
   * Invalidates the CDN cache for the given paths
   */
  abstract invalidateCache(paths: string[]): Promise<CdnInvalidationResult>;
  
  /**
   * Checks the status of an invalidation request
   */
  getInvalidationStatus(requestId: string): Promise<CdnInvalidationResult>;
}

/**
 * Akamai CDN client implementation
 */
export class AkamaiCdnClient extends BaseCdnClient {
  constructor(config: {
    clientToken: string;
    clientSecret: string;
    accessToken: string;
    baseUrl?: string;
  }, log: any);
  
  getProviderName(): string;
  validateConfig(): boolean;
  invalidateCache(paths: string[]): Promise<CdnInvalidationResult>;
  getInvalidationStatus(purgeId: string): Promise<CdnInvalidationResult>;
}

/**
 * Registry for CDN clients
 */
export class CdnClientRegistry {
  constructor(log: any);
  
  registerClient(provider: string, ClientClass: typeof BaseCdnClient): void;
  getClient(provider: string, config: Record<string, any>): BaseCdnClient | null;
  getSupportedProviders(): string[];
  isProviderSupported(provider: string): boolean;
}

export default class TokowakaClient {
  constructor(config: { bucketName: string; s3Client: S3Client }, log: any);
  
  static createFrom(context: {
    env: { TOKOWAKA_CONFIG_BUCKET: string };
    log?: any;
    s3Client: S3Client;
    tokowakaClient?: TokowakaClient;
  }): TokowakaClient;

  generateConfig(
    site: Site,
    opportunity: Opportunity,
    suggestions: Suggestion[]
  ): TokowakaConfig;

  uploadConfig(apiKey: string, config: TokowakaConfig): Promise<string>;
  
  /**
   * Fetches existing Tokowaka configuration from S3
   */
  fetchConfig(apiKey: string): Promise<TokowakaConfig | null>;
  
  /**
   * Merges existing configuration with new configuration
   */
  mergeConfigs(existingConfig: TokowakaConfig | null, newConfig: TokowakaConfig): TokowakaConfig;
  
  invalidateCdnCache(site: Site, s3Key: string): Promise<CdnInvalidationResult | null>;

  deploySuggestions(
    site: Site,
    opportunity: Opportunity,
    suggestions: Suggestion[]
  ): Promise<DeploymentResult>;
  
  /**
   * Registers a custom mapper for an opportunity type
   */
  registerMapper(mapper: BaseOpportunityMapper): void;
  
  /**
   * Gets list of supported opportunity types
   */
  getSupportedOpportunityTypes(): string[];
}

