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

import type {
  BaseCollection,
  BaseModel,
  Opportunity,
  PaginatedResult,
  QueryOptions,
  Site,
} from '../index';

export interface GeoExperiment extends BaseModel {
  getSiteId(): string;
  getOpportunityId(): string | undefined;
  getSite(): Promise<Site>;
  getOpportunity(): Promise<Opportunity>;
  getPreScheduleId(): string | undefined;
  getPostScheduleId(): string | undefined;
  getType(): string;
  getPhase(): string;
  getStatus(): string;
  getSuggestionIds(): string[];
  getPromptsLocation(): string | undefined;
  getName(): string;
  getPromptsCount(): number;
  getStartTime(): string | undefined;
  getEndTime(): string | undefined;
  getMetadata(): object | undefined;
  getError(): object | undefined;
  getUpdatedBy(): string;

  setSiteId(siteId: string): GeoExperiment;
  setOpportunityId(opportunityId?: string): GeoExperiment;
  setPreScheduleId(preScheduleId?: string): GeoExperiment;
  setPostScheduleId(postScheduleId?: string): GeoExperiment;
  setType(type: string): GeoExperiment;
  setPhase(phase: string): GeoExperiment;
  setStatus(status: string): GeoExperiment;
  setSuggestionIds(suggestionIds: string[]): GeoExperiment;
  setPromptsLocation(promptsLocation?: string): GeoExperiment;
  setName(name: string): GeoExperiment;
  setPromptsCount(promptsCount: number): GeoExperiment;
  setStartTime(startTime?: string): GeoExperiment;
  setEndTime(endTime?: string): GeoExperiment;
  setMetadata(metadata?: object): GeoExperiment;
  setError(error?: object): GeoExperiment;
  setUpdatedBy(updatedBy: string): GeoExperiment;
}

export interface GeoExperimentCollection extends BaseCollection<GeoExperiment> {
  allBySiteId(siteId: string, options?: QueryOptions): Promise<PaginatedResult<GeoExperiment>>;
  findBySiteId(siteId: string): Promise<GeoExperiment | null>;
  allByOpportunityId(
    opportunityId: string,
    options?: QueryOptions,
  ): Promise<GeoExperiment[] | PaginatedResult<GeoExperiment>>;
  findByOpportunityId(
    opportunityId: string,
    options?: QueryOptions,
  ): Promise<GeoExperiment | null>;
  allActive(options?: QueryOptions): Promise<GeoExperiment[]>;
}
