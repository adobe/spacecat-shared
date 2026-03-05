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

import { expect } from 'chai';

import { createDataAccess } from '../../../src/service/index.js';
import { POSTGREST_WRITER_JWT } from '../util/postgrest-jwt.js';

/**
 * Creates a data access instance with a capturing logger so we can
 * assert on log output produced by #logAndThrowError.
 */
const createITDataAccessWithLogs = () => {
  const logs = {
    error: [], warn: [], info: [], debug: [],
  };
  const log = {
    error: (...args) => logs.error.push(args),
    warn: (...args) => logs.warn.push(args),
    info: (...args) => logs.info.push(args),
    debug: (...args) => logs.debug.push(args),
    trace: () => {},
  };

  const postgrestUrl = process.env.POSTGREST_URL || 'http://127.0.0.1:3300';
  const postgrestApiKey = process.env.POSTGREST_API_KEY || POSTGREST_WRITER_JWT;
  const dataAccess = createDataAccess({ postgrestUrl, postgrestApiKey }, log);

  return { dataAccess, logs };
};

describe('PostgREST IT - error logging', () => {
  it('logs PG error code on FK constraint violation (create)', async () => {
    const { dataAccess, logs } = createITDataAccessWithLogs();

    let error;
    try {
      await dataAccess.Opportunity.create({
        siteId: '00000000-0000-0000-0000-000000000000',
        type: 'test-fk',
        origin: 'AI',
        title: 'FK violation test',
      });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.name).to.equal('DataAccessError');

    // details carries entityName + tableName, not the full collection instance
    expect(error.details).to.have.property('entityName');
    expect(error.details).to.have.property('tableName');
    expect(error.details).to.not.have.property('postgrestService');

    // cause preserves the original PostgrestError with PG code
    expect(error.cause).to.exist;
    expect(error.cause.code).to.equal('23503');

    // log string includes entity name and PG error code
    const errorLog = logs.error[0]?.[0];
    expect(errorLog).to.be.a('string');
    expect(errorLog).to.include('[opportunity]');
    expect(errorLog).to.include('[23503]');

    // no double-logging
    expect(logs.error).to.have.lengthOf(1);
  });

  it('logs PG error code on FK constraint violation (createMany)', async () => {
    const { dataAccess, logs } = createITDataAccessWithLogs();

    let error;
    try {
      await dataAccess.Suggestion.createMany([
        {
          opportunityId: '00000000-0000-0000-0000-000000000000',
          type: 'CODE_CHANGE',
          rank: 1,
          data: { test: true },
        },
      ]);
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.name).to.equal('DataAccessError');
    expect(error.cause).to.exist;
    expect(error.cause.code).to.equal('23503');

    const errorLog = logs.error[0]?.[0];
    expect(errorLog).to.be.a('string');
    expect(errorLog).to.include('[suggestion]');
    expect(errorLog).to.include('[23503]');
    expect(logs.error).to.have.lengthOf(1);
  });

  it('does not leak credentials in DataAccessError details', async () => {
    const { dataAccess } = createITDataAccessWithLogs();

    let error;
    try {
      await dataAccess.Opportunity.create({
        siteId: '00000000-0000-0000-0000-000000000000',
        type: 'test',
        origin: 'AI',
        title: 'Credential leak test',
      });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;

    const serialized = JSON.stringify(error.details);
    expect(serialized).to.not.include('Bearer');
    expect(serialized).to.not.include('apikey');
    expect(serialized).to.not.include('Authorization');
  });

  it('preserves PG error details string in cause', async () => {
    const { dataAccess } = createITDataAccessWithLogs();

    let error;
    try {
      await dataAccess.Opportunity.create({
        siteId: '00000000-0000-0000-0000-000000000000',
        type: 'test',
        origin: 'AI',
        title: 'Details test',
      });
    } catch (e) {
      error = e;
    }

    expect(error).to.exist;
    expect(error.cause).to.exist;
    // PostgREST returns FK violation details with the key info
    expect(error.cause.details).to.be.a('string');
    expect(error.cause.details).to.include('site_id');
  });
});
