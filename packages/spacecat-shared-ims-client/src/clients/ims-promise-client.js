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
  encrypt,
  decrypt,
  IMS_INVALIDATE_TOKEN_ENDPOINT,
  IMS_TOKEN_ENDPOINT,
} from '../utils.js';
import ImsBaseClient from './ims-base-client.js';

export default class ImsPromiseClient extends ImsBaseClient {
  static CLIENT_TYPE = {
    EMITTER: 'emitter',
    CONSUMER: 'consumer',
  };

  /**
   * Named IMS emitter/consumer credential pairs. Absent selector => the default
   * (unprefixed) pair. `SEMRUSH` => the dedicated Semrush-scoped pair, read from
   * `IMS_PROMISE_SEMRUSH_*` env vars (see docs/specs/ims-client-promise-pair-selector).
   */
  static PROMISE_PAIR = Object.freeze({
    SEMRUSH: 'SEMRUSH',
  });

  static createFrom(context, type, opts = {}) {
    const { log = console } = context;
    const { pair } = opts;

    if (pair !== undefined
      && !Object.values(ImsPromiseClient.PROMISE_PAIR).includes(pair)) {
      throw new Error(`Unknown IMS promise client pair: ${pair}`);
    }
    const prefix = pair ? `${pair}_` : '';

    const { env } = context;
    const imsHost = env.IMS_HOST;
    const encryption = {
      secret: env.AUTOFIX_CRYPT_SECRET,
      salt: env.AUTOFIX_CRYPT_SALT,
    };

    let clientId;
    let clientSecret;
    let promiseDefinitionId;

    if (type === ImsPromiseClient.CLIENT_TYPE.EMITTER) {
      clientId = env[`IMS_PROMISE_${prefix}EMITTER_CLIENT_ID`];
      clientSecret = env[`IMS_PROMISE_${prefix}EMITTER_CLIENT_SECRET`];
      promiseDefinitionId = env[`IMS_PROMISE_${prefix}EMITTER_DEFINITION_ID`];
    } else if (type === ImsPromiseClient.CLIENT_TYPE.CONSUMER) {
      clientId = env[`IMS_PROMISE_${prefix}CONSUMER_CLIENT_ID`];
      clientSecret = env[`IMS_PROMISE_${prefix}CONSUMER_CLIENT_SECRET`];
    } else {
      throw new Error('Unknown IMS promise client type.');
    }

    if (!hasText(imsHost) || !hasText(clientId) || !hasText(clientSecret)
      || (type === ImsPromiseClient.CLIENT_TYPE.EMITTER && !hasText(promiseDefinitionId))) {
      throw new Error('Context param must include properties: imsHost, clientId, and clientSecret and for EMITTER type also promiseDefinitionId.');
    }

    return new ImsPromiseClient({
      imsHost,
      clientId,
      clientSecret,
      promiseDefinitionId,
      encryption,
    }, log, type);
  }

  /**
   * Creates a new Ims promise client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.imsHost - The IMS host.
   * @param {string} config.clientId - The IMS client ID.
   * @param {string} config.clientSecret - The IMS client secret.
   * @param {string} config.promiseDefinitionId - The IMS promise definition ID.
   * @param {Object} log - The Logger.
   * @param {string} type - The client type.
   * @returns {ImsPromiseClient} - the Ims promise client.
   */
  constructor(config, log, type) {
    super(config, log);
    this.type = type;
  }

  async getPromiseToken(accessToken, enableEncryption = false) {
    if (this.type === ImsPromiseClient.CLIENT_TYPE.CONSUMER) {
      throw new Error('Consumer type does not support getPromiseToken method.');
    }

    try {
      const tokenResponse = await this.imsApiCall(
        IMS_TOKEN_ENDPOINT,
        {},
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'promise',
          promise_definition_id: this.config.promiseDefinitionId,
          authenticating_token: accessToken,
        },
        { noAuth: true, noContentType: true },
      );

      if (!tokenResponse.ok) {
        throw new Error(`IMS getPromiseToken request failed with status: ${tokenResponse.status}`);
      }

      /* eslint-disable camelcase */
      const { promise_token, token_type, expires_in } = await tokenResponse.json();

      // symmetrically encrypt the promise token if secrets are configured. Note that the promise
      // token is not considered a secret, so encryption is optional.
      if (enableEncryption) {
        if (!this.config?.encryption?.secret
          || !this.config?.encryption?.salt) {
          throw new Error('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
        }
        return {
          promise_token: await encrypt(this.config.encryption, promise_token),
          expires_in,
          token_type,
        };
      }

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

  async exchangeToken(promiseToken, enableEncryption = false) {
    if (this.type === ImsPromiseClient.CLIENT_TYPE.EMITTER) {
      throw new Error('Emitter type does not support exchangeToken method.');
    }

    let decryptedPromiseToken = promiseToken;
    if (enableEncryption) {
      if (!this.config?.encryption?.secret
        || !this.config?.encryption?.salt) {
        throw new Error('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
      }
      decryptedPromiseToken = await decrypt(this.config.encryption, promiseToken);
    }

    try {
      const tokenResponse = await this.imsApiCall(
        IMS_TOKEN_ENDPOINT,
        {},
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'promise_exchange',
          promise_token: decryptedPromiseToken,
        },
        { noAuth: true, noContentType: true },
      );

      if (!tokenResponse.ok) {
        throw new Error(`IMS exchangeToken request failed with status: ${tokenResponse.status}`);
      }

      /* eslint-disable camelcase */
      const {
        access_token, token_type, expires_in, promise_token, promise_token_expires_in,
      } = await tokenResponse.json();

      if (enableEncryption) {
        return {
          access_token,
          expires_in,
          token_type,
          promise_token: await encrypt(this.config.encryption, promise_token),
          promise_token_expires_in,
        };
      }

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

  async invalidatePromiseToken(promiseToken, enableEncryption = false) {
    try {
      let decryptedPromiseToken = promiseToken;
      if (enableEncryption) {
        if (!this.config?.encryption?.secret
          || !this.config?.encryption?.salt) {
          throw new Error('Encryption requested, but missing required environment variables: AUTOFIX_CRYPT_SECRET and AUTOFIX_CRYPT_SALT');
        }
        decryptedPromiseToken = await decrypt(this.config.encryption, promiseToken);
      }

      const invalidateResponse = await this.imsApiCall(
        IMS_INVALIDATE_TOKEN_ENDPOINT,
        {},
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          token_type: 'promise_token',
          token: decryptedPromiseToken,
        },
        { noAuth: true, noContentType: true },
      );

      if (!invalidateResponse.ok) {
        throw new Error(`IMS invalidatePromiseToken request failed with status: ${invalidateResponse.status}`);
      }
    } catch (error) {
      this.log.error('Error while fetching data from Ims API: ', error.message);
      throw error;
    }
  }
}
