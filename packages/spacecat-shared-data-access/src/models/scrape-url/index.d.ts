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

import type { BaseCollection, BaseModel, ScrapeJob } from '../index';

export interface ScrapeUrl extends BaseModel {
  getFile(): string,
  getScrapeJob(): Promise<ScrapeJob>,
  getScrapeJobId(): string,
  getPath(): string,
  getReason(): string,
  getStatus(): string,
  getUrl(): string,
  getIsOriginal(): boolean,
  setFile(file: string): void,
  setScrapeJobId(ScrapeJobId: string): void,
  setPath(path: string): void,
  setReason(reason: string): void,
  setStatus(status: string): void,
  setUrl(url: string): void,
  setIsOriginal(isOriginal: boolean): void,
}

export interface ScrapeUrlCollection extends BaseCollection<ScrapeUrl> {
  allByScrapeJobId(ScrapeJobId: string): Promise<ScrapeUrl[]>;
  allByScrapeUrlsByJobIdAndStatus(ScrapeJobId: string, status: string): Promise<ScrapeUrl[]>;
  findByScrapeJobId(ScrapeJobId: string): Promise<ScrapeUrl | null>;
  findByScrapeJobIdAndUrl(ScrapeJobId: string, url: string): Promise<ScrapeUrl | null>;
}
