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

// @ts-check

/**
 * Mock factory functions for the User Manager entities — the "mock factory pattern". Each
 * returns a fully-typed entity (typed against the generated, overlay-corrected component schemas)
 * with realistic defaults, and accepts a `Partial<…>` override. Fixtures therefore stay correctly
 * shaped and in sync with the spec, and a per-test caller overrides only what it cares about.
 *
 * Enforcement: this file opts into type-checking via `// @ts-check`, so `npm run test:types`
 * (tsc) fails if a default drifts from the overlayed schema — wrong field type or an unknown field.
 * The types come from `build/openapi3.json` (the overlayed artifact), so the fixtures are derived
 * from the spec, not hand-asserted. Ids use real UUIDs (`globalThis.crypto.randomUUID()`) to mirror
 * production.
 */

/** @typedef {import('../src/index.js').components['schemas']} Schemas */
/** @typedef {Schemas['handlers.workspaceResponse']} Workspace */
/** @typedef {Schemas['handlers.WorkspaceCheckResponse']} WorkspaceStatus */
/** @typedef {Schemas['handlers.workspaceDeleteResponse']} WorkspaceDeleteResponse */
/** @typedef {Schemas['http_server.BasicResponse']} BasicResponse */

const uuid = () => globalThis.crypto.randomUUID();

/**
 * A workspace (`handlers.workspaceResponse`) — the entity returned by `createSubworkspace` and
 * each item of the `listWorkspaceFamily` top-level array. The live shape carries many fields, but
 * the consumer (spacecat-api-service `workspace-lifecycle.js`) reads only `id`, `title`, and
 * `status`; the rest are realistic defaults so `__dump` and family reads look like production. The
 * vendored swagger marks no field required, so every field is optional in the generated type.
 * Timestamps are fixed (the mock is deterministic — no wall clock).
 * @param {Partial<Workspace>} [overrides]
 * @returns {Workspace}
 */
export const createWorkspaceMock = (overrides = {}) => ({
  id: uuid(),
  title: 'Seeded Workspace',
  status: 'created',
  parent_id: '',
  owner: 'mock-owner@example.com',
  role: 'owner',
  products: ['ai'],
  created_at: '2026-01-01T00:00:00Z',
  last_updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * A workspace status check (`handlers.WorkspaceCheckResponse`) — the `getWorkspaceStatus` body
 * `{ status }`. Overlay CR2 retypes the 200 from an array wrapper to this single object, matching
 * the live API and the consumer's `status.status === 'created'` read. `status` is one of
 * `not ready` | `created` | `error`.
 * @param {Partial<WorkspaceStatus>} [overrides]
 * @returns {WorkspaceStatus}
 */
export const createWorkspaceStatusMock = (overrides = {}) => ({
  status: 'created',
  ...overrides,
});

/**
 * A workspace delete ack (`handlers.workspaceDeleteResponse`) — `deleteWorkspace`'s `{ id }`.
 * @param {Partial<WorkspaceDeleteResponse>} [overrides]
 * @returns {WorkspaceDeleteResponse}
 */
export const createWorkspaceDeleteResponseMock = (overrides = {}) => ({
  id: uuid(),
  ...overrides,
});

/**
 * A simple message envelope (`http_server.BasicResponse`) — the shape the live API uses for its
 * error responses (401/403/422/500). Used by the quota 422 ("insufficient available units") and
 * the post-delete / unknown-workspace 403. `errors` is an optional free-form detail map.
 * @param {Partial<BasicResponse>} [overrides]
 * @returns {BasicResponse}
 */
export const createBasicResponseMock = (overrides = {}) => ({
  message: '',
  ...overrides,
});
