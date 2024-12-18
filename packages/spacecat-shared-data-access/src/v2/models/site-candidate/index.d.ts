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

import type { BaseCollection, BaseModel } from '../index';

export interface SiteCandidate extends BaseModel {
  getBaseURL(): string;
  getHlxConfig(): object;
  getSite(): object;
  getSiteId(): string;
  getSource(): string;
  getStatus(): string;
  getUpdatedBy(): string;
  setBaseURL(baseURL: string): SiteCandidate;
  setHlxConfig(hlxConfig: object): SiteCandidate;
  setSiteId(siteId: string): SiteCandidate;
  setSource(source: string): SiteCandidate;
  setStatus(status: string): SiteCandidate;
  setUpdatedBy(updatedBy: string): SiteCandidate;
}

export interface SiteCandidateCollection extends BaseCollection<SiteCandidate> {
  allBySiteId(siteId: string): Promise<SiteCandidate[]>;
  allBySiteIdAndSiteCandidateIdAndUrl(
    siteId: string,
    siteCandidateId: string,
    url: string,
  ): Promise<SiteCandidate[]>;
}
