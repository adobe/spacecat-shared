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

import { hasText } from '@adobe/spacecat-shared-utils';
import {
  createFormData,
  fetch as httpFetch,
  IMS_INVALIDATE_TOKEN_ENDPOINT,
  IMS_TOKEN_ENDPOINT,
} from '../utils.js';

export default class ImsPromiseClient {
  static CLIENT_TYPE = {
    EMITTER: 'emitter',
    CONSUMER: 'consumer',
  };

  static createFrom(context, type) {
    const { log = console } = context;

    let imsHost;
    let clientId;
    let clientSecret;
    let promiseDefinitionId;

    if (type === ImsPromiseClient.CLIENT_TYPE.EMITTER) {
      ({
        IMS_HOST: imsHost,
        IMS_PROMISE_EMITTER_CLIENT_ID: clientId,
        IMS_PROMISE_EMITTER_CLIENT_SECRET: clientSecret,
        IMS_PROMISE_EMITTER_DEFINITION_ID: promiseDefinitionId,
      } = context.env);
    } else if (type === ImsPromiseClient.CLIENT_TYPE.CONSUMER) {
      ({
        IMS_HOST: imsHost,
        IMS_PROMISE_CONSUMER_CLIENT_ID: clientId,
        IMS_PROMISE_CONSUMER_CLIENT_SECRET: clientSecret,
      } = context.env);
    } else {
      throw new Error('Unknown IMS promise client type.');
    }

    if (!hasText(imsHost) || !hasText(clientId) || !hasText(clientSecret)
      || (type === ImsPromiseClient.CLIENT_TYPE.EMITTER && !hasText(promiseDefinitionId))) {
      throw new Error('Context param must include properties: imsHost, clientId, and clientSecret and for CONSUMER type also promiseDefinitionId.');
    }

    return new ImsPromiseClient({
      imsHost,
      clientId,
      clientSecret,
      promiseDefinitionId,
    }, type, log);
  }

  /**
   * Creates a new Ims promise client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.imsHost - The IMS host.
   * @param {string} config.clientId - The IMS client ID.
   * @param {string} config.clientSecret - The IMS client secret.
   * @param {string} config.promiseDefinitionId - The IMS promise definition ID.
   * @param {string} type - The client type.
   * @param {Object} log - The Logger.
   * @returns {ImsPromiseClient} - the Ims promise client.
   */
  constructor(config, type, log) {
    this.config = config;
    this.type = type;
    this.log = log;
  }

  #logDuration(message, startTime) {
    const endTime = process.hrtime.bigint();
    const duration = (endTime - startTime) / BigInt(1e6);
    this.log.debug(`${message}: took ${duration}ms`);
  }

  async getPromiseToken(accessToken) {
    if (this.type === ImsPromiseClient.CLIENT_TYPE.CONSUMER) {
      throw new Error('Consumer type does not support getPromiseToken method.');
    }

    try {
      const startTime = process.hrtime.bigint();

      const tokenResponse = await httpFetch(
        `https://${this.config.imsHost}${IMS_TOKEN_ENDPOINT}`,
        {
          method: 'POST',
          body: createFormData({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'promise',
            promise_definition_id: this.config.promiseDefinitionId,
            authenticating_token: accessToken,
          }),
        },
      );

      this.#logDuration('IMS getPromiseToken request', startTime);

      if (!tokenResponse.ok) {
        throw new Error(`IMS getPromiseToken request failed with status: ${tokenResponse.status}`);
      }

      /* eslint-disable camelcase */
      const { promise_token, token_type, expires_in } = await tokenResponse.json();

      return {
        promise_token,
        expires_in,
        token_type,
      };
    } catch (error) {
      this.log.error('Error while fetching data from Ims API: ', error.message);
      throw error;
    }
  }

  async exchangeToken(promiseToken) {
    if (this.type === ImsPromiseClient.CLIENT_TYPE.EMITTER) {
      throw new Error('Emitter type does not support exchangeToken method.');
    }

    try {
      const startTime = process.hrtime.bigint();

      const tokenResponse = await httpFetch(
        `https://${this.config.imsHost}${IMS_TOKEN_ENDPOINT}`,
        {
          method: 'POST',
          body: createFormData({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'promise_exchange',
            promise_token: promiseToken,
          }),
        },
      );

      this.#logDuration('IMS exchangeToken request', startTime);

      if (!tokenResponse.ok) {
        throw new Error(`IMS exchangeToken request failed with status: ${tokenResponse.status}`);
      }

      /* eslint-disable camelcase */
      const {
        access_token, token_type, expires_in, promise_token, promise_token_expires_in,
      } = await tokenResponse.json();

      return {
        access_token,
        expires_in,
        token_type,
        promise_token,
        promise_token_expires_in,
      };
    } catch (error) {
      this.log.error('Error while fetching data from Ims API: ', error.message);
      throw error;
    }
  }

  async invalidatePromiseToken(promiseToken) {
    try {
      const startTime = process.hrtime.bigint();

      const invalidateResponse = await httpFetch(
        `https://${this.config.imsHost}${IMS_INVALIDATE_TOKEN_ENDPOINT}`,
        {
          method: 'POST',
          body: createFormData({
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            token_type: 'promise_token',
            token: promiseToken,
          }),
        },
      );

      this.#logDuration('IMS invalidatePromiseToken request', startTime);

      if (!invalidateResponse.ok) {
        throw new Error(`IMS invalidatePromiseToken request failed with status: ${invalidateResponse.status}`);
      }
    } catch (error) {
      this.log.error('Error while fetching data from Ims API: ', error.message);
      throw error;
    }
  }
}
