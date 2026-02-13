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
/* eslint-disable no-underscore-dangle */

import { expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresAuditCollection from '../../../../../src/models/postgres/audit/audit.pg.collection.js';
import PostgresAuditModel from '../../../../../src/models/postgres/audit/audit.pg.model.js';
import Schema from '../../../../../src/models/base/schema.js';

chaiUse(chaiAsPromised);

function createMockPostgrestClient(responseData = [], responseError = null) {
  const chain = {
    select: sinon.stub(),
    eq: sinon.stub(),
    in: sinon.stub(),
    order: sinon.stub(),
    range: sinon.stub(),
    gte: sinon.stub(),
    lte: sinon.stub(),
    insert: sinon.stub(),
    upsert: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    single: sinon.stub(),
    maybeSingle: sinon.stub(),
    then: null,
  };

  Object.keys(chain).forEach((key) => {
    if (key !== 'then' && chain[key]) {
      chain[key].returns(chain);
    }
  });

  chain.then = (resolve) => resolve({ data: responseData, error: responseError });
  chain.maybeSingle.returns({
    then: (resolve) => resolve({ data: responseData, error: responseError }),
  });

  const client = {
    from: sinon.stub().returns(chain),
    _chain: chain,
  };

  return client;
}

function createAuditSchema() {
  return new Schema(
    PostgresAuditModel,
    PostgresAuditCollection,
    {
      serviceName: 'SpaceCat',
      schemaVersion: 1,
      attributes: {
        auditId: { type: 'string', required: true },
        siteId: { type: 'string', required: true },
        auditType: { type: 'string', required: true },
        auditResult: { type: 'any', required: true },
        fullAuditRef: { type: 'string', required: true },
        isLive: { type: 'boolean', default: false },
        isError: { type: 'boolean', default: false },
        auditedAt: { type: 'string', required: true, default: () => new Date().toISOString() },
        createdAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
        updatedAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
      },
      indexes: {
        primary: {
          pk: { facets: ['auditId'] },
          sk: { facets: [] },
        },
        bySiteId: {
          index: 'bySiteId',
          pk: { facets: ['siteId'] },
          sk: { facets: ['auditType', 'auditedAt'] },
        },
      },
      references: [],
      options: { allowUpdates: false, allowRemove: false },
    },
  );
}

function createMockLog() {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
  };
}

describe('PostgresAuditCollection', () => {
  let collection;
  let client;
  let schema;
  let registry;
  let log;

  beforeEach(() => {
    log = createMockLog();
    schema = createAuditSchema();
    client = createMockPostgrestClient();
    registry = {
      getCollection: sinon.stub(),
      log: createMockLog(),
    };
    collection = new PostgresAuditCollection(client, registry, schema, log);
    registry.getCollection.withArgs('AuditCollection').returns(collection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('_onCreate', () => {
    it('is a no-op and does not throw', async () => {
      const result = await collection._onCreate({ some: 'item' });
      expect(result).to.be.undefined;
    });
  });

  describe('_onCreateMany', () => {
    it('is a no-op and does not throw', async () => {
      const result = await collection._onCreateMany({ createdItems: [], errorItems: [] });
      expect(result).to.be.undefined;
    });
  });

  describe('COLLECTION_NAME', () => {
    it('has the correct collection name', () => {
      expect(PostgresAuditCollection.COLLECTION_NAME).to.equal('AuditCollection');
    });
  });

  describe('model statics', () => {
    it('has AUDIT_TYPES', () => {
      expect(PostgresAuditModel.AUDIT_TYPES).to.be.an('object');
      expect(PostgresAuditModel.AUDIT_TYPES.CWV).to.equal('cwv');
      expect(PostgresAuditModel.AUDIT_TYPES.LHS_MOBILE).to.equal('lhs-mobile');
    });

    it('has AUDIT_TYPE_PROPERTIES', () => {
      expect(PostgresAuditModel.AUDIT_TYPE_PROPERTIES).to.be.an('object');
      const lhsDesktopProps = PostgresAuditModel.AUDIT_TYPE_PROPERTIES['lhs-desktop'];
      expect(lhsDesktopProps).to.include('performance');
      expect(lhsDesktopProps).to.include('seo');
    });

    it('has AUDIT_STEP_DESTINATIONS', () => {
      expect(PostgresAuditModel.AUDIT_STEP_DESTINATIONS).to.be.an('object');
      expect(PostgresAuditModel.AUDIT_STEP_DESTINATIONS.CONTENT_SCRAPER).to.equal('content-scraper');
      expect(PostgresAuditModel.AUDIT_STEP_DESTINATIONS.IMPORT_WORKER).to.equal('import-worker');
    });

    it('has AUDIT_STEP_DESTINATION_CONFIGS', () => {
      const configs = PostgresAuditModel.AUDIT_STEP_DESTINATION_CONFIGS;
      expect(configs).to.be.an('object');
      expect(configs['import-worker']).to.have.property('getQueueUrl');
      expect(configs['import-worker']).to.have.property('formatPayload');
      expect(configs['content-scraper']).to.have.property('getQueueUrl');
      expect(configs['content-scraper']).to.have.property('formatPayload');
      expect(configs['scrape-client']).to.have.property('formatPayload');
    });

    it('validateAuditResult throws for non-object/array', () => {
      expect(() => PostgresAuditModel.validateAuditResult('string', 'cwv'))
        .to.throw('Audit result must be an object or array');
    });

    it('validateAuditResult returns true for runtime errors', () => {
      const result = PostgresAuditModel.validateAuditResult(
        { runtimeError: { message: 'fail' } },
        'cwv',
      );
      expect(result).to.be.true;
    });

    it('validateAuditResult throws for LHS types missing scores', () => {
      expect(() => PostgresAuditModel.validateAuditResult({}, 'lhs-desktop'))
        .to.throw("Missing scores property for audit type 'lhs-desktop'");
    });

    it('validateAuditResult throws for LHS types missing expected property', () => {
      expect(() => PostgresAuditModel.validateAuditResult(
        { scores: { performance: 1 } },
        'lhs-desktop',
      )).to.throw("Missing expected property 'seo' for audit type 'lhs-desktop'");
    });

    it('validateAuditResult passes for valid LHS result', () => {
      const result = PostgresAuditModel.validateAuditResult(
        {
          scores: {
            performance: 1, seo: 1, accessibility: 1, 'best-practices': 1,
          },
        },
        'lhs-desktop',
      );
      expect(result).to.be.true;
    });
  });
});
