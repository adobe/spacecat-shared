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

import { hasText } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import Brand from './brand.model.js';
import BrandCollection from './brand.collection.js';

// Minimal projection of the `brands` table (mysticat-data-service) — only the
// fields the serenity sub-workspace provisioning flows read or patch. Brands
// are created/owned elsewhere, so columns this entity does not declare
// (organization_id, site_id, regions, …) are simply never touched by it; a
// targeted PATCH only sends the attributes it changes.
const schema = new SchemaBuilder(Brand, BrandCollection)
  .addAttribute('name', {
    type: 'string',
    required: true,
  })
  // reference_status enum on the brands table. Not `required`: this entity
  // never creates a brand, and a targeted PATCH (e.g. setting only
  // semrushWorkspaceId) must not be forced to also send status. The validator
  // still rejects an out-of-enum value when status IS written
  // (activate → 'active', deactivate → 'pending').
  .addAttribute('status', {
    type: Brand.STATUSES,
    validate: (value) => value == null || Brand.STATUSES.includes(value),
  })
  // Brand → Semrush sub-workspace. Nullable (NULL = no sub-workspace
  // connected). Same minimum guard as organizations.semrushWorkspaceId: the
  // shared `hasText` rejects the empty string (and non-strings) while letting
  // null/undefined short-circuit. Note hasText does NOT trim, so a
  // whitespace-only value would pass — acceptable here because this column is
  // only ever written by the activate flow with a real Semrush workspace UUID,
  // never user input.
  .addAttribute('semrushWorkspaceId', {
    type: 'string',
    validate: (value) => value == null || hasText(value),
  })
  // Nullable JSONB blob holding deferred Semrush provisioning data for a
  // pending (draft) brand. Maps to brands.pending_semrush_provisioning
  // (migration 20260618120000). Validated loosely here (object-or-null); the
  // DB CHECK enforces the object shape and the controller owns field-level
  // validation and the activate-flow consumption semantics.
  .addAttribute('pendingSemrushProvisioning', {
    type: 'any',
    validate: (value) => value == null || (typeof value === 'object' && !Array.isArray(value)),
  })
  // Uniqueness is enforced at the DB level via the UNIQUE constraint on
  // brands.semrush_workspace_id (mysticat-data-service migration
  // 20260615102123), so findBySemrushWorkspaceId returns at most one row.
  .addAllIndex(['semrushWorkspaceId']);

export default schema.build();
