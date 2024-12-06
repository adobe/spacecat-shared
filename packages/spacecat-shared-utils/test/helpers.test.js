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

/* eslint-env mocha */

import { expect } from 'chai';

import nock from 'nock';
import {
  generateCSVFile,
  resolveSecretsName,
  resolveCustomerSecretsName, getRUMDomainKey,
} from '../src/helpers.js';

describe('resolveSecretsName', () => {
  it('resolves name correctly with valid inputs', () => {
    const ctx = { func: { version: '1.0.0' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/1.0.0');
  });

  it('resolves name correctly with valid ci inputs', () => {
    const ctx = { func: { version: 'ci' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/ci');
  });

  it('resolves name correctly with valid ciXXX inputs', () => {
    const ctx = { func: { version: 'ci123' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/ci');
  });

  it('throws error when ctx is undefined', () => {
    expect(() => resolveSecretsName({}, undefined, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func is undefined', () => {
    const ctx = {};
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func.version is not a string', () => {
    const ctx = { func: { version: null } };
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when defaultPath is not a string', () => {
    const ctx = { func: { version: '1.0.0' } };
    expect(() => resolveSecretsName({}, ctx, null)).to.throw('Invalid defaultPath: must be a string');
  });
});

describe('resolveCustomerSecretsName', () => {
  const baseURL = 'https://site-1.com';
  it('resolves the customer secrets name correctly with valid inputs', () => {
    const ctx = { func: { version: '1.0.0' } };

    const expectedSecretsName = '/helix-deploy/spacecat-services/customer-secrets/site_1_com/1.0.0';
    const actualSecretsName = resolveCustomerSecretsName(baseURL, ctx);

    expect(actualSecretsName).to.equal(expectedSecretsName);
  });

  it('throws error when ctx is undefined', () => {
    expect(() => resolveCustomerSecretsName(baseURL, undefined)).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func is undefined', () => {
    const ctx = {};
    expect(() => resolveCustomerSecretsName(baseURL, ctx)).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func.version is not a string', () => {
    const ctx = { func: { version: null } };
    expect(() => resolveCustomerSecretsName(baseURL, ctx)).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when baseURL is not a valid url', () => {
    const ctx = { func: { version: '1.0.0' } };
    expect(() => resolveCustomerSecretsName('not a valid url', ctx)).to.throw('Invalid baseURL: must be a valid URL');
  });
});

describe('rum utils', () => {
  let context;
  let processEnvCopy;
  beforeEach('setup', () => {
    context = {
      env: {
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'some-key-id',
        AWS_SECRET_ACCESS_KEY: 'some-secret-key',
        AWS_SESSION_TOKEN: 'some-secret-token',
      },
      runtime: { name: 'aws-lambda', region: 'us-east-1' },
      func: { package: 'spacecat-services', version: 'ci', name: 'test' },
    };
    processEnvCopy = { ...process.env };
    process.env = {
      ...process.env,
      ...context.env,
    };
  });

  afterEach('clean up', () => {
    process.env = processEnvCopy;
    nock.cleanAll();
  });

  it('throws error when domain key does not exist', async () => {
    const scope = nock('https://secretsmanager.us-east-1.amazonaws.com/')
      .post('/', (body) => body.SecretId === '/helix-deploy/spacecat-services/customer-secrets/some_domain_com/ci')
      .replyWithError('Some error');

    await expect(getRUMDomainKey('https://some-domain.com', context)).to.be.rejectedWith('Error retrieving the domain key for https://some-domain.com. Error: Some error');
    scope.done();
  });

  it('retrieves the domain key', async () => {
    const scope = nock('https://secretsmanager.us-east-1.amazonaws.com/')
      .post('/', (body) => body.SecretId === '/helix-deploy/spacecat-services/customer-secrets/some_domain_com/ci')
      .reply(200, {
        SecretString: JSON.stringify({
          RUM_DOMAIN_KEY: '42',
        }),
      });

    const rumDomainkey = await getRUMDomainKey('https://some-domain.com', context);
    expect(rumDomainkey).to.equal('42');
    scope.done();
  });
});

describe('generateCSVFile', () => {
  it('should convert the JSON data to CSV', () => {
    const data = [
      {
        'Base URL': 'https://site-0.com',
        'Delivery Type': '',
        'Go Live Date': '2024-03-18',
        'Performance Score': '---',
        Error: 'Lighthouse Error: No First Contentful Paint [NO_FCP]',
      },
      {
        'Base URL': 'https://site-1.com',
        'Delivery Type': 'aem_cs',
        'Go Live Date': '2024-03-18',
        'Performance Score': '90',
        Error: '',
      },
    ];
    const expectedCSV = '"Base URL","Delivery Type","Go Live Date","Performance Score","Error"\n'
      + '"https://site-0.com","","2024-03-18","---","Lighthouse Error: No First Contentful Paint [NO_FCP]"\n'
      + '"https://site-1.com","aem_cs","2024-03-18","90",""';
    const csv = generateCSVFile(data);
    expect(csv).to.be.an.instanceof(Buffer);
    expect(csv.toString('utf-8')).to.equal(expectedCSV);
  });

  it('should handle various data types in JSON objects', () => {
    // Sample data with various types
    const data = [
      {
        string: 'text',
        number: 42,
        boolean: true,
        nullValue: null,
        array: [1, 2, 3],
        object: { key: 'value' },
      },
    ];
    const expectedCsv = '"string","number","boolean","nullValue","array","object"\n'
      + '"text",42,true,,"[1,2,3]","{""key"":""value""}"';

    const csvFile = generateCSVFile(data);
    const csvString = csvFile.toString('utf-8');

    expect(csvString).to.equal(expectedCsv);
  });
});
