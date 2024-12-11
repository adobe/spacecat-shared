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

import type { BaseCollection, BaseModel } from '../base';

export interface ImportJob extends BaseModel {
  getBaseURL(): string,
  getDuration(): number,
  getEndedAt(): number,
  getFailedCount(): number,
  getHasCustomHeaders(): boolean,
  getHasCustomImportJs(): boolean,
  getHashedApiKey(): string,
  getImportQueueId(): string,
  getInitiatedBy(): string,
  getOptions(): string,
  getRedirectCount(): number,
  getStatus(): string,
  getStartedAt(): number,
  getSuccessCount(): number,
  getUrlCount(): number,
  setBaseURL(baseURL: string): void,
  setDuration(duration: number): void,
  setEndedAt(endTime: number): void,
  setFailedCount(failedCount: number): void,
  setHasCustomHeaders(hasCustomHeaders: boolean): void,
  setHasCustomImportJs(hasCustomImportJs: boolean): void,
  setHashedApiKey(hashedApiKey: string): void,
  setImportQueueId(importQueueId: string): void,
  setInitiatedBy(initiatedBy: string): void,
  setOptions(options: string): void,
  setRedirectCount(redirectCount: number): void,
  setStatus(status: string): void,
  setStartedAt(startTime: number): void,
  setSuccessCount(successCount: number): void,
  setUrlCount(urlCount: number): void,
}

export interface ImportJobCollection extends BaseCollection<ImportJob> {
  allByDateRange(startDate: number, endDate: number): Promise<ImportJob[]>;
  allByStatus(status: string): Promise<ImportJob[]>;
}
