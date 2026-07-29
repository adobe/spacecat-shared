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

import type { ImsPromiseClient } from './ImsPromiseClient.d.ts';

export class NeedsReauthError extends Error {
  static CODE: 'NEEDS_REAUTH';
  code: 'NEEDS_REAUTH';
  cause?: Error;
}

export class PromiseTokenSession {
  /**
   * @param {ImsPromiseClient} imsPromiseClient A CONSUMER-type ImsPromiseClient.
   * @param {string} initialPromiseToken The promise token carried through the queue.
   * @param {{ enableEncryption?: boolean }} [options]
   */
  constructor(
    imsPromiseClient: ImsPromiseClient,
    initialPromiseToken: string,
    options?: { enableEncryption?: boolean },
  );

  /**
   * @returns {boolean} Whether the current promise token has expired.
   */
  isExpired(): boolean;

  /**
   * @returns {number | null} Milliseconds until expiry, or null if unknown.
   */
  getRemainingMs(): number | null;

  /**
   * Exchanges the current promise token for a fresh access token, persisting
   * the rolled promise token for any subsequent exchange in this session.
   * @throws {NeedsReauthError} When the promise token can no longer be exchanged.
   * @returns {Promise<string>} The access token.
   */
  exchange(): Promise<string>;

  /**
   * Invalidates the current promise token with IMS. Idempotent.
   * @returns {Promise<void>}
   */
  invalidate(): Promise<void>;
}

/**
 * @param {ImsPromiseClient} imsPromiseClient A CONSUMER-type ImsPromiseClient.
 * @param {string} initialPromiseToken
 * @param {{ enableEncryption?: boolean }} [options]
 * @returns {PromiseTokenSession}
 */
export declare function createPromiseTokenSession(
  imsPromiseClient: ImsPromiseClient,
  initialPromiseToken: string,
  options?: { enableEncryption?: boolean },
): PromiseTokenSession;
