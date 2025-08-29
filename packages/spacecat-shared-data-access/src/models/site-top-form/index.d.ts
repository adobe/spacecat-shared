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

import type { BaseCollection, BaseModel, Site } from '../index';

export interface SiteTopForm extends BaseModel {
  getFormSource(): string;
  getImportedAt(): string;
  getSite(): Promise<Site>;
  getSiteId(): string;
  getSource(): string;
  getTraffic(): number | undefined;
  getUrl(): string;
  setFormSource(formSource: string): SiteTopForm;
  setImportedAt(importedAt: string): SiteTopForm;
  setSiteId(siteId: string): SiteTopForm;
  setSource(source: string): SiteTopForm;
  setTraffic(traffic: number): SiteTopForm;
  setUrl(url: string): SiteTopForm;
}

export interface SiteTopFormCollection extends BaseCollection<SiteTopForm> {
  allBySiteId(siteId: string): Promise<SiteTopForm[]>;
  allBySiteIdAndSource(siteId: string, source: string): Promise<SiteTopForm[]>;
  findBySiteId(siteId: string): Promise<SiteTopForm | null>;
  findBySiteIdAndSource(siteId: string, source: string): Promise<SiteTopForm | null>;
  findByUrlAndFormSource(url: string, formSource: string): Promise<SiteTopForm | null>;
  removeByUrlAndFormSource(url: string, formSource: string): Promise<void>;
  removeForSiteId(siteId: string, source: string): Promise<void>;
}
