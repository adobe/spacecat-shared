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

import { isNonEmptyArray, isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import DataAccessError from '../errors/data-access.error.js';

/**
 * Ensures the current caller has the required capability.
 * End-user tokens have an empty s2sCtx and are always allowed.
 * S2S consumer tokens must carry the required capability in their capabilities list.
 *
 * @param {object} s2sCtx - The S2S context from config (empty object for end-users).
 * @param {string} requiredCapability - The capability to check, e.g. 'site:write'.
 * @throws {DataAccessError} If the S2S consumer lacks the required capability.
 */
export function ensureCapability(s2sCtx, requiredCapability) {
  if (!isNonEmptyObject(s2sCtx)) {
    return;
  }

  const { capabilities } = s2sCtx;
  if (!isNonEmptyArray(capabilities) || !capabilities.includes(requiredCapability)) {
    throw new DataAccessError(
      `Forbidden: S2S consumer is missing required capability: ${requiredCapability}`,
    );
  }
}
