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

import type { BaseCollection, BaseModel, Site } from '../index.js';

export interface SiteCompetitor extends BaseModel {
    getBaseURL(): string;
    getSite(): Promise<Site>;
    getSiteId(): string;
    getUpdatedBy(): string;
    setBaseURL(baseURL: string): SiteCompetitor;
    setSiteId(siteId: string): SiteCompetitor;
    setUpdatedBy(updatedBy: string): SiteCompetitor;
}

export interface SiteCompetitorCollection extends BaseCollection<SiteCompetitor> {
    allByBaseURL(baseURL: string): Promise<SiteCompetitor[]>;
    allBySiteId(siteId: string): Promise<SiteCompetitor[]>;
    findByBaseURL(baseURL: string): Promise<SiteCompetitor | null>;
    findBySiteId(siteId: string): Promise<SiteCompetitor | null>;
}
