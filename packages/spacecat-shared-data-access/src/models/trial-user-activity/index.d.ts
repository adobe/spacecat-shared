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
import type { EntitlementProductCode } from '../entitlement';

export type Type = 'SIGN_UP' | 'SIGN_IN' | 'CREATE_SITE' | 'RUN_AUDIT' | 'PROMPT_RUN' | 'DOWNLOAD';

export interface TrialUserActivity extends BaseModel {
  getType(): Type;
  getDetails(): object | null;
  getProductCode(): EntitlementProductCode;
  getEntitlementId(): string;
  getTrialUserId(): string;
  getSiteId(): string;
  setType(type: Type): TrialUserActivity;
  setDetails(details: object): TrialUserActivity;
  setProductCode(productCode: string): TrialUserActivity;
}

export interface TrialUserActivityCollection extends BaseCollection<TrialUserActivity> {
  allByEntitlementId(entitlementId: string): Promise<TrialUserActivity[]>;
  allByProductCode(productCode: EntitlementProductCode): Promise<TrialUserActivity[]>;
  allByProductCodeAndCreatedAt(productCode: EntitlementProductCode, createdAt: string):
    Promise<TrialUserActivity[]>;
  allBySiteId(siteId: string): Promise<TrialUserActivity[]>;

  findByEntitlementId(entitlementId: string): Promise<TrialUserActivity | null>;
  findByProductCode(productCode: EntitlementProductCode): Promise<TrialUserActivity | null>;
  findByProductCodeAndCreatedAt(productCode: EntitlementProductCode, createdAt: string):
    Promise<TrialUserActivity | null>;
  findBySiteId(siteId: string): Promise<TrialUserActivity | null>;
}
