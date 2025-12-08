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

import type { Organization, Site } from '../index';

export interface Configuration {
  addHandler(type: string, handler: object): void;
  disableHandlerForOrg(type: string, org: Organization): void;
  disableHandlerForSite(type: string, site: Site): void;
  enableHandlerForOrg(type: string, org: Organization): void;
  enableHandlerForSite(type: string, site: Site): void;
  getConfigurationId(): string;
  getCreatedAt(): string;
  getDisabledAuditsForSite(site: Site): string[];
  getEnabledAuditsForSite(site: Site): string[];
  getEnabledSiteIdsForHandler(type: string): string[];
  getHandler(type: string): object | undefined;
  getHandlers(): object;
  getId(): string;
  getJobs(): object[];
  getQueues(): object;
  getSlackRoleMembersByRole(role: string): string[];
  getSlackRoles(): object;
  getUpdatedAt(): string;
  getUpdatedBy(): string;
  getVersion(): string;
  isHandlerDependencyMetForOrg(type: string, org: Organization): true | string[];
  isHandlerDependencyMetForSite(type: string, site: Site): true | string[];
  isHandlerEnabledForOrg(type: string, org: Organization): boolean;
  isHandlerEnabledForSite(type: string, site: Site): boolean;
  registerAudit(type: string, enabledByDefault?: boolean, interval?: string, productCodes?: string[]): void;
  save(): Promise<Configuration>;
  setHandlers(handlers: object): void;
  setJobs(jobs: object[]): void;
  setQueues(queues: object): void;
  setSlackRoles(slackRoles: object): void;
  setUpdatedBy(updatedBy: string): void;
  toJSON(): object;
  unregisterAudit(type: string): void;
  updateConfiguration(data: object): void;
  updateHandlerOrgs(type: string, orgId: string, enabled: boolean): void;
  updateHandlerProperties(type: string, properties: object): void;
  updateHandlerSites(type: string, siteId: string, enabled: boolean): void;
  updateJob(type: string, properties: { interval?: string; group?: string }): void;
  updateQueues(queues: object): void;
}

export interface ConfigurationCollection {
  create(data: object): Promise<Configuration>;
  findByVersion(version: string): Promise<Configuration | null>;
  findLatest(): Promise<Configuration | null>;
}
