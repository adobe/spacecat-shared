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

export interface DeploymentExperiment extends BaseModel {
  getSiteId(): string;
  getOpportunityId(): string;
  getSite(): Promise<Site>;
  getOpportunity(): Promise<Opportunity>;
  getPreDeploymentId(): string;
  getPostDeploymentId(): string | undefined;
  getStatus(): string;
  getSuggestionIds(): string[];
  getMetadata(): object | undefined;
  getError(): object | undefined;
  getUpdatedBy(): string;

  setSiteId(siteId: string): DeploymentExperiment;
  setOpportunityId(opportunityId: string): DeploymentExperiment;
  setPreDeploymentId(preDeploymentId: string): DeploymentExperiment;
  setPostDeploymentId(postDeploymentId?: string): DeploymentExperiment;
  setStatus(status: string): DeploymentExperiment;
  setSuggestionIds(suggestionIds: string[]): DeploymentExperiment;
  setMetadata(metadata?: object): DeploymentExperiment;
  setError(error?: object): DeploymentExperiment;
  setUpdatedBy(updatedBy: string): DeploymentExperiment;
}

export interface DeploymentExperimentCollection extends BaseCollection<DeploymentExperiment> {
  allBySiteId(siteId: string): Promise<DeploymentExperiment[]>;
  findBySiteId(siteId: string): Promise<DeploymentExperiment | null>;
  allByOpportunityId(opportunityId: string): Promise<DeploymentExperiment[]>;
  findByOpportunityId(opportunityId: string): Promise<DeploymentExperiment | null>;
  allByPreDeploymentId(preDeploymentId: string): Promise<DeploymentExperiment[]>;
  findByPreDeploymentId(preDeploymentId: string): Promise<DeploymentExperiment | null>;
}
