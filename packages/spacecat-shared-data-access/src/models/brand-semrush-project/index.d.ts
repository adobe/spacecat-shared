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

import type {
  BaseCollection, BaseModel,
} from '../index';

// NOTE: `belongs_to Brand` on the schema generates `brandId` plus a
// `getBrand()` runtime accessor. Brand is now a registered (minimal) entity in
// this package, so the accessor resolves locally; it is still intentionally
// left off this TypeScript surface, which exposes only the fields callers here
// need (`brandId`). Rich brand data continues to live in mysticat-data-service
// and is fetched over HTTP via @adobe/spacecat-shared-brand-client.
export interface BrandSemrushProject extends BaseModel {
  getBrandId(): string;
  getSemrushProjectId(): string;
  getGeoTargetId(): number;
  getLanguageCode(): string;
  getSiteId(): string | undefined;
  getDeletedAt(): string | undefined;
  setSemrushProjectId(value: string): BrandSemrushProject;
  setGeoTargetId(value: number): BrandSemrushProject;
  setLanguageCode(value: string): BrandSemrushProject;
  setSiteId(value: string): BrandSemrushProject;
  setDeletedAt(value: string): BrandSemrushProject;
}

export interface BrandSemrushProjectOrgRow {
  brandId: string;
  semrushProjectId: string;
  geoTargetId: number;
  languageCode: string;
  siteId: string | null;
  // Expected non-null under the select's `!inner` join (which excludes
  // non-matching parents), but kept nullable to match the defensive runtime
  // mapping (`row.brands?.organization_id ?? null`) — see
  // brand-semrush-project.collection.js's #fetchOrgRows.
  organizationId: string | null;
  semrushSubWorkspaceId: string | null;
}

export interface BrandSemrushProjectCollection extends
    BaseCollection<BrandSemrushProject> {
  allByBrandId(brandId: string): Promise<BrandSemrushProject[]>;
  findByBrandId(brandId: string): Promise<BrandSemrushProject | null>;
  allBySemrushProjectId(semrushProjectId: string): Promise<BrandSemrushProject[]>;
  findBySemrushProjectId(semrushProjectId: string): Promise<BrandSemrushProject | null>;
  findBySlice(
    brandId: string,
    geoTargetId: number,
    languageCode: string,
  ): Promise<BrandSemrushProject | null>;
  allByOrganizationId(
    organizationId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<BrandSemrushProjectOrgRow[]>;
}
