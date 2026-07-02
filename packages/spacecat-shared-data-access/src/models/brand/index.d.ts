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

export interface Brand extends BaseModel {
  getName(): string;
  getStatus(): string;
  getSemrushWorkspaceId(): string | null;
  // Transitional mirror (brands.semrush_sub_workspace_id) — read-only, no
  // setter; maintained by the mysticat-data-service sync trigger. See
  // brand.schema.js.
  getSemrushSubWorkspaceId(): string | null;
  setName(value: string): Brand;
  setStatus(value: string): Brand;
  setSemrushWorkspaceId(value: string | null): Brand;
}

export interface BrandCollection extends BaseCollection<Brand> {
  allBySemrushWorkspaceId(semrushWorkspaceId: string): Promise<Brand[]>;
  findBySemrushWorkspaceId(semrushWorkspaceId: string): Promise<Brand | null>;
  allBySemrushSubWorkspaceId(semrushSubWorkspaceId: string): Promise<Brand[]>;
  findBySemrushSubWorkspaceId(semrushSubWorkspaceId: string): Promise<Brand | null>;
}
