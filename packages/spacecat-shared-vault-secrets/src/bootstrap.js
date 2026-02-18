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

import aws4 from 'aws4';

/**
 * Loads Vault AppRole bootstrap credentials from AWS Secrets Manager.
 * This is the only AWS call in the entire package.
 *
 * @param {object} options
 * @param {string} options.bootstrapPath - The Secrets Manager secret ID
 *   (e.g. '/mysticat/vault-bootstrap')
 * @returns {Promise<object>} The parsed secret containing role_id, secret_id,
 *   vault_addr, mount_point, and environment.
 */
// eslint-disable-next-line import/prefer-default-export
export async function loadBootstrapConfig({ bootstrapPath }) {
  const {
    AWS_REGION: region = 'us-east-1',
    AWS_ACCESS_KEY_ID: accessKeyId,
    AWS_SECRET_ACCESS_KEY: secretAccessKey,
    AWS_SESSION_TOKEN: sessionToken,
  } = process.env;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS credentials for Vault bootstrap');
  }

  const host = `secretsmanager.${region}.amazonaws.com`;
  const body = JSON.stringify({
    SecretId: bootstrapPath,
  });

  const opts = aws4.sign({
    service: 'secretsmanager',
    region,
    method: 'POST',
    path: '/',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'secretsmanager.GetSecretValue',
      Host: host,
    },
    body,
  }, {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  });

  let response;
  try {
    response = await fetch(`https://${host}${opts.path}`, {
      method: opts.method,
      headers: opts.headers,
      body,
    });
  } catch (e) {
    throw new Error(`Failed to load Vault bootstrap config: ${e.message}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load Vault bootstrap config: ${response.status} ${text}`);
  }

  const data = await response.json();
  return JSON.parse(data.SecretString);
}
