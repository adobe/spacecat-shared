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

export interface AbvOnboardingClaimArtifacts {
  siteId?: string;
  entitlementId?: string;
}

export type AbvOnboardingClaimStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CONFLICT';

export interface AbvClaim {
  id: string;
  imsOrgId: string;
  baseURL: string;
  status: AbvOnboardingClaimStatus;
  factId: string | null;
  holder: string | null;
  leaseExpiresAt: string | null;
  artifacts: AbvOnboardingClaimArtifacts | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AbvOnboardingClaim extends BaseModel {
  getImsOrgId(): string;
  getBaseUrl(): string;
  getStatus(): AbvOnboardingClaimStatus;
  getFactId(): string;
  getHolder(): string;
  getLeaseExpiresAt(): string;
  getArtifacts(): AbvOnboardingClaimArtifacts;
  getReason(): string;
}

export interface AbvOnboardingClaimCollection extends BaseCollection<AbvOnboardingClaim> {
  acquire(params: {
    imsOrgId: string;
    baseURL: string;
    factId?: string;
    leaseMs: number;
  }): Promise<{ acquired: boolean; claim: AbvClaim }>;
  finalize(
    claim: AbvClaim,
    opts: { status: AbvOnboardingClaimStatus; artifacts?: AbvOnboardingClaimArtifacts; reason?: string },
  ): Promise<void>;
  invalidate(params: { imsOrgId: string; baseURL: string }): Promise<void>;
}
