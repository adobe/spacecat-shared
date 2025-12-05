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

import type { S3Client } from '@aws-sdk/client-s3';
import type {
  BaseCollection, BaseModel, Organization, Site,
} from '../index';

export interface Configuration extends BaseModel {
  addHandler(type: string, handler: object): void;
  disableHandlerForOrganization(type: string, organization: Organization): void;
  disableHandlerForSite(type: string, site: Site): void;
  enableHandlerForOrganization(type: string, organization: Organization): void;
  enableHandlerForSite(type: string, site: Site): void;
  getConfigurationId(): string;
  getEnabledSiteIdsForHandler(type: string): string[];
  getEnabledAuditsForSite(site: Site): string[];
  getDisabledAuditsForSite(site: Site): string[];
  getHandler(type: string): object | undefined;
  getHandlers(): object;
  getJobs(): object;
  getQueues(): object;
  getSlackRoleMembersByRole(role: string): string[];
  getSlackRoles(): object;
  getVersion(): number;
  isHandlerEnabledForOrg(type: string, organization: Organization): boolean;
  isHandlerEnabledForSite(type: string, site: Site): boolean;
  setHandlers(handlers: object): void;
  setJobs(jobs: object): void;
  setQueues(queues: object): void;
  setSlackRoles(slackRoles: object): void;
  updateHandlerOrgs(type: string, orgId: string, enabled: boolean): void;
  updateHandlerSites(type: string, siteId: string, enabled: boolean): void;
  registerAudit(type: string, enabledByDefault?: boolean, interval?: string, productCodes?: string[]): void;
  unregisterAudit(type: string): void;
}

export interface ConfigurationCollection extends Omit<BaseCollection<Configuration>,
  'createMany' | '_saveMany' | 'batchGetByKeys' | 'allByIndexKeys' | 'findByIndexKeys' | 'removeByIndexKeys'
> {
  /** S3 client for file storage operations. Only available if ENV is configured. */
  s3Client?: S3Client;
  /** S3 bucket name for file storage (spacecat-{env}-importer). Only available if ENV is configured. */
  s3Bucket?: string;

  /**
   * Finds a configuration by its ID (S3 VersionId).
   * @param id - The S3 VersionId.
   */
  findById(id: string): Promise<Configuration | null>;

  /**
   * Finds a configuration by S3 VersionId. Alias for findById().
   * @param version - The S3 VersionId.
   */
  findByVersion(version: string): Promise<Configuration | null>;

  /**
   * Retrieves the latest configuration from S3.
   */
  findLatest(): Promise<Configuration | null>;

  /**
   * Finds a single configuration. Alias for findLatest().
   */
  findByAll(): Promise<Configuration | null>;

  /**
   * Retrieves all configuration versions from S3.
   */
  all(): Promise<Configuration[]>;

  /**
   * Checks if a configuration with the given ID (S3 VersionId) exists.
   * @param id - The S3 VersionId to check.
   */
  existsById(id: string): Promise<boolean>;

  /**
   * Checks if any configuration exists in S3.
   */
  exists(): Promise<boolean>;

  /**
   * Removes configuration versions by their IDs (S3 VersionIds).
   * @param ids - Array of S3 VersionIds to remove.
   */
  removeByIds(ids: string[]): Promise<void>;
}
