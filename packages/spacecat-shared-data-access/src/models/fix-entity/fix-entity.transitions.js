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
 * FixEntity status literals.
 *
 * Duplicated from `FixEntity.STATUSES` (fix-entity.model.js) to avoid a circular
 * import — fix-entity.model.js imports this module for its setStatus guard.
 * Keep in sync if the enum ever changes. (Same pattern as suggestion.data-schemas.js.)
 */
const STATUSES = {
  PENDING: 'PENDING',
  DEPLOYED: 'DEPLOYED',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
};

/**
 * Canonical FixEntity status transition table.
 *
 * Source of truth: ADR adobe/mysticat-architecture#174
 * (platform/decisions/design-suggestion-fix-entity-status-lifecycle.md, §"Proposed rollout").
 *
 * The `<create>` case (no prior status) is represented by the CREATE key and is
 * matched when `from` is null/undefined.
 *
 * NOTE: the ADR table also lists a `REJECTED` terminal fix status, but
 * `FixEntity.STATUSES` does not (yet) define REJECTED. It is intentionally
 * omitted here until the enum + the post-merge/publish detector that would set
 * it exist (tracked under SITES-47076).
 */
export const FIX_ENTITY_CREATE = Symbol('FIX_ENTITY_CREATE');

export const FIX_ENTITY_TRANSITIONS = {
  [FIX_ENTITY_CREATE]: [STATUSES.PENDING, STATUSES.DEPLOYED, STATUSES.FAILED],
  [STATUSES.PENDING]: [STATUSES.DEPLOYED, STATUSES.FAILED],
  [STATUSES.DEPLOYED]: [STATUSES.PUBLISHED, STATUSES.ROLLED_BACK],
  // bounded retry; the attempts cap (SITES-46548) is not enforced here.
  [STATUSES.FAILED]: [STATUSES.PENDING],
  [STATUSES.PUBLISHED]: [STATUSES.ROLLED_BACK],
  [STATUSES.ROLLED_BACK]: [], // terminal
};

/**
 * Returns true if the FixEntity status transition `from` -> `to` is allowed.
 * A null/undefined `from` is treated as entity creation.
 *
 * @param {string|null|undefined} from - current status (null/undefined => create)
 * @param {string} to - target status
 * @returns {boolean}
 */
export const isAllowedFixTransition = (from, to) => {
  const key = (from === null || from === undefined) ? FIX_ENTITY_CREATE : from;
  const allowed = FIX_ENTITY_TRANSITIONS[key];
  return Array.isArray(allowed) && allowed.includes(to);
};
