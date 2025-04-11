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
  BaseCollection,
  BaseModel, MultiStatusCreateResult, Opportunity, Suggestion,
} from '../index';

export interface FixEntity extends BaseModel {
  getChangeDetails(): object;
  getExecutedBy(): string;
  getExecutedAt(): string;
  getPublishedAt(): string;
  addSuggestions(suggestions: object[]): Promise<MultiStatusCreateResult<Suggestion>>;
  getSuggestions(): Promise<Suggestion>;
  getOpportunityId(): string;
  getOpportunity(): Promise<Opportunity>;
  getStatus(): string;
  getType(): string;
  setChangeDetails(changeDetails: object): FixEntity;
  setType(rank: number): FixEntity;
  setStatus(status: string): FixEntity;
  setExecutedBy(executedBy: string): FixEntity;
}

export interface FixEntityCollection extends BaseCollection<FixEntity> {
  allByOpportunityId(opportunityId: string): Promise<FixEntity[]>;
  allByOpportunityIdAndStatus(opportunityId: string, status: string): Promise<FixEntity[]>;
  findByOpportunityId(opportunityId: string): Promise<FixEntity | null>;
  findByOpportunityIdAndStatus(opportunityId: string, status: string): Promise<FixEntity | null>;
}
