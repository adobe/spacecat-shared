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

import BaseModel from '../base/base.model.js';

/**
 * Brand - an Adobe brand, stored in the `brands` table in mysticat-data-service
 * and served over PostgREST. Intentionally minimal: it surfaces only the fields
 * the serenity sub-workspace provisioning flows read/write
 * (`semrushWorkspaceId`, `status`, `name`). Brands are created and fully
 * managed elsewhere (Brandalf sync, onboarding); this entity is a read +
 * targeted-patch surface, not a create surface.
 *
 * `semrushWorkspaceId` is the dual-mode switch: NULL = legacy/flat mode, set =
 * the brand has its own Semrush child workspace (kept across deactivation).
 * See serenity-docs brand-semrush-provisioning-v2-phase1-sync.md §6.
 *
 * @class Brand
 * @extends BaseModel
 */
class Brand extends BaseModel {
  static ENTITY_NAME = 'Brand';

  /**
   * Mirrors the `reference_status` enum on the brands table
   * (mysticat-data-service). Activation writes `active`; deactivation writes
   * `pending`; customer offboard writes `deleted`.
   */
  static STATUSES = ['pending', 'active', 'deleted', 'ignored'];
}

export default Brand;
