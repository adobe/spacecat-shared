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

import type { BaseCollection, BaseModel } from '../base';
import type { ScrapeUrl } from '../scrape-url';

export interface ScrapeJob extends BaseModel {
  getBaseURL(): string,
  getCustomHeaders(): IOptions,
  getDuration(): number,
  getEndedAt(): string,
  getFailedCount(): number,
  getOptions(): string,
  getProcessingType(): string,
  getRedirectCount(): number,
  getResults(): string,
  getScrapeQueueId(): string,
  getScrapeUrls(): Promise<ScrapeUrl[]>,
  getScrapeUrlsByStatus(status: string): Promise<ScrapeUrl[]>,
  getStartedAt(): string,
  getStatus(): string,
  getSuccessCount(): number,
  getUrlCount(): number,
  setBaseURL(baseURL: string): void,
  setCustomHeaders(customHeaders: IOptions): void,
  setDuration(duration: number): void,
  setEndedAt(endTime: string): void,
  setFailedCount(failedCount: number): void,
  setOptions(options: string): void,
  setProcessingType(processingType: string): void,
  setRedirectCount(redirectCount: number): void,
  setResults(results: string): void,
  setScrapeQueueId(ScrapeQueueId: string): void,
  setStatus(status: string): void,
  setSuccessCount(successCount: number): void,
  setUrlCount(urlCount: number): void,
}

export interface ScrapeJobCollection extends BaseCollection<ScrapeJob> {
  allByBaseURL(baseURL: string): Promise<ScrapeJob[]>;
  allByBaseURLAndProcessingType(baseURL: string, processingType: string): Promise<ScrapeJob[]>;
  allByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
    baseURL: string,
    processingType: string,
    optEnableJavascript: string,
    optHideConsentBanner: string): Promise<ScrapeJob[]>;
  allByDateRange(startDate: string, endDate: string): Promise<ScrapeJob[]>;
  allByStartedAt(startDate: string): Promise<ScrapeJob[]>;
  allByStatus(status: string): Promise<ScrapeJob[]>;
  allByStatusAndUpdatedAt(status: string, updatedAt: string): Promise<ScrapeJob[]>;
  findByBaseURL(baseURL: string): Promise<ScrapeJob[]>;
  findByBaseURLAndProcessingType(baseURL: string, processingType: string): Promise<ScrapeJob[]>;
  findByBaseURLAndProcessingTypeAndOptEnableJavascriptAndOptHideConsentBanner(
    baseURL: string,
    processingType: string,
    optEnableJavascript: string,
    optHideConsentBanner: string): Promise<ScrapeJob[]>;
  findByStartedAt(startDate: string): Promise<ScrapeJob | null>;
  findByStatus(status: string): Promise<ScrapeJob | null>;
  findByStatusAndUpdatedAt(status: string, updatedAt: string): Promise<ScrapeJob | null>;
}
