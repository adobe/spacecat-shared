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
  BaseCollection, BaseModel, Opportunity, Site,
} from '../index';

export interface LatestAudit extends BaseModel {
  getAuditId(): object;
  getAuditResult(): object;
  getAuditType(): string;
  getAuditedAt(): number;
  getFullAuditRef(): string;
  getIsError(): boolean;
  getIsLive(): boolean;
  getOpportunities(): Promise<Opportunity[]>;
  getSite(): Promise<Site>;
  getSiteId(): string;
}

export interface LatestAuditCollection extends BaseCollection<LatestAudit> {
  allBySiteId(siteId: string): Promise<LatestAudit[]>;
  findBySiteIdAndAuditType(siteId: string, auditType: string): Promise<LatestAudit[]>;
}
