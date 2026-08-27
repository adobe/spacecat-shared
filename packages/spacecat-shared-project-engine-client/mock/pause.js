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
 * The pause/resume state machine for the Project Engine mock — the action pair Semrush shipped for
 * the weekly-workspace data migration (swagger 2026-08-24).
 *
 * Live behaviour, ALL verified 2026-08-24 against prod (workspace `0a496c87-…` "Brand-A", project
 * `997e17c3-…` "CH-de"):
 *
 * | call                              | live response                                     |
 * | --------------------------------- | ------------------------------------------------- |
 * | pause a running project           | `202`, empty body; `is_paused` flips `true`         |
 * | pause an ALREADY-paused project   | `202`, empty body — **idempotent, not a conflict**  |
 * | resume a paused project           | `202`, empty body; `is_paused` flips `false`        |
 * | resume a project that is NOT paused | `409 {"message":"project is not paused"}`         |
 * | either, on an unknown project id  | `404 {"message":"not found"}`                       |
 *
 * The asymmetry is the load-bearing part: **pause is idempotent, resume is not.** A bulk pause can
 * therefore be re-run safely over a list of projects, while a bulk resume must either track what it
 * paused or tolerate 409s.
 *
 * Neither call touches `publish_status`, `is_draft`, `published_at` or `updated_at` — a paused
 * project still reads `publish_status: 'live'`, and `updated_at` is NOT bumped. The state lives in
 * the `is_paused` boolean on the project read-view, present on the v1 detail, the v1 list and the
 * v2 list (overlay CR23 adds it to `model.ProjectResponse`, CR5 marks it required).
 *
 * These functions are PURE: they decide the outcome from the stored project and hand the caller a
 * status plus the patch to apply, so the branch table above is unit-tested without a running
 * server (the route handlers themselves are coverage-excluded).
 */

/**
 * @typedef {import('./store.js').Entity} Entity
 * @typedef {{ status: 202, patch: { is_paused: boolean } }} Applied a 2xx ack; apply `patch`
 * @typedef {{ status: 404 | 409, message: string }} Rejected an error ack; no mutation
 * @typedef {Applied | Rejected} Transition
 */

/** The live body for an unknown project id, shared by both actions. */
export const NOT_FOUND_MESSAGE = 'not found';

/** The live body for a resume against a project that is not paused. */
export const NOT_PAUSED_MESSAGE = 'project is not paused';

/**
 * Decides the outcome of a PAUSE. Idempotent: an already-paused project acks again rather than
 * conflicting, so the returned patch is unconditionally `{ is_paused: true }`.
 * @param {Entity | undefined} project the stored project, or undefined when the id is unknown
 * @returns {Transition}
 */
export function pauseTransition(project) {
  if (!project) {
    return { status: 404, message: NOT_FOUND_MESSAGE };
  }
  return { status: 202, patch: { is_paused: true } };
}

/**
 * Decides the outcome of a RESUME. Unlike pause this is NOT idempotent — resuming a project that is
 * not paused is the live `409`.
 * @param {Entity | undefined} project the stored project, or undefined when the id is unknown
 * @returns {Transition}
 */
export function resumeTransition(project) {
  if (!project) {
    return { status: 404, message: NOT_FOUND_MESSAGE };
  }
  if (!project.is_paused) {
    return { status: 409, message: NOT_PAUSED_MESSAGE };
  }
  return { status: 202, patch: { is_paused: false } };
}
