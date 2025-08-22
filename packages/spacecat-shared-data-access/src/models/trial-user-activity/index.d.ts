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

import type {
  BaseCollection, BaseModel,
} from '../base';

export type Type = 'SIGN_UP' | 'SIGN_IN' | 'CREATE_SITE' | 'RUN_AUDIT' | 'PROMPT_RUN' | 'DOWNLOAD';

export interface TrialUserActivity extends BaseModel {
  getType(): Type;
  getDetails(): object | null;
  getProductCode(): string;
  setType(type: Type): TrialUserActivity;
  setDetails(details: object): TrialUserActivity;
  setProductCode(productCode: string): TrialUserActivity;
}

export interface TrialUserActivityCollection extends BaseCollection<TrialUserActivity> {
  allByTrialUserId(trialUserId: string): Promise<TrialUserActivity[]>;
  allByEntitlementId(entitlementId: string): Promise<TrialUserActivity[]>;
  allByEntitlementIdAndCreatedAt(entitlementId: string, createdAt: string):
    Promise<TrialUserActivity[]>;
  allByProductCode(productCode: string): Promise<TrialUserActivity[]>;
  allByProductCodeAndCreatedAt(productCode: string, createdAt: string):
    Promise<TrialUserActivity[]>;
  allBySiteId(siteId: string): Promise<TrialUserActivity[]>;
  allBySiteIdAndCreatedAt(siteId: string, createdAt: string): Promise<TrialUserActivity[]>;

  findByTrialUserId(trialUserId: string): Promise<TrialUserActivity[]>;
  findByEntitlementId(entitlementId: string): Promise<TrialUserActivity[]>;
  findByEntitlementIdAndCreatedAt(entitlementId: string, createdAt: string):
    Promise<TrialUserActivity[]>;
  findByProductCode(productCode: string): Promise<TrialUserActivity[]>;
  findByProductCodeAndCreatedAt(productCode: string, createdAt: string):
    Promise<TrialUserActivity[]>;
  findBySiteId(siteId: string): Promise<TrialUserActivity[]>;
  findBySiteIdAndCreatedAt(siteId: string, createdAt: string): Promise<TrialUserActivity[]>;
}
