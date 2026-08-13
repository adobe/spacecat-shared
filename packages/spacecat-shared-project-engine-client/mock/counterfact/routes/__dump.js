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
 * Test-only introspection route: returns the CURRENT store state (live mutations) so you can
 * "look inside" the mock DB — every collection (`projects:{ws}`, `ai_models:{ws}:{pr}`,
 * `prompts:{ws}:{pr}`) and its entities. Read-only; not part of the Project Engine API.
 * Materialized into `.counterfact/routes/` by the mock runner and excluded from coverage.
 */

/** GET /__dump — return the full store snapshot as JSON. */
export function GET($) {
  return { status: 200, body: $.context.dump(), contentType: 'application/json' };
}
