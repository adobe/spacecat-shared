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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Handler for PUT /v1/workspaces/{id}/projects/{project_id}/ci/competitors — full replace of a
 * project's CI competitor list (the consumer's `updateCiCompetitors`). Request is
 * `CICompetitorsUpdateRequest` `{ ci_competitors: [{ domain, color? }] }`; live returns the
 * resulting `CICompetitorsResponse` `{ ci_competitors: [{ id, project_id, domain, color }] }`
 * (verified 2026-06-25, see docs/mock-vs-live-parity.md). The mock echoes the input back as the
 * stored set, assigning an id + the path project_id. Excluded from coverage (materialized handler).
 */

/** Deterministic id from a competitor domain so the echo is stable. */
const competitorId = (domain) => `cic-${encodeURIComponent(String(domain ?? ''))}`;

/** PUT — replace the CI competitor list → 200 { ci_competitors }. */
export function PUT($) {
  const { path, body } = $;
  const input = Array.isArray(body?.ci_competitors) ? body.ci_competitors : [];
  const ciCompetitors = input.map((c) => ({
    id: competitorId(c?.domain),
    project_id: path.project_id,
    domain: c?.domain ?? '',
    color: c?.color ?? '',
  }));
  return $.response[200].json({ ci_competitors: ciCompetitors });
}
