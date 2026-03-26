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

import type { BaseCollection, BaseModel, Opportunity, Site } from '../index.js';

export interface GeoExperiment extends BaseModel {
  getSiteId(): string;
  getOpportunityId(): string | undefined;
  getSite(): Promise<Site>;
  getOpportunity(): Promise<Opportunity>;
  getPreScheduleId(): string | undefined;
  getPostScheduleId(): string | undefined;
  getStatus(): string;
  getSkipDeploy(): boolean;
  getSuggestionIds(): string[];
  getMetadata(): object | undefined;
  getError(): object | undefined;
  getUpdatedBy(): string;

  setSiteId(siteId: string): GeoExperiment;
  setOpportunityId(opportunityId?: string): GeoExperiment;
  setPreScheduleId(preScheduleId?: string): GeoExperiment;
  setPostScheduleId(postScheduleId?: string): GeoExperiment;
  setStatus(status: string): GeoExperiment;
  setSkipDeploy(skipDeploy: boolean): GeoExperiment;
  setSuggestionIds(suggestionIds: string[]): GeoExperiment;
  setMetadata(metadata?: object): GeoExperiment;
  setError(error?: object): GeoExperiment;
  setUpdatedBy(updatedBy: string): GeoExperiment;
}

export interface GeoExperimentCollection extends BaseCollection<GeoExperiment> {
  allBySiteId(siteId: string): Promise<GeoExperiment[]>;
  findBySiteId(siteId: string): Promise<GeoExperiment | null>;
  allByOpportunityId(opportunityId: string): Promise<GeoExperiment[]>;
  findByOpportunityId(opportunityId: string): Promise<GeoExperiment | null>;
  allByPreScheduleId(preScheduleId: string): Promise<GeoExperiment[]>;
  findByPreScheduleId(preScheduleId: string): Promise<GeoExperiment | null>;
}
