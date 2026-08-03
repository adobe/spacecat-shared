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
import { ValidationError } from '../errors/index.js';

export const ENFORCEMENT_MODES = {
  OFF: 'off',
  WARN: 'warn',
  ENFORCE: 'enforce',
};

/**
 * Resolves the config-validation enforcement mode from the environment.
 *
 * `CONFIG_VALIDATION_ENFORCEMENT` ∈ { off, warn, enforce }; defaults to `warn`.
 * Read at call time so deployments (and tests) can flip it without a re-import.
 *
 * Rollout rationale: `Site.setConfig()` previously accepted any value with no
 * schema validation at all on the update path (only entity `create()` runs
 * attribute validation — see base.collection.js `#validateItem`/`#prepareItem`).
 * Some existing sites carry legacy config that already fails today's Joi
 * schema (e.g. an `imports` entry that predates a stricter schema addition).
 * Flipping straight to `enforce` would reject unrelated PATCH requests on
 * those sites. Ship `warn` first to surface violations in logs, then flip to
 * `enforce` once legacy data is cleaned up or confirmed rare.
 *
 * @returns {string} one of ENFORCEMENT_MODES
 */
export const getConfigEnforcementMode = () => {
  const raw = (process.env.CONFIG_VALIDATION_ENFORCEMENT || '').trim().toLowerCase();
  return Object.values(ENFORCEMENT_MODES).includes(raw) ? raw : ENFORCEMENT_MODES.WARN;
};

/**
 * Guards a config write. Validates `value` against the config schema via
 * `validateConfiguration`. A valid config passes silently. An invalid config
 * is, depending on the enforcement mode, ignored (`off`), logged without
 * blocking (`warn`), or rejected (`enforce`).
 *
 * @param {object} params
 * @param {string} params.entityName - e.g. 'Site' (for the log message)
 * @param {string} [params.entityId] - entity id (for the log message)
 * @param {object} params.value - the candidate config object
 * @param {(value: object) => object} params.validate - validateConfiguration
 * @param {object} [params.log] - logger with a `warn` method
 * @throws {ValidationError} in `enforce` mode when validation fails
 */
export const guardConfigValidation = ({
  entityName, entityId, value, validate, log,
}) => {
  const mode = getConfigEnforcementMode();
  if (mode === ENFORCEMENT_MODES.OFF) {
    return;
  }

  try {
    validate(value);
  } catch (error) {
    const message = `config validation violation: ${entityName} ${entityId ?? '<unknown>'}: ${error.message}`;
    if (log) {
      log.warn(message);
    }

    if (mode === ENFORCEMENT_MODES.ENFORCE) {
      throw new ValidationError(`Invalid config for ${entityName}: ${error.message}`);
    }
  }
};
