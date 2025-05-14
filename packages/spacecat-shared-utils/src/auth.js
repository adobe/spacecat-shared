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

import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { isString } from './functions.js';
import { resolveCustomerSecretsName } from './helpers.js';

/**
 * Retrieves the page authentication token for a given site.
 *
 * @param {string} siteId - The site ID to retrieve authentication for
 * @param {object} context - The context object containing dataAccess and services
 * @returns {Promise<string>} - The authentication token
 * @throws {Error} - If site not found, secret not found, or token missing
 */
export async function retrievePageAuthentication(siteId, context) {
  const { dataAccess: { Site }, attributes: { services } } = context;
  const site = await Site.findById(siteId);
  if (!site) {
    throw new Error(`Site with ID ${siteId} not found, cannot resolve customer secrets for authentication`);
  }
  const baseURL = site.getBaseURL();
  const customerSecret = resolveCustomerSecretsName(baseURL, context);
  const secretsClient = services.xray.captureAWSv3Client(services.secretsClient);
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
