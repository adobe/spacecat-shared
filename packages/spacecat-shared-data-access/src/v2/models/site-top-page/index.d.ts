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

export interface SiteTopPage extends BaseModel {
  getGeo(): string;
  getImportedAt(): number;
  getSiteId(): string;
  getSource(): string;
  getTopKeyword(): string;
  getTraffic(): number;
  getUrl(): string;
  setGeo(geo: string): SiteTopPage;
  setImportedAt(importedAt: number): SiteTopPage;
  setSiteId(siteId: string): SiteTopPage;
  setSource(source: string): SiteTopPage;
  setTopKeyword(topKeyword: string): SiteTopPage;
  setTraffic(traffic: number): SiteTopPage;
  setUrl(url: string): SiteTopPage;
}

export interface SiteTopPageCollection extends BaseCollection<SiteTopPage> {
  allBySiteId(siteId: string): Promise<SiteTopPage[]>;
  allBySiteIdAndSourceAndGeo(siteId: string, source: string, geo: string): Promise<SiteTopPage[]>;
}
