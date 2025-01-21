/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { Parser } from '@json2csv/plainjs';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { isString } from './functions.js';

/**
 * Resolves the name of the secret based on the function version.
 * @param {Object} opts - The options object, not used in this implementation.
 * @param {Object} ctx - The context object containing the function version.
 * @param {string} defaultPath - The default path for the secret.
 * @returns {string} - The resolved secret name.
 */
export function resolveSecretsName(opts, ctx, defaultPath) {
  let funcVersion = ctx?.func?.version;

  if (!isString(funcVersion)) {
    throw new Error('Invalid context: func.version is required and must be a string');
  }
  if (!isString(defaultPath)) {
    throw new Error('Invalid defaultPath: must be a string');
  }

  // if funcVersion is something like ci123, then use ci directly
  funcVersion = /^ci\d+$/i.test(funcVersion) ? 'ci' : funcVersion;

  return `${defaultPath}/${funcVersion}`;
}

/**
 * Resolves the name of the customer secrets based on the baseURL.
 * @param {string} baseURL - The base URL to resolve the customer secrets name from.
 * @param {Object} ctx - The context object containing the function version.
 * @returns {string} - The resolved secret name.
 */
export function resolveCustomerSecretsName(baseURL, ctx) {
  const basePath = '/helix-deploy/spacecat-services/customer-secrets';
  let customer;
  try {
    customer = new URL(baseURL).host.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  } catch {
    throw new Error('Invalid baseURL: must be a valid URL');
  }
  return resolveSecretsName({}, ctx, `${basePath}/${customer}`);
}

/**
 * Retrieves the RUM domain key for the specified base URL from the customer secrets.
 *
 * @param {string} baseURL - The base URL for which the RUM domain key is to be retrieved.
 * @param {UniversalContext} context - Helix Universal Context. See https://github.com/adobe/helix-universal/blob/main/src/adapter.d.ts#L120
 * @returns {Promise<string>} - A promise that resolves to the RUM domain key.
 * @throws {Error} Throws an error if no domain key is found for the specified base URL.
 */
export async function getRUMDomainKey(baseURL, context) {
  const customerSecretName = resolveCustomerSecretsName(baseURL, context);
  const { runtime } = context;

  try {
    const client = new SecretsManagerClient({ region: runtime.region });
    const command = new GetSecretValueCommand({
      SecretId: customerSecretName,
    });
    const response = await client.send(command);
    return JSON.parse(response.SecretString)?.RUM_DOMAIN_KEY;
  } catch (error) {
    throw new Error(`Error retrieving the domain key for ${baseURL}. Error: ${error.message}`);
  }
}

/**
 * Generates a CSV file from the provided JSON data.
 *
 * Each key-value pair in the JSON objects
 * corresponds to a column and its value in the CSV. The output is a UTF-8
 * encoded Buffer that represents the CSV file content.
 *
 * @param {Object[]} data - An array of JSON objects to be converted into CSV format.
 * @returns {Buffer} A Buffer containing the CSV formatted data, encoded in UTF-8.
 */
export function generateCSVFile(data) {
  const json2csvParser = new Parser();
  return Buffer.from(json2csvParser.parse(data), 'utf-8');
}

/**
 * Replaces placeholders in the prompt content with their corresponding values.
 *
 * @param {string} content - The prompt content with placeholders.
 * @param {Object} placeholders - The placeholders and their values.
 * @returns {string} - The content with placeholders replaced.
 */
export function replacePlaceholders(content, placeholders) {
  return content.replace(/{{(.*?)}}/g, (match, key) => {
    if (key in placeholders) {
      const value = placeholders[key];
      return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    } else {
      return match;
    }
  });
}
