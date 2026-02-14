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
import sinon from 'sinon';
import { createDataAccess } from '../../../src/service/index.js';

describe('createDataAccess', () => {
  const log = {
    info: sinon.stub(),
    debug: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
  };

  const savedBackend = process.env.DATA_ACCESS_BACKEND;

  afterEach(() => {
    if (savedBackend === undefined) {
      delete process.env.DATA_ACCESS_BACKEND;
    } else {
      process.env.DATA_ACCESS_BACKEND = savedBackend;
    }
    sinon.restore();
  });

  describe('DATA_ACCESS_BACKEND feature flag', () => {
    it('defaults to dynamodb when DATA_ACCESS_BACKEND is not set', () => {
      delete process.env.DATA_ACCESS_BACKEND;
      const da = createDataAccess({ tableNameData: 'test-table' }, log);
      expect(da).to.be.an('object');
      expect(da.Site).to.be.an('object');
    });

    it('uses dynamodb when explicitly set to "dynamodb"', () => {
      process.env.DATA_ACCESS_BACKEND = 'dynamodb';
      const da = createDataAccess({ tableNameData: 'test-table' }, log);
      expect(da).to.be.an('object');
      expect(da.Site).to.be.an('object');
    });

    it('defaults to dynamodb when DATA_ACCESS_BACKEND is empty string', () => {
      process.env.DATA_ACCESS_BACKEND = '';
      const da = createDataAccess({ tableNameData: 'test-table' }, log);
      expect(da).to.be.an('object');
      expect(da.Site).to.be.an('object');
    });

    it('throws on invalid backend value', () => {
      process.env.DATA_ACCESS_BACKEND = 'invalid';
      expect(() => createDataAccess({ tableNameData: 'test-table' }, log))
        .to.throw('Invalid DATA_ACCESS_BACKEND: "invalid". Must be "dynamodb" or "postgresql".');
    });

    it('creates postgres data access when set to "postgresql"', () => {
      process.env.DATA_ACCESS_BACKEND = 'postgresql';
      const da = createDataAccess({ postgrestUrl: 'http://localhost:3000' }, log);
      expect(da).to.be.an('object');
    });

    it('throws when postgresql backend has no postgrestUrl', () => {
      process.env.DATA_ACCESS_BACKEND = 'postgresql';
      expect(() => createDataAccess({}, log))
        .to.throw('postgrestUrl is required for PostgreSQL backend');
    });

    it('prefers config.dataAccessBackend over process.env', () => {
      process.env.DATA_ACCESS_BACKEND = 'dynamodb';
      const da = createDataAccess({
        dataAccessBackend: 'postgresql',
        postgrestUrl: 'http://localhost:3000',
      }, log);
      expect(da).to.be.an('object');
    });

    it('falls back to process.env when config.dataAccessBackend is not set', () => {
      process.env.DATA_ACCESS_BACKEND = 'postgresql';
      const da = createDataAccess({ postgrestUrl: 'http://localhost:3000' }, log);
      expect(da).to.be.an('object');
    });

    it('uses config.dataAccessBackend for validation', () => {
      delete process.env.DATA_ACCESS_BACKEND;
      expect(() => createDataAccess({ dataAccessBackend: 'invalid' }, log))
        .to.throw('Invalid DATA_ACCESS_BACKEND: "invalid". Must be "dynamodb" or "postgresql".');
    });
  });
});
