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

import AWSXray from 'aws-xray-sdk';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  AUTHORING_TYPES, DELIVERY_TYPES, isString, resolveCustomerSecretsName,
} from '@adobe/spacecat-shared-utils';
import ImsPromiseClient from './clients/ims-promise-client.js';

/**
 * @typedef {{
 *   getBaseURL: () => string,
 *   getAuthoringType: () => string,
 *   getDeliveryType: () => string
 * }} Site
 */

/**
 * Get an access token by exchanging a promise token using IMS Promise Client.
 * @param {object} context - The context object containing environment variables.
 * @param {string} promiseToken - The promise token to exchange for an access token.
 * @return {Promise<object>} - A promise that resolves to the access token response.
 */
export async function getAccessToken(context, promiseToken) {
  const imsClient = ImsPromiseClient.createFrom(
    context,
    ImsPromiseClient.CLIENT_TYPE.CONSUMER,
  );

  const token = await imsClient.exchangeToken(
    promiseToken,
    !!context.env?.AUTOFIX_CRYPT_SECRET && !!context.env?.AUTOFIX_CRYPT_SALT,
  );

  return token.access_token;
}

/**
 * Retrieves the page authentication token for a given site.
 *
 * @param {Site} site - The site to retrieve authentication for
 * @param {object} context - The context object
 * @param {object} authOptions - The authentication options
 * @returns {Promise<string>} - The authentication token or access token
 * @throws {Error} - If secret is not found or token is missing
 */
export async function retrievePageAuthentication(site, context, authOptions = {}) {
  const promiseBasedTypes = [AUTHORING_TYPES.CS, AUTHORING_TYPES.CS_CW, AUTHORING_TYPES.AMS];
  if (site
    && (promiseBasedTypes.includes(site.getAuthoringType())
      || site.getDeliveryType() === DELIVERY_TYPES.AEM_CS)
    && authOptions.promiseToken) {
    return getAccessToken(context, authOptions.promiseToken.promise_token);
  }

  const baseURL = site.getBaseURL();
  const customerSecret = resolveCustomerSecretsName(baseURL, context);
  const secretsManagerClient = new SecretsManagerClient({});
  const secretsClient = AWSXray.captureAWSv3Client(secretsManagerClient);
  const command = new GetSecretValueCommand({ SecretId: customerSecret });

  const response = await secretsClient.send(command);
  if (!response.SecretString) {
    throw new Error(`No secret string found for ${customerSecret}`);
  }

  const secrets = JSON.parse(response.SecretString);

  if (!isString(secrets.PAGE_AUTH_TOKEN)) {
    throw new Error(`Missing 'PAGE_AUTH_TOKEN' in secrets for ${customerSecret}`);
  }

  return secrets.PAGE_AUTH_TOKEN;
}
