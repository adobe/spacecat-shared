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

import { hasText } from '@adobe/spacecat-shared-utils';
import ImsPromiseClient from './ims-promise-client.js';
import NeedsReauthError from './needs-reauth-error.js';

// IMS returns 401 (invalid/expired promise token) or 403 on an exchange that can no
// longer be completed without the user re-authenticating.
const REAUTH_STATUS_PATTERN = /status: (401|403)/;

export { NeedsReauthError };

/**
 * Wraps a CONSUMER-type ImsPromiseClient to carry a promise token across repeated
 * exchanges within a single long-running job (e.g. an SQS-triggered worker).
 *
 * The access token IMS hands back on exchange is short-lived (~5 min), but each
 * exchange also rolls the promise token forward with its own, longer-lived expiry.
 * A caller that must exchange more than once (job runtime exceeding the access
 * token TTL) needs the *previous* exchange's rolled promise token, not the
 * original one — `ImsPromiseClient.exchangeToken` returns that rolled token but
 * does not persist it. This class does.
 */
export class PromiseTokenSession {
  /**
   * @param {ImsPromiseClient} imsPromiseClient - a CONSUMER-type client.
   * @param {string} initialPromiseToken - the promise token minted upstream and
   *   carried through the queue (possibly encrypted, if enableEncryption is set).
   * @param {Object} [options]
   * @param {boolean} [options.enableEncryption] - whether the promise token on the
   *   wire is symmetrically encrypted; must match what the emitter used.
   */
  constructor(imsPromiseClient, initialPromiseToken, options = {}) {
    if (!(imsPromiseClient instanceof ImsPromiseClient)) {
      throw new Error('PromiseTokenSession requires an ImsPromiseClient instance.');
    }
    if (imsPromiseClient.type !== ImsPromiseClient.CLIENT_TYPE.CONSUMER) {
      throw new Error('PromiseTokenSession requires a CONSUMER-type ImsPromiseClient.');
    }
    if (!hasText(initialPromiseToken)) {
      throw new Error('PromiseTokenSession requires a non-empty initial promise token.');
    }

    this.client = imsPromiseClient;
    this.enableEncryption = Boolean(options.enableEncryption);
    this.promiseToken = initialPromiseToken;
    this.promiseTokenExpiresAt = null;
    this.accessToken = null;
    this.accessTokenExpiresAt = null;
    this.invalidated = false;
  }

  /**
   * @returns {boolean} true once the current promise token's rolled expiry has
   *   passed. Returns false if no exchange has happened yet (expiry unknown).
   */
  isExpired() {
    return this.promiseTokenExpiresAt !== null && Date.now() >= this.promiseTokenExpiresAt;
  }

  /**
   * @returns {number|null} milliseconds until the current promise token expires,
   *   or null if unknown (no exchange has happened yet).
   */
  getRemainingMs() {
    if (this.promiseTokenExpiresAt === null) {
      return null;
    }
    return Math.max(0, this.promiseTokenExpiresAt - Date.now());
  }

  /**
   * Exchanges the current promise token for a fresh access token, persisting the
   * rolled promise token (and its expiry) returned by IMS for any subsequent call.
   *
   * @returns {Promise<string>} the access token.
   * @throws {NeedsReauthError} when the promise token can no longer be exchanged.
   */
  async exchange() {
    if (this.invalidated) {
      throw new NeedsReauthError('Promise token session has already been invalidated.');
    }

    let result;
    try {
      result = await this.client.exchangeToken(this.promiseToken, this.enableEncryption);
    } catch (error) {
      if (REAUTH_STATUS_PATTERN.test(error.message)) {
        throw new NeedsReauthError(
          `Promise token exchange requires re-authentication: ${error.message}`,
          error,
        );
      }
      throw error;
    }

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      promise_token: rolledPromiseToken,
      promise_token_expires_in: rolledPromiseTokenExpiresIn,
    } = result;

    this.accessToken = accessToken;
    this.accessTokenExpiresAt = Date.now() + (expiresIn * 1000);

    // The rolled promise token is what makes a second exchange later in the same
    // job possible; the original token is single-use once exchanged.
    if (hasText(rolledPromiseToken)) {
      this.promiseToken = rolledPromiseToken;
    }
    if (typeof rolledPromiseTokenExpiresIn === 'number') {
      this.promiseTokenExpiresAt = Date.now() + (rolledPromiseTokenExpiresIn * 1000);
    }

    return this.accessToken;
  }

  /**
   * Invalidates the current promise token with IMS, time-bounding the blast
   * radius of a token that's no longer needed (job completed or failed).
   * Idempotent: a no-op if already invalidated or if no token was ever set.
   *
   * @returns {Promise<void>}
   */
  async invalidate() {
    if (this.invalidated) {
      return;
    }

    try {
      await this.client.invalidatePromiseToken(this.promiseToken, this.enableEncryption);
    } finally {
      this.invalidated = true;
    }
  }
}

/**
 * @param {ImsPromiseClient} imsPromiseClient - a CONSUMER-type client.
 * @param {string} initialPromiseToken
 * @param {Object} [options]
 * @param {boolean} [options.enableEncryption]
 * @returns {PromiseTokenSession}
 */
export function createPromiseTokenSession(imsPromiseClient, initialPromiseToken, options) {
  return new PromiseTokenSession(imsPromiseClient, initialPromiseToken, options);
}
