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

import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import nock from 'nock';
import { loadBootstrapConfig } from '../src/bootstrap.js';

use(chaiAsPromised);

describe('bootstrap', () => {
  const REGION = 'us-east-1';
  const AWS_ENDPOINT = `https://secretsmanager.${REGION}.amazonaws.com`;

  beforeEach(() => {
    process.env.AWS_REGION = REGION;
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.AWS_SESSION_TOKEN = 'test-session-token';
  });

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  it('loads bootstrap config from AWS Secrets Manager', async () => {
    const bootstrapSecret = {
      role_id: 'test-role-id',
      secret_id: 'test-secret-id',
      vault_addr: 'https://vault-amer.adobe.net',
      mount_point: 'dx_mysticat',
      environment: 'prod',
    };

    nock(AWS_ENDPOINT)
      .post('/', (body) => {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        return parsed.SecretId === '/mysticat/vault-bootstrap';
      })
      .matchHeader('X-Amz-Target', 'secretsmanager.GetSecretValue')
      .reply(200, {
        SecretString: JSON.stringify(bootstrapSecret),
      });

    const config = await loadBootstrapConfig({
      bootstrapPath: '/mysticat/vault-bootstrap',
    });

    expect(config).to.deep.equal(bootstrapSecret);
  });

  it('throws on missing bootstrap secret', async () => {
    nock(AWS_ENDPOINT)
      .post('/')
      .reply(400, {
        __type: 'ResourceNotFoundException',
        message: "Secrets Manager can't find the specified secret.",
      });

    await expect(loadBootstrapConfig({
      bootstrapPath: '/mysticat/vault-bootstrap',
    })).to.be.rejectedWith('Failed to load Vault bootstrap config');
  });

  it('throws on network error', async () => {
    nock(AWS_ENDPOINT)
      .post('/')
      .replyWithError('connection refused');

    await expect(loadBootstrapConfig({
      bootstrapPath: '/mysticat/vault-bootstrap',
    })).to.be.rejectedWith('Failed to load Vault bootstrap config');
  });

  it('throws on missing AWS credentials', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await expect(loadBootstrapConfig({
      bootstrapPath: '/mysticat/vault-bootstrap',
    })).to.be.rejectedWith('Missing AWS credentials for Vault bootstrap');
  });
});
