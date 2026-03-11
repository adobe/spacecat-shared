/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { BaseCollection, BaseModel } from '../index';

export type PlgOnboardingStatus =
  | 'IN_PROGRESS'
  | 'ONBOARDED'
  | 'ERROR'
  | 'WAITING_FOR_IP_ALLOWLISTING'
  | 'WAITLISTED';

export interface PlgOnboarding extends BaseModel {
  getImsOrgId(): string;
  getDomain(): string;
  getBaseURL(): string;
  getStatus(): PlgOnboardingStatus;
  getSiteId(): string | null;
  getOrganizationId(): string | null;
  getSteps(): object | null;
  getError(): object | null;
  getBotBlocker(): object | null;
  getWaitlistReason(): string | null;
  getCompletedAt(): string | null;
  setStatus(status: PlgOnboardingStatus): PlgOnboarding;
  setSiteId(siteId: string): PlgOnboarding;
  setOrganizationId(organizationId: string): PlgOnboarding;
  setSteps(steps: object): PlgOnboarding;
  setError(error: object): PlgOnboarding;
  setBotBlocker(botBlocker: object): PlgOnboarding;
  setWaitlistReason(waitlistReason: string): PlgOnboarding;
  setCompletedAt(completedAt: string): PlgOnboarding;
}

export interface PlgOnboardingCollection extends BaseCollection<PlgOnboarding> {
  allByImsOrgId(imsOrgId: string): Promise<PlgOnboarding[]>;
  findByImsOrgId(imsOrgId: string): Promise<PlgOnboarding | null>;
  allByImsOrgIdAndUpdatedAt(imsOrgId: string, updatedAt: string): Promise<PlgOnboarding[]>;
  findByImsOrgIdAndUpdatedAt(imsOrgId: string, updatedAt: string): Promise<PlgOnboarding | null>;
  allByImsOrgIdAndDomain(imsOrgId: string, domain: string): Promise<PlgOnboarding[]>;
  findByImsOrgIdAndDomain(imsOrgId: string, domain: string): Promise<PlgOnboarding | null>;
  allByStatus(status: PlgOnboardingStatus): Promise<PlgOnboarding[]>;
  findByStatus(status: PlgOnboardingStatus): Promise<PlgOnboarding | null>;
  allByStatusAndUpdatedAt(status: PlgOnboardingStatus, updatedAt: string): Promise<PlgOnboarding[]>;
  findByStatusAndUpdatedAt(status: PlgOnboardingStatus, updatedAt: string): Promise<PlgOnboarding | null>;
  allByBaseURL(baseURL: string): Promise<PlgOnboarding[]>;
  findByBaseURL(baseURL: string): Promise<PlgOnboarding | null>;
  allByBaseURLAndStatus(baseURL: string, status: PlgOnboardingStatus): Promise<PlgOnboarding[]>;
  findByBaseURLAndStatus(baseURL: string, status: PlgOnboardingStatus): Promise<PlgOnboarding | null>;
}
