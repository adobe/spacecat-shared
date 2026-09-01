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
 * (`semrushSubWorkspaceId`, `status`, `name`). Brands are created and fully
 * managed elsewhere (Brandalf sync, onboarding); this entity is a read +
 * targeted-patch surface, not a create surface.
 *
 * `semrushSubWorkspaceId` is the dual-mode switch: NULL = the brand is not
 * connected to a Semrush sub-workspace (resolves against the org parent
 * workspace — "flat" mode); set = the brand has its own Semrush sub-workspace.
 * Deactivation empties the sub-workspace and clears this pointer (the
 * sub-workspace itself is never deleted). See serenity-docs
 * brand-semrush-provisioning-v2-phase1-sync.md §6.
 *
 * NOTE: there is no brand-level `semrushWorkspaceId` accessor. The deprecated
 * read-only mirror (attribute, index, `findBySemrushWorkspaceId`,
 * `allBySemrushWorkspaceId`, `setSemrushWorkspaceId`) was removed in SITES-49202;
 * `semrushSubWorkspaceId` above is the write-of-record. The identically-named
 * `Organization.semrushWorkspaceId` is a DISTINCT field and stays — do not
 * reintroduce a brand mirror by symbol-name sweep.
 *
 * NOTE: there is also no `pendingSemrushProvisioning` attribute. That
 * "Save as pending" staging blob (`{primaryUrl, markets, generatePrompts}`,
 * mapped to `brands.pending_semrush_provisioning`) was removed in SITES-49448
 * once the brand/market management model made pending brands carry no
 * markets, models chosen per market, and the primary URL a `site_id`
 * selection at create time — the blob's shape no longer matches anything the
 * product writes.
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
  static STATUSES = Object.freeze(['pending', 'active', 'deleted', 'ignored']);
}

export default Brand;
