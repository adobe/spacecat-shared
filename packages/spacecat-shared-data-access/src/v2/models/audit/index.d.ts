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

export interface Audit extends BaseModel {
  getAuditResult(): object;
  getAuditType(): string;
  getAuditedAt(): number;
  getFullAuditRef(): string;
  getIsError(): boolean;
  getIsLive(): boolean;
  getOpportunities(): Promise<Opportunity[]>;
  getSite(): Promise<Site>;
  getSiteId(): string;
  setAuditResult(auditResult: object): Audit;
  setAuditType(auditType: string): Audit;
  setAuditedAt(auditedAt: number): Audit;
  setFullAuditRef(fullAuditRef: string): Audit;
  setIsError(isError: boolean): Audit;
  setIsLive(isLive: boolean): Audit;
  setSiteId(siteId: string): Audit;
  toggleLive(): Audit;
}

export interface AuditCollection extends BaseCollection<Audit> {
  allBySiteId(siteId: string): Promise<Audit[]>;
}
