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
/* eslint-disable max-classes-per-file */

import { expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresEntityRegistry from '../../../../src/service/postgres/postgres-entity-registry.js';
import PostgresBaseCollection from '../../../../src/models/postgres/base/postgres-base.collection.js';
import PostgresBaseModel from '../../../../src/models/postgres/base/postgres-base.model.js';
import Schema from '../../../../src/models/base/schema.js';

chaiUse(chaiAsPromised);

// Test entity classes
class MockModel extends PostgresBaseModel {
  static ENTITY_NAME = 'MockEntity';
}

class MockCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'MockEntityCollection';
}

function createMockLog() {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
  };
}

function createMockPostgrestClient() {
  return {
    from: sinon.stub().returns({
      select: sinon.stub().returnsThis(),
      eq: sinon.stub().returnsThis(),
      order: sinon.stub().returnsThis(),
      range: sinon.stub().returnsThis(),
      insert: sinon.stub().returnsThis(),
      update: sinon.stub().returnsThis(),
      delete: sinon.stub().returnsThis(),
      in: sinon.stub().returnsThis(),
      maybeSingle: sinon.stub().returns({
        then: (resolve) => resolve({ data: {}, error: null }),
      }),
      then: (resolve) => resolve({ data: [], error: null }),
    }),
  };
}

describe('PostgresEntityRegistry', () => {
  let client;
  let log;
  let mockSchema;

  beforeEach(() => {
    client = createMockPostgrestClient();
    log = createMockLog();

    mockSchema = new Schema(
      MockModel,
      MockCollection,
      {
        serviceName: 'TestService',
        schemaVersion: 1,
        attributes: {
          mockEntityId: { type: 'string', required: true },
          name: { type: 'string', required: true },
        },
        indexes: {
          primary: {
            pk: { facets: ['mockEntityId'] },
            sk: { facets: [] },
          },
        },
        references: [],
        options: {
          allowUpdates: true,
          allowRemove: true,
        },
      },
    );

    // Clear any previously registered entities
    PostgresEntityRegistry.entities = {};
  });

  afterEach(() => {
    sinon.restore();
    PostgresEntityRegistry.entities = {};
  });

  describe('registerEntity', () => {
    it('registers an entity with schema and collection class', () => {
      PostgresEntityRegistry.registerEntity(mockSchema, MockCollection);

      expect(PostgresEntityRegistry.entities.mockEntity).to.exist;
      expect(PostgresEntityRegistry.entities.mockEntity.schema).to.equal(mockSchema);
      expect(PostgresEntityRegistry.entities.mockEntity.collection).to.equal(MockCollection);
    });
  });

  describe('constructor', () => {
    it('initializes registered collections', () => {
      PostgresEntityRegistry.registerEntity(mockSchema, MockCollection);

      const registry = new PostgresEntityRegistry(client, {}, log);

      expect(registry.collections.size).to.equal(1);
    });

    it('initializes without S3 when not configured', () => {
      const registry = new PostgresEntityRegistry(client, {}, log);

      // Should not have configuration collection
      expect(registry.collections.has('ConfigurationCollection')).to.be.false;
    });

    it('initializes Configuration collection when S3 is configured', () => {
      const mockS3 = { s3Client: {}, s3Bucket: 'test-bucket' };
      const registry = new PostgresEntityRegistry(client, { s3: mockS3 }, log);

      expect(registry.collections.has('ConfigurationCollection')).to.be.true;
    });
  });

  describe('getCollection', () => {
    it('returns the correct collection', () => {
      PostgresEntityRegistry.registerEntity(mockSchema, MockCollection);

      const registry = new PostgresEntityRegistry(client, {}, log);
      const collection = registry.getCollection('MockEntityCollection');

      expect(collection).to.be.instanceOf(MockCollection);
    });

    it('throws for unknown collection', () => {
      const registry = new PostgresEntityRegistry(client, {}, log);

      expect(() => registry.getCollection('nonExistent'))
        .to.throw('Collection nonExistent not found');
    });
  });

  describe('getCollections', () => {
    it('returns all collections keyed by entity name', () => {
      PostgresEntityRegistry.registerEntity(mockSchema, MockCollection);

      const registry = new PostgresEntityRegistry(client, {}, log);
      const collections = registry.getCollections();

      expect(collections).to.be.an('object');
      expect(collections.MockEntity).to.be.instanceOf(MockCollection);
    });

    it('returns empty object when no entities registered', () => {
      const registry = new PostgresEntityRegistry(client, {}, log);
      const collections = registry.getCollections();

      expect(collections).to.be.an('object');
      expect(Object.keys(collections)).to.have.length(0);
    });
  });
});
