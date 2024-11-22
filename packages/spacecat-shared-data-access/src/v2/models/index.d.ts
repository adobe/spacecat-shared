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

/**
 * Interface representing a base model for interacting with a data entity.
 */
export interface BaseModel {
  getId(): string;
  getCreatedAt(): string;
  getUpdatedAt(): string;
  remove(): Promise<this>;
  save(): Promise<this>;
}

/**
 * Interface representing an Opportunity model, extending BaseModel.
 */
export interface Opportunity extends BaseModel {
  // eslint-disable-next-line no-use-before-define
  addSuggestions(suggestions: object[]): Promise<Suggestion[]>;
  // eslint-disable-next-line no-use-before-define
  getSuggestions(): Promise<Suggestion[]>;
  getSiteId(): string;
  setSiteId(siteId: string): Opportunity;
  getAuditId(): string;
  setAuditId(auditId: string): Opportunity;
  getRunbook(): string;
  setRunbook(runbook: string): Opportunity;
  getGuidance(): string;
  setGuidance(guidance: string): Opportunity;
  getTitle(): string;
  setTitle(title: string): Opportunity;
  getDescription(): string;
  setDescription(description: string): Opportunity;
  getType(): string;
  getStatus(): string;
  setStatus(status: string): Opportunity;
  getOrigin(): string;
  setOrigin(origin: string): Opportunity;
  getTags(): string[];
  setTags(tags: string[]): Opportunity;
  getData(): object;
  setData(data: object): Opportunity;
}

/**
 * Interface representing a Suggestion model, extending BaseModel.
 */
export interface Suggestion extends BaseModel {
  getOpportunity(): Promise<Opportunity>;
  getOpportunityId(): string;
  setOpportunityId(opportunityId: string): Suggestion;
  getType(): string;
  getStatus(): string;
  setStatus(status: string): Suggestion;
  getRank(): number;
  setRank(rank: number): Suggestion;
  getData(): object;
  setData(data: object): Suggestion;
  getKpiDeltas(): object;
  setKpiDeltas(kpiDeltas: object): Suggestion;
}

/**
 * Interface representing a base collection for interacting with data entities.
 */
export interface BaseCollection<T extends BaseModel> {
  findById(id: string): Promise<T>;
  create(item: object): Promise<T>;
  createMany(items: object[]): Promise<T[]>;
}

/**
 * Interface representing the Opportunity collection, extending BaseCollection.
 */
export interface OpportunityCollection extends BaseCollection<Opportunity> {
  allBySiteId(siteId: string): Promise<Opportunity[]>;
  allBySiteIdAndStatus(siteId: string, status: string): Promise<Opportunity[]>;
}

/**
 * Interface representing the Suggestion collection, extending BaseCollection.
 */
export interface SuggestionCollection extends BaseCollection<Suggestion> {
  allByOpportunityId(opportunityId: string): Promise<Suggestion[]>;
  allByOpportunityIdAndStatus(opportunityId: string, status: string): Promise<Suggestion[]>;
  bulkUpdateStatus(suggestions: Suggestion[], status: string): Promise<Suggestion[]>;
}

/**
 * Interface representing the Model Factory for creating and managing model collections.
 */
export interface ModelFactory {
  getCollection<T extends BaseModel>(collectionName: string): BaseCollection<T>;
}
