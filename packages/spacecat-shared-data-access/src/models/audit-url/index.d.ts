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

import type { BaseCollection, BaseModel, Site } from '../index';

export interface AuditUrl extends BaseModel {
  getAudits(): string[];
  getCreatedAt(): string;
  getCreatedBy(): string;
  getRank(): number | null;
  getTraffic(): number | null;
  getSite(): Promise<Site>;
  getSiteId(): string;
  getByCustomer(): boolean;
  getUrl(): string;
  setAudits(audits: string[]): AuditUrl;
  setCreatedBy(createdBy: string): AuditUrl;
  setRank(rank: number | null): AuditUrl;
  setTraffic(traffic: number | null): AuditUrl;
  setSiteId(siteId: string): AuditUrl;
  setByCustomer(byCustomer: boolean): AuditUrl;
  setUrl(url: string): AuditUrl;
  isAuditEnabled(auditType: string): boolean;
  enableAudit(auditType: string): AuditUrl;
  disableAudit(auditType: string): AuditUrl;
  isCustomerUrl(): boolean;
}

export interface AuditUrlCollection extends BaseCollection<AuditUrl> {
  allBySiteId(siteId: string): Promise<AuditUrl[]>;
  allBySiteIdByCustomer(siteId: string, byCustomer: boolean): Promise<AuditUrl[]>;
  allBySiteIdByCustomerAndUrl(siteId: string, byCustomer: boolean, url: string): Promise<AuditUrl[]>;
  allBySiteIdAndUrl(siteId: string, url: string): Promise<AuditUrl[]>;
  allBySiteIdSorted(siteId: string, options?: { limit?: number; cursor?: string; sortBy?: string; sortOrder?: string }): Promise<{ items: AuditUrl[]; cursor?: string }>;
  allBySiteIdByCustomerSorted(siteId: string, byCustomer: boolean, options?: { limit?: number; cursor?: string; sortBy?: string; sortOrder?: string }): Promise<{ items: AuditUrl[]; cursor?: string }>;
  findBySiteId(siteId: string): Promise<AuditUrl | null>;
  findBySiteIdByCustomer(siteId: string, byCustomer: boolean): Promise<AuditUrl | null>;
  findBySiteIdByCustomerAndUrl(siteId: string, byCustomer: boolean, url: string): Promise<AuditUrl | null>;
  findBySiteIdAndUrl(siteId: string, url: string): Promise<AuditUrl | null>;
  allBySiteIdAndAuditType(siteId: string, auditType: string, options?: { limit?: number; cursor?: string; sortBy?: string; sortOrder?: string }): Promise<AuditUrl[]>;
  removeForSiteId(siteId: string): Promise<void>;
  removeForSiteIdByCustomer(siteId: string, byCustomer: boolean): Promise<void>;
}

