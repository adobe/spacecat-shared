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
 * SentimentTopic entity representing a topic for sentiment analysis.
 * Composite primary key: siteId (PK) + topicId (SK)
 */
export interface SentimentTopic extends BaseModel {
  getTopicId(): string;
  getName(): string;
  getDescription(): string | undefined;
  getTopicName(): string;
  getSubPrompts(): string[];
  getAudits(): string[];
  getEnabled(): boolean;
  getCreatedAt(): string;
  getCreatedBy(): string;
  getUpdatedAt(): string;
  getUpdatedBy(): string;
  getSite(): Promise<Site>;
  getSiteId(): string;

  setName(name: string): SentimentTopic;
  setDescription(description: string): SentimentTopic;
  setTopicName(topicName: string): SentimentTopic;
  setSubPrompts(subPrompts: string[]): SentimentTopic;
  setAudits(audits: string[]): SentimentTopic;
  setEnabled(enabled: boolean): SentimentTopic;
  setUpdatedBy(updatedBy: string): SentimentTopic;

  isAuditEnabled(auditType: string): boolean;
  enableAudit(auditType: string): SentimentTopic;
  disableAudit(auditType: string): SentimentTopic;
  addSubPrompt(prompt: string): SentimentTopic;
  removeSubPrompt(prompt: string): SentimentTopic;
}

export interface SentimentTopicCollection extends BaseCollection<SentimentTopic> {
  findById(siteId: string, topicId: string): Promise<SentimentTopic | null>;
  allBySiteId(siteId: string): Promise<SentimentTopic[]>;
  allBySiteIdPaginated(siteId: string, options?: { limit?: number; cursor?: string }): Promise<{ data: SentimentTopic[]; cursor: string | null }>;
  allBySiteIdAndAuditType(siteId: string, auditType: string, options?: { limit?: number; cursor?: string }): Promise<{ data: SentimentTopic[]; cursor: string | null }>;
  allBySiteIdEnabled(siteId: string, options?: { limit?: number; cursor?: string }): Promise<{ data: SentimentTopic[]; cursor: string | null }>;
  removeForSiteId(siteId: string): Promise<void>;
}
