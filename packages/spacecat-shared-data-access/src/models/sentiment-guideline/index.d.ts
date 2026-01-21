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

import type { BaseCollection, BaseModel, Site } from '../index';

/**
 * SentimentGuideline entity representing a guideline for sentiment analysis.
 * Composite primary key: siteId (PK) + guidelineId (SK)
 */
export interface SentimentGuideline extends BaseModel {
  getGuidelineId(): string;
  getName(): string;
  getInstruction(): string;
  getEnabled(): boolean;
  getCreatedAt(): string;
  getCreatedBy(): string;
  getUpdatedAt(): string;
  getUpdatedBy(): string;
  getSite(): Promise<Site>;
  getSiteId(): string;

  setName(name: string): SentimentGuideline;
  setInstruction(instruction: string): SentimentGuideline;
  setEnabled(enabled: boolean): SentimentGuideline;
  setUpdatedBy(updatedBy: string): SentimentGuideline;

  isEnabled(): boolean;
}

export interface SentimentGuidelineCollection extends BaseCollection<SentimentGuideline> {
  findById(siteId: string, guidelineId: string): Promise<SentimentGuideline | null>;
  allBySiteId(siteId: string): Promise<SentimentGuideline[]>;
  allBySiteIdPaginated(siteId: string, options?: { limit?: number; cursor?: string }): Promise<{ data: SentimentGuideline[]; cursor: string | null }>;
  allBySiteIdEnabled(siteId: string, options?: { limit?: number; cursor?: string }): Promise<{ data: SentimentGuideline[]; cursor: string | null }>;
  findByIds(siteId: string, guidelineIds: string[]): Promise<SentimentGuideline[]>;
  removeForSiteId(siteId: string): Promise<void>;
}
