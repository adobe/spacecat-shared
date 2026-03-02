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

/* eslint-env mocha */

import { expect } from 'chai';

import { createDataAccess } from '../../../src/service/index.js';

describe('service/index', () => {
  it('uses provided PostgREST client and does not require postgrestUrl', () => {
    const client = {};
    const dataAccess = createDataAccess({}, console, client);

    expect(dataAccess).to.be.an('object');
  });

  it('throws when postgrestUrl is missing and no client is provided', () => {
    expect(() => createDataAccess({}, console))
      .to.throw('postgrestUrl is required to create data access');
  });

  it('creates data access with PostgREST config and no S3 bucket', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      postgrestSchema: 'public',
      postgrestApiKey: 'api-key',
      postgrestHeaders: {
        'x-test-header': 'value',
      },
    }, console);

    expect(dataAccess).to.be.an('object');
  });

  it('creates data access with optional S3 config', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      s3Bucket: 'test-bucket',
      region: 'us-east-1',
    }, console, {});

    expect(dataAccess).to.be.an('object');
  });

  it('creates data access with S3 bucket and default region options', () => {
    const dataAccess = createDataAccess({
      postgrestUrl: 'http://localhost:3000',
      s3Bucket: 'test-bucket',
    }, console, {});

    expect(dataAccess).to.be.an('object');
  });
});
