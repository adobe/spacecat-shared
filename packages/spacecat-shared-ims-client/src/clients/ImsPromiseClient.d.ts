/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { UniversalContext } from '@adobe/helix-universal';

export class ImsPromiseClient {
  /**
   * Creates a new ImsPromiseClient instance from the given UniversalContext and of the
   * given type, either an emitter or consumer client.
   * @param {UniversalContext} context The UniversalContext to use for creating
   *                                   the ImsPromiseClient.
   * @param {string} type The type of the client, either 'emitter' or 'consumer'.
   * @returns {ImsPromiseClient} The ImsPromiseClient instance.
   */
  static createFrom(context: UniversalContext, type: string): ImsPromiseClient;

  /**
   * Returns a promise token for the given access token.
   * @param {string} accessToken The access token to get a promise token for.
   * @param {boolean} enableEncryption Whether to enable encryption of the promise
   *                                   token, default false.
   * @throws Error when encryption is enabled and the encryption secret and salt is not set.
   * @returns {Promise<{
   *        promise_token: string,
   *        token_type: string,
   *        expires_in: number,
   *    }>} The promise token.
   */
  getPromiseToken(accessToken: string, enableEncryption?: boolean): Promise<object>;

  /**
   * Exchanges a promise token for an access token.
   * @param {string} promiseToken The promise token to exchange for an access token.
   * @param {boolean} enableEncryption Whether to enable encryption of the promise
   *                                   token, default false.
   * @throws Error when encryption is enabled and the encryption secret and salt is not set.
   * @returns {Promise<{
   *        access_token: string,
   *        token_type: string,
   *        expires_in: number,
   *        promise_token: string,
   *        promise_token_expires_in: number,
   *    }>} The access token and a possibly refreshed promise token.
   */
  exchangeToken(promiseToken: string, enableEncryption?: boolean): Promise<object>;

  /**
   * Invalidates a promise token.
   * @param {string} promiseToken The promise token to invalidate.
   * @param {boolean} enableEncryption Whether to enable encryption of the promise
   *                                   token, default false.
   * @throws Error when encryption is enabled and the encryption secret and salt is not set.
   * @returns {Promise<void>} A promise that resolves when the token is invalidated.
   */
  invalidatePromiseToken(promiseToken: string, enableEncryption?: boolean): Promise<void>;
}
