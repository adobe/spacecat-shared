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
  Audit, BaseCollection, BaseModel, Organization,
} from '../index';

export interface Site extends BaseModel {
  getAudits(): Promise<Audit>;
  getBaseURL(): string;
  getConfig(): object;
  getDeliveryType(): string;
  getFulfillableItems(): object;
  getGitHubURL(): string;
  getHlxConfig(): object;
  getIsLive(): boolean;
  getIsLiveToggledAt(): string;
  getOrganization(): Promise<Organization>;
  getOrganizationId(): string;
  setConfig(config: object): Site;
  setDeliveryType(deliveryType: string): Site;
  setFulfillableItems(fulfillableItems: object): Site;
  setGitHubURL(gitHubURL: string): Site;
  setHlxConfig(hlxConfig: object): Site;
  setIsLive(isLive: boolean): Site;
  setOrganizationId(organizationId: string): Site;
  toggleLive(): Site;
}

export interface SiteCollection extends BaseCollection<Organization> {
  allByBaseURL(siteId: string): Promise<Site[]>;
  allByDeliveryType(siteId: string): Promise<Site[]>;
  allByOrganizationId(siteId: string): Promise<Site[]>;
}
