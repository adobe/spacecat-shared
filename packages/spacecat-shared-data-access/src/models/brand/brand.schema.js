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

import { hasText, isValidUUID } from '@adobe/spacecat-shared-utils';

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
  // semrushSubWorkspaceId) must not be forced to also send status. The validator
  // still rejects an out-of-enum value when status IS written
  // (activate → 'active', deactivate → 'pending').
  .addAttribute('status', {
    type: Brand.STATUSES,
    validate: (value) => value == null || Brand.STATUSES.includes(value),
  })
  // Brand → Semrush sub-workspace. Nullable (NULL = no sub-workspace
  // connected). Same minimum guard the distinct `Organization` entity applies
  // to its own `semrushWorkspaceId` field (the brand has no such field — its
  // deprecated mirror was removed in SITES-49202): the shared `hasText` rejects
  // the empty string (and non-strings) while letting
  // null/undefined short-circuit. Note hasText does NOT trim, so a
  // whitespace-only value would pass — acceptable here because this column is
  // only ever written by the activate flow with a real Semrush workspace UUID,
  // never user input. This is the write-of-record for the brand → Semrush
  // sub-workspace pointer.
  .addAttribute('semrushSubWorkspaceId', {
    type: 'string',
    validate: (value) => value == null || hasText(value),
  })
  // Uniqueness guarantee on the write-of-record column
  // (brands.semrush_sub_workspace_id, mysticat-data-service migration
  // 20260702091920), so findBySemrushSubWorkspaceId returns at most one row.
  .addAllIndex(['semrushSubWorkspaceId'])
  // LLMO-7352/LLMO-7418: async Semrush sub-workspace provisioning state — see
  // brand.model.js's class doc for the full field-by-field contract. All five
  // are nullable (no default): a brand with no async attempt tracked simply
  // has them all NULL, matching every brand that predates this column set.
  //
  // Not `required` and not `.addAllIndex`-ed: a targeted PATCH from the async
  // worker sends only the fields it changes on a given transition (e.g. a
  // requeue writes only `jobId`; a terminal promotion writes `status` +
  // `semrushSubWorkspaceId`), never the full set at once.
  .addAttribute('semrushProvisioningStatus', {
    type: Brand.PROVISIONING_STATUSES,
    validate: (value) => value == null || Brand.PROVISIONING_STATUSES.includes(value),
  })
  // Compare-and-set key for pointer promotion — an async worker's terminal
  // write is always conditioned on this still matching the attempt it started,
  // so a stale/superseded attempt (a retry, or a late at-least-once
  // redelivery) can never clobber a newer winner. Nullable: no attempt tracked
  // yet. Validated as a UUID like every other id on this entity, but
  // deliberately NOT `.addAllIndex`-ed — this is a per-brand compare-and-set
  // token, not a lookup key.
  .addAttribute('semrushProvisioningAttemptId', {
    type: 'string',
    validate: (value) => value == null || isValidUUID(value),
  })
  // References the async_jobs row driving the current attempt. Deliberately
  // NOT a foreign key: async_jobs rows are purged 7 days after creation
  // (wrpc_purge_expired_async_jobs), so an FK would either block the purge or
  // cascade this column to NULL — the durable state on this entity must
  // outlive the job record it points at.
  .addAttribute('semrushProvisioningJobId', {
    type: 'string',
    validate: (value) => value == null || isValidUUID(value),
  })
  // Sanitized terminal-failure reason, retained for diagnostics/UI after the
  // async_jobs row is purged. Length-bounded to match the DB CHECK
  // (brands_semrush_provisioning_error_length_check, <= 2000 chars). Must
  // never contain a raw Semrush workspace id or upstream response body — that
  // redaction is the writer's responsibility, this column only bounds length.
  .addAttribute('semrushProvisioningError', {
    type: 'string',
    validate: (value) => value == null || value.length <= 2000,
  })
  // Diagnostic, NON-canonical candidate workspace id captured mid-attempt,
  // before Semrush confirms the workspace is ready. `semrushSubWorkspaceId`
  // above remains the only canonical, confirmed pointer — this field exists so
  // a worker resuming a self-requeued attempt polls the SAME candidate instead
  // of re-running create-or-adopt (which would otherwise create a new
  // workspace on every backoff hop, since an in-progress candidate is
  // invisible to the adoption family-listing check). Same nullable hasText
  // guard as semrushSubWorkspaceId — never written from user input.
  // NOTE: the backing DB column (mysticat-data-service, fast-follow to
  // migration 20260908000000) had not landed as of this schema change; declare
  // the attribute first so schema and DB ship together, per this repo's own
  // schema-first sequencing precedent — do not use this attribute before that
  // column exists.
  .addAttribute('semrushProvisioningCandidateWorkspaceId', {
    type: 'string',
    validate: (value) => value == null || hasText(value),
  });

export default schema.build();
