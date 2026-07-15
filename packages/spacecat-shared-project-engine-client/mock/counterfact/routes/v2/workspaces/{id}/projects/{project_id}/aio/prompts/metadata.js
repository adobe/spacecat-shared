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

/**
 * Stateful handlers for the Adobe-owned prompt-metadata WRITE surface
 * `/v2/workspaces/{id}/projects/{project_id}/aio/prompts/metadata` — part of the `*-with-metadata`
 * family the Semrush metadata ADR (serenity-docs#35, `attachments/semrush-prompt-metadata-adr.md`)
 * introduces so the four authorship values (`created_at/by`, `updated_at/by`) live in a dedicated
 * Adobe-owned column instead of the tag vocabulary. WP2 (LLMO-6288) pins the ENDPOINT + the
 * consumer wiring here in the mock so api-service (WP1) can build against a stable shape; the
 * metadata PAYLOAD is deliberately OPAQUE (object or text) because Semrush's real WP0 — the actual
 * `metadata` JSONB semantics — has not shipped, so nothing here freezes the content-schema.
 *
 * This route is MOCK-OWNED and does NOT touch Semrush's real endpoints or the vendored swagger:
 * the path is absent from `spec/projectengine_swagger_public.yaml`, so — like the `__*` control
 * routes and the `auth`/`quota` responses — both verbs return a raw `{ status, body, contentType }`
 * literal that bypasses Counterfact's spec-derived response validation (there is no operation to
 * validate against). Adopting the ADR's real names/shapes is deferred until Semrush publishes WP0
 * and WP2 re-vendors the refreshed swagger.
 *
 *  - PUT   — batch whole-object OVERWRITE (ADR `aio-set-prompts-metadata-batch`): each item's
 *            `metadata` replaces the stored value wholesale.
 *  - PATCH — batch MERGE (mock-pinned soft extension; the ADR documents overwrite-only): a
 *            plain-object payload shallow-merges, a text-shaped payload replaces.
 *
 * Both accept `{ items: [{ id, metadata }, ...] }`, guard on the bearer credential, target
 * EXISTING prompts (created via `aio/prompts/tagged`), and echo `{ items, updated_count,
 * missing_ids }`. Transport stays REST + IMS-Bearer (LLMO-5977) — no gRPC/OAuth2 is introduced.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** Reads the batch `items` from the request body, tolerating an absent/typeless payload. */
const readItems = (body) => (Array.isArray(body?.items) ? body.items : []);

/** Shapes the shared response envelope from the ops result. */
const respond = ({ updated, missing }) => ({
  status: 200,
  contentType: 'application/json',
  body: { items: updated, updated_count: updated.length, missing_ids: missing },
});

/** PUT — batch whole-object metadata overwrite on existing prompts → 200. */
export function PUT($) {
  const { path, body, context } = $;
  const denied = context.authError($.headers);
  if (denied) {
    return denied;
  }
  const scope = { workspaceId: path.id, projectId: path.project_id };
  return respond(context.ops.prompts.setMetadataMany(scope, readItems(body)));
}

/** PATCH — batch metadata merge into existing prompts → 200. */
export function PATCH($) {
  const { path, body, context } = $;
  const denied = context.authError($.headers);
  if (denied) {
    return denied;
  }
  const scope = { workspaceId: path.id, projectId: path.project_id };
  return respond(context.ops.prompts.mergeMetadataMany(scope, readItems(body)));
}
