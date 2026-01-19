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
  BaseCollection, BaseModel, Opportunity, Suggestion, FixEntitySuggestion,
} from '../index';

export interface FixEntity extends BaseModel {
  getChangeDetails(): object;
  setChangeDetails(value: object): this;
  getExecutedAt(): string;
  setExecutedAt(value: string): this;
  getExecutedBy(): string;
  setExecutedBy(value: string): this;
  getOpportunity(): Promise<Opportunity>;
  getOpportunityId(): string;
  setOpportunityId(value: string): this;
  getOrigin(): string;
  setOrigin(value: string): this;
  getPublishedAt(): string;
  setPublishedAt(value: string): this;
  getStatus(): string;
  setStatus(value: string): this;
  getType(): string;
}

export interface FixEntityCollection extends BaseCollection<FixEntity> {
  allByOpportunityId(opportunityId: string): Promise<FixEntity[]>;
  allByOpportunityIdAndStatus(opportunityId: string, status: string): Promise<FixEntity[]>;
  findByOpportunityId(opportunityId: string): Promise<FixEntity | null>;
  findByOpportunityIdAndStatus(opportunityId: string, status: string): Promise<FixEntity | null>;
  getSuggestionsByFixEntityId(fixEntityId: string): Promise<{data: Array<Suggestion>, unprocessed: Array<string>}>;
  setSuggestionsForFixEntity(opportunityId: string, fixEntity: FixEntity, suggestions: Array<Suggestion>): Promise<{createdItems: Array<FixEntitySuggestion>, errorItems: Array<FixEntitySuggestion>, removedCount: number}>;
  rollbackFixWithSuggestionUpdates(fixEntityId: string, opportunityId: string, suggestionUpdates: Array<{suggestionId: string}>, options?: {token?: string}): Promise<{canceled: boolean, data: any[]}>;
}
