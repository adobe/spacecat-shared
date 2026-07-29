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

/**
 * Handler for GET /v2/workspaces/{id}/projects/{project_id}/aio/init_status — AIO readiness for a
 * live project (the consumer's `getInitStatus`). The live route is on /v2 (the vendored swagger's
 * /v1 path 404s — overlay CR8 relocates it; verified 2026-06-25 against prod). Success is `200`
 * `AIOProjectInitializedResponse` `{ initialized }`. Excluded from coverage (materialized handler).
 */

/** GET — AIO init status → 200 { initialized: true }. */
export function GET($) {
  return $.response[200].json($.context.factories.createInitStatusMock({ initialized: true }));
}
