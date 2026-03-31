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

import { noCache, h1NoCache } from '@adobe/fetch';

let cachedFetch;

/**
 * Returns the pooled @adobe/fetch client (HTTP/2 by default, HTTP/1 when
 * HELIX_FETCH_FORCE_HTTP1 is set — used in tests with nock).
 * Lazily initialized; use {@link resetHelixFetchClient} in tests to re-read env.
 */
export function getHelixFetch() {
  if (!cachedFetch) {
    cachedFetch = (process.env.HELIX_FETCH_FORCE_HTTP1 ? h1NoCache() : noCache()).fetch;
  }
  return cachedFetch;
}

/** @internal test hook — clears lazy fetch so HELIX_FETCH_FORCE_HTTP1 can vary */
export function resetHelixFetchClient() {
  cachedFetch = undefined;
}
