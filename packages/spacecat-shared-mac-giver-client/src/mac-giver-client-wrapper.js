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

import MacGiverClient from './mac-giver-client.js';

/**
 * Wrapper that creates a MacGiverClient and attaches it to context.macGiverClient.
 * Must be placed after imsClientWrapper in the chain — it requires context.imsClient.
 *
 * @param {UniversalAction} fn
 * @returns {function(object, UniversalContext): Promise<Response>}
 */
export function macGiverClientWrapper(fn) {
  return async (request, context) => {
    if (!context.macGiverClient) {
      context.macGiverClient = MacGiverClient.createFrom(context);
    }
    return fn(request, context);
  };
}
