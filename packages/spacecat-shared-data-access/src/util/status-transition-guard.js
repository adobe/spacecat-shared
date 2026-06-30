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
import { ValidationError } from '../errors/index.js';

export const ENFORCEMENT_MODES = {
  OFF: 'off',
  WARN: 'warn',
  ENFORCE: 'enforce',
};

/**
 * Resolves the status-transition enforcement mode from the environment.
 *
 * `STATUS_TRANSITION_ENFORCEMENT` ∈ { off, warn, enforce }; defaults to `warn`.
 * Read at call time so deployments (and tests) can flip it without a re-import.
 * Rollout (SITES-47091): ship `warn` to surface today's illegal transitions in
 * logs for ~1-2 weeks, then flip to `enforce`.
 *
 * @returns {string} one of ENFORCEMENT_MODES
 */
export const getEnforcementMode = () => {
  const raw = (process.env.STATUS_TRANSITION_ENFORCEMENT || '').trim().toLowerCase();
  return Object.values(ENFORCEMENT_MODES).includes(raw) ? raw : ENFORCEMENT_MODES.WARN;
};

/**
 * Guards a status transition. A no-op (`from === to`) and any allowed transition
 * pass silently. An illegal transition is, depending on the enforcement mode,
 * ignored (`off`), logged without blocking (`warn`), or rejected (`enforce`).
 *
 * @param {object} params
 * @param {string} params.entityName - e.g. 'FixEntity' / 'Suggestion' (for the message)
 * @param {string} [params.entityId] - entity id (for the message)
 * @param {string|null|undefined} params.from - current status (null/undefined => create)
 * @param {string} params.to - target status
 * @param {(from: string|null|undefined, to: string) => boolean} params.isAllowed
 *   - transition predicate (isAllowedFixTransition / isAllowedSuggestionTransition)
 * @param {object} [params.log] - logger with a `warn` method (warn mode only)
 * @throws {ValidationError} in `enforce` mode when the transition is not allowed
 */
export const guardTransition = ({
  entityName, entityId, from, to, isAllowed, log,
}) => {
  if (from === to) {
    return;
  }
  if (isAllowed(from, to)) {
    return;
  }

  const mode = getEnforcementMode();
  if (mode === ENFORCEMENT_MODES.OFF) {
    return;
  }

  const message = `status transition violation: ${entityName} ${entityId ?? '<unknown>'} ${from ?? '<create>'} -> ${to}`;

  if (mode === ENFORCEMENT_MODES.ENFORCE) {
    throw new ValidationError(message);
  }

  // warn mode: log without blocking.
  if (log) {
    log.warn(message);
  }
};
