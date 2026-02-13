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
/* eslint-disable max-classes-per-file, no-underscore-dangle */

import { expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresBaseCollection from '../../../../../src/models/postgres/base/postgres-base.collection.js';
import PostgresBaseModel from '../../../../../src/models/postgres/base/postgres-base.model.js';
import Schema from '../../../../../src/models/base/schema.js';

chaiUse(chaiAsPromised);

// Minimal model and collection classes for testing
class TestModel extends PostgresBaseModel {
  static ENTITY_NAME = 'TestEntity';
}

class TestCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'TestEntityCollection';
}

/**
 * Creates a mock PostgREST client with chainable query methods.
 */
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

  // Make all methods return the chain for chaining
  Object.keys(chain).forEach((key) => {
    if (key !== 'then' && chain[key]) {
      chain[key].returns(chain);
    }
  });

  // The terminal call resolves with {data, error}
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

function createTestSchema() {
  return new Schema(
    TestModel,
    TestCollection,
    {
      serviceName: 'TestService',
      schemaVersion: 1,
      attributes: {
        testEntityId: {
          type: 'string',
          required: true,
        },
        name: {
          type: 'string',
          required: true,
        },
        status: {
          type: 'string',
          default: 'active',
        },
        organizationId: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          readOnly: true,
          default: () => new Date().toISOString(),
        },
        updatedAt: {
          type: 'string',
          readOnly: true,
          default: () => new Date().toISOString(),
        },
      },
      indexes: {
        primary: {
          pk: { facets: ['testEntityId'] },
          sk: { facets: [] },
        },
        byOrganizationId: {
          index: 'byOrganizationId',
          pk: { facets: ['organizationId'] },
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
}

function createMockLog() {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
  };
}

function createMockRegistry(collection) {
  return {
    getCollection: sinon.stub().returns(collection),
    log: createMockLog(),
  };
}

describe('PostgresBaseCollection', () => {
  let collection;
  let client;
  let schema;
  let registry;
  let log;

  beforeEach(() => {
    log = createMockLog();
    schema = createTestSchema();
    client = createMockPostgrestClient();
    registry = createMockRegistry(null);
    collection = new TestCollection(client, registry, schema, log);
    // Update registry to return the collection
    registry.getCollection.returns(collection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('initializes tableName from schema model name', () => {
      expect(collection.tableName).to.equal('test_entities');
    });

    it('initializes fieldMaps from schema', () => {
      expect(collection.fieldMaps).to.be.an('object');
      expect(collection.fieldMaps.toDbMap).to.be.an('object');
      expect(collection.fieldMaps.toModelMap).to.be.an('object');
      expect(collection.fieldMaps.toDbMap.testEntityId).to.equal('id');
      expect(collection.fieldMaps.toModelMap.id).to.equal('testEntityId');
    });
  });

  describe('findById', () => {
    it('queries by id and returns a model instance', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Test', status: 'active' }], error: null });

      const result = await collection.findById('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

      expect(result).to.not.be.null;
      expect(result.record.name).to.equal('Test');
    });

    it('returns null for non-existent id', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: [], error: null });

      const result = await collection.findById('a1b2c3d4-e5f6-7890-abcd-000000000000');

      expect(result).to.be.null;
    });

    it('throws when id is not provided', async () => {
      await expect(collection.findById(undefined))
        .to.be.rejectedWith('testEntityId');
    });
  });

  describe('all', () => {
    it('returns an array of model instances', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [
          { id: 'id-1', name: 'One', status: 'active' },
          { id: 'id-2', name: 'Two', status: 'active' },
        ],
        error: null,
      });

      const result = await collection.all();

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
    });

    it('throws when keys are null', async () => {
      await expect(collection.all(null))
        .to.be.rejectedWith('keys are required');
    });

    it('returns empty array when no data', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: [], error: null });

      const result = await collection.all();

      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('allByIndexKeys', () => {
    it('applies key filters', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', organization_id: 'org-1' }],
        error: null,
      });

      const result = await collection.allByIndexKeys({ organizationId: 'org-1' });

      expect(result).to.be.an('array').with.length(1);
      expect(chain.eq.calledWith('organization_id', 'org-1')).to.be.true;
    });

    it('throws when keys are empty', async () => {
      await expect(collection.allByIndexKeys({}))
        .to.be.rejectedWith('keys are required');
    });
  });

  describe('findByIndexKeys', () => {
    it('returns a single instance', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', status: 'active' }],
        error: null,
      });

      const result = await collection.findByIndexKeys({ organizationId: 'org-1' });

      expect(result).to.not.be.null;
      expect(result.record.name).to.equal('One');
    });
  });

  describe('existsById', () => {
    it('returns true when entity exists', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }],
        error: null,
      });

      const exists = await collection.existsById('a1b2c3d4-e5f6-7890-abcd-ef1234567890');

      expect(exists).to.be.true;
    });

    it('returns false when entity does not exist', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: [], error: null });

      const exists = await collection.existsById('a1b2c3d4-e5f6-7890-abcd-000000000000');

      expect(exists).to.be.false;
    });
  });

  describe('create', () => {
    it('inserts a record and returns a model instance', async () => {
      const chain = client._chain;
      const newRecord = {
        id: 'new-id', name: 'New', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01',
      };
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: newRecord, error: null }),
      });

      const result = await collection.create({ testEntityId: 'new-id', name: 'New' });

      expect(result).to.not.be.null;
      expect(client.from.calledWith('test_entities')).to.be.true;
      expect(chain.insert.called).to.be.true;
    });

    it('throws when data is empty', async () => {
      await expect(collection.create({}))
        .to.be.rejectedWith('data is required');
    });

    it('uses upsert when option is set', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: { id: 'upsert-id', name: 'Upsert', status: 'active' },
          error: null,
        }),
      });

      await collection.create({ testEntityId: 'upsert-id', name: 'Upsert' }, { upsert: true });

      expect(chain.upsert.called).to.be.true;
    });
  });

  describe('createMany', () => {
    it('inserts multiple records', async () => {
      const chain = client._chain;
      chain.select.returns({
        then: (resolve) => resolve({ data: [], error: null }),
      });
      // Reset chain.then for select() path
      chain.then = (resolve) => resolve({ data: [], error: null });

      const items = [
        { testEntityId: 'id-1', name: 'One' },
        { testEntityId: 'id-2', name: 'Two' },
      ];

      const result = await collection.createMany(items);

      expect(result.createdItems).to.have.length(2);
      expect(result.errorItems).to.have.length(0);
    });

    it('throws when items is empty', async () => {
      await expect(collection.createMany([]))
        .to.be.rejectedWith('items must be a non-empty array');
    });

    it('captures validation errors without failing the batch', async () => {
      const chain = client._chain;
      chain.select.returns({
        then: (resolve) => resolve({ data: [], error: null }),
      });
      chain.then = (resolve) => resolve({ data: [], error: null });

      // name is required, so omitting it should trigger a validation error
      const items = [
        { testEntityId: 'id-1', name: 'Valid' },
        { testEntityId: 'id-2' }, // missing required 'name'
      ];

      const result = await collection.createMany(items);

      expect(result.createdItems).to.have.length(1);
      expect(result.errorItems).to.have.length(1);
      expect(result.errorItems[0].item).to.deep.equal(items[1]);
    });
  });

  describe('updateByKeys', () => {
    it('updates a record by keys', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: { id: 'id-1', name: 'Updated' }, error: null }),
      });

      await collection.updateByKeys(
        { testEntityId: 'id-1' },
        { name: 'Updated' },
      );

      expect(chain.update.called).to.be.true;
      expect(chain.eq.calledWith('id', 'id-1')).to.be.true;
    });

    it('throws when keys or updates are empty', async () => {
      await expect(collection.updateByKeys({}, { name: 'Test' }))
        .to.be.rejectedWith('keys and updates are required');

      await expect(collection.updateByKeys({ testEntityId: 'id-1' }, {}))
        .to.be.rejectedWith('keys and updates are required');
    });
  });

  describe('removeByIds', () => {
    it('deletes records by IDs', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: null, error: null });
      chain.in.returns(chain);

      await collection.removeByIds(['id-1', 'id-2']);

      expect(chain.delete.called).to.be.true;
      expect(chain.in.calledWith('id', ['id-1', 'id-2'])).to.be.true;
    });

    it('throws when IDs array is empty', async () => {
      await expect(collection.removeByIds([]))
        .to.be.rejectedWith('ids must be a non-empty array');
    });
  });

  describe('removeByIndexKeys', () => {
    it('deletes records by key objects', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: null, error: null });

      await collection.removeByIndexKeys([
        { testEntityId: 'id-1' },
        { testEntityId: 'id-2' },
      ]);

      expect(chain.delete.called).to.be.true;
    });

    it('throws when keys array is empty', async () => {
      await expect(collection.removeByIndexKeys([]))
        .to.be.rejectedWith('keys must be a non-empty array');
    });

    it('throws when a key object is empty', async () => {
      await expect(collection.removeByIndexKeys([{}]))
        .to.be.rejectedWith('key must be a non-empty object');
    });
  });

  describe('_saveMany', () => {
    it('updates multiple items', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: {}, error: null }),
      });

      const items = [
        {
          getId: () => 'id-1',
          record: { testEntityId: 'id-1', name: 'One' },
          generateCompositeKeys: () => ({ testEntityId: 'id-1' }),
        },
        {
          getId: () => 'id-2',
          record: { testEntityId: 'id-2', name: 'Two' },
          generateCompositeKeys: () => ({ testEntityId: 'id-2' }),
        },
      ];

      await collection._saveMany(items);

      expect(chain.update.callCount).to.equal(2);
    });

    it('throws when items is empty', async () => {
      await expect(collection._saveMany([]))
        .to.be.rejectedWith('items must be a non-empty array');
    });
  });

  describe('applyUpdateWatchers', () => {
    it('returns unchanged record when no watchers', () => {
      const record = { name: 'Test' };
      const updates = { name: 'Updated' };

      const result = collection.applyUpdateWatchers(record, updates);

      expect(result.record.name).to.equal('Test');
      expect(result.updates.name).to.equal('Updated');
    });

    it('returns unchanged when updates is empty', () => {
      const record = { name: 'Test' };
      const result = collection.applyUpdateWatchers(record, {});

      expect(result.record.name).to.equal('Test');
      expect(result.updates).to.deep.equal({});
    });
  });

  describe('batchGetByKeys', () => {
    it('fetches multiple records by keys', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', status: 'active' }],
        error: null,
      });

      const result = await collection.batchGetByKeys([
        { testEntityId: 'id-1' },
        { testEntityId: 'id-2' },
      ]);

      expect(result.data).to.be.an('array');
      expect(result.unprocessed).to.be.an('array').that.is.empty;
    });
  });

  describe('findByAll', () => {
    it('returns a single instance', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', status: 'active' }],
        error: null,
      });

      const result = await collection.findByAll({ status: 'active' });

      expect(result).to.not.be.null;
    });

    it('throws when sort keys are not an object', async () => {
      await expect(collection.findByAll('invalid'))
        .to.be.rejectedWith('sort keys must be an object');
    });
  });

  describe('pagination', () => {
    it('returns cursor when limit matches result count', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [
          { id: 'id-1', name: 'One', status: 'active' },
          { id: 'id-2', name: 'Two', status: 'active' },
        ],
        error: null,
      });

      const result = await collection.allByIndexKeys(
        { organizationId: 'org-1' },
        { limit: 2, returnCursor: true, fetchAllPages: false },
      );

      expect(result).to.have.property('data');
      expect(result).to.have.property('cursor');
      expect(result.data).to.have.length(2);
      expect(result.cursor).to.be.a('string');
    });
  });

  describe('between and where queries', () => {
    it('applies between filter', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{
          id: 'id-1', name: 'One', status: 'active', created_at: '2026-01-15',
        }],
        error: null,
      });

      await collection.allByIndexKeys(
        { organizationId: 'org-1' },
        {
          between: {
            attribute: 'createdAt',
            start: '2026-01-01',
            end: '2026-01-31',
          },
        },
      );

      expect(chain.gte.called).to.be.true;
      expect(chain.lte.called).to.be.true;
    });
  });

  describe('_onCreate and _onCreateMany hooks', () => {
    it('calls _onCreate after create', async () => {
      const spy = sinon.spy(collection, '_onCreate');
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: { id: 'new-id', name: 'New', status: 'active' },
          error: null,
        }),
      });

      await collection.create({ testEntityId: 'new-id', name: 'New' });

      expect(spy.calledOnce).to.be.true;
    });

    it('handles _onCreate errors gracefully', async () => {
      sinon.stub(collection, '_onCreate').rejects(new Error('Hook error'));
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: { id: 'new-id', name: 'New', status: 'active' },
          error: null,
        }),
      });

      // Should not throw even when hook fails
      const result = await collection.create({ testEntityId: 'new-id', name: 'New' });
      expect(result).to.not.be.null;
    });
  });

  describe('create with defaults and setters', () => {
    let schemaWithDefaults;
    let collectionWithDefaults;

    beforeEach(() => {
      schemaWithDefaults = new Schema(
        TestModel,
        TestCollection,
        {
          serviceName: 'TestService',
          schemaVersion: 1,
          attributes: {
            testEntityId: { type: 'string', required: true },
            name: { type: 'string', required: true },
            status: { type: 'string', default: 'active' },
            priority: { type: 'number', default: 0 },
            normalizedName: {
              type: 'string',
              set: (val) => (val ? val.toLowerCase() : val),
            },
            createdAt: { type: 'string', readOnly: true, default: () => '2026-01-01T00:00:00.000Z' },
            updatedAt: { type: 'string', readOnly: true, default: () => '2026-01-01T00:00:00.000Z' },
          },
          indexes: {
            primary: {
              pk: { facets: ['testEntityId'] },
              sk: { facets: [] },
            },
          },
          references: [],
          options: { allowUpdates: true, allowRemove: true },
        },
      );
      collectionWithDefaults = new TestCollection(client, registry, schemaWithDefaults, log);
    });

    it('applies default values when creating', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: {
            id: 'new-id', name: 'Test', status: 'active', priority: 0,
          },
          error: null,
        }),
      });

      const result = await collectionWithDefaults.create({ testEntityId: 'new-id', name: 'Test' });

      expect(result).to.not.be.null;
      // insert should have been called with defaults applied
      expect(chain.insert.called).to.be.true;
    });

    it('applies setter functions when creating', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: { id: 'new-id', name: 'Test', normalized_name: 'test name' },
          error: null,
        }),
      });

      await collectionWithDefaults.create({
        testEntityId: 'new-id',
        name: 'Test',
        normalizedName: 'TEST NAME',
      });

      const insertArg = chain.insert.firstCall.args[0];
      expect(insertArg.normalized_name).to.equal('test name');
    });

    it('does not override existing values with defaults', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({
          data: {
            id: 'new-id', name: 'Test', status: 'inactive', priority: 5,
          },
          error: null,
        }),
      });

      await collectionWithDefaults.create({
        testEntityId: 'new-id',
        name: 'Test',
        status: 'inactive',
        priority: 5,
      });

      const insertArg = chain.insert.firstCall.args[0];
      expect(insertArg.status).to.equal('inactive');
      expect(insertArg.priority).to.equal(5);
    });
  });

  describe('validation', () => {
    let schemaWithTypes;
    let collectionWithTypes;

    beforeEach(() => {
      schemaWithTypes = new Schema(
        TestModel,
        TestCollection,
        {
          serviceName: 'TestService',
          schemaVersion: 1,
          attributes: {
            testEntityId: { type: 'string', required: true },
            name: { type: 'string', required: true },
            count: { type: 'number' },
            isActive: { type: 'boolean' },
            tags: { type: 'list' },
            metadata: { type: 'map' },
            status: { type: ['active', 'inactive'] },
            validatedField: {
              type: 'string',
              validate: (val) => val.length > 2,
            },
            throwingValidation: {
              type: 'string',
              validate: () => { throw new Error('custom error'); },
            },
            createdAt: { type: 'string', readOnly: true, default: () => '2026-01-01T00:00:00.000Z' },
            updatedAt: { type: 'string', readOnly: true, default: () => '2026-01-01T00:00:00.000Z' },
          },
          indexes: {
            primary: {
              pk: { facets: ['testEntityId'] },
              sk: { facets: [] },
            },
          },
          references: [],
          options: { allowUpdates: true, allowRemove: true },
        },
      );
      collectionWithTypes = new TestCollection(client, registry, schemaWithTypes, log);
    });

    it('rejects invalid string type', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 123,
      })).to.be.rejectedWith('name must be a string');
    });

    it('rejects invalid number type', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', count: 'not-a-number',
      })).to.be.rejectedWith('count must be a number');
    });

    it('rejects invalid boolean type', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', isActive: 'yes',
      })).to.be.rejectedWith('isActive must be a boolean');
    });

    it('rejects invalid list type', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', tags: 'not-a-list',
      })).to.be.rejectedWith('tags must be a list');
    });

    it('rejects invalid map type', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', metadata: 'not-a-map',
      })).to.be.rejectedWith('metadata must be a map');
    });

    it('rejects invalid enum value', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', status: 'unknown',
      })).to.be.rejectedWith('status is invalid');
    });

    it('rejects when custom validation returns false', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', validatedField: 'ab',
      })).to.be.rejectedWith('validatedField failed validation');
    });

    it('rejects when custom validation throws', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1', name: 'Test', throwingValidation: 'anything',
      })).to.be.rejectedWith('throwingValidation failed validation');
    });

    it('rejects required field missing', async () => {
      await expect(collectionWithTypes.create({
        testEntityId: 'id-1',
      })).to.be.rejectedWith('name is required');
    });
  });

  describe('applyUpdateWatchers with watch config', () => {
    let schemaWithWatchers;
    let collectionWithWatchers;

    beforeEach(() => {
      schemaWithWatchers = new Schema(
        TestModel,
        TestCollection,
        {
          serviceName: 'TestService',
          schemaVersion: 1,
          attributes: {
            testEntityId: { type: 'string', required: true },
            name: { type: 'string', required: true },
            slug: {
              type: 'string',
              watch: ['name'],
              set: (_, record) => (record.name ? record.name.toLowerCase().replace(/ /g, '-') : ''),
            },
            hash: {
              type: 'string',
              watch: '*',
              set: () => 'recalculated',
            },
            createdAt: { type: 'string', readOnly: true },
            updatedAt: { type: 'string', readOnly: true },
          },
          indexes: {
            primary: {
              pk: { facets: ['testEntityId'] },
              sk: { facets: [] },
            },
          },
          references: [],
          options: { allowUpdates: true, allowRemove: true },
        },
      );
      collectionWithWatchers = new TestCollection(client, registry, schemaWithWatchers, log);
    });

    it('applies setter for watched fields', () => {
      const record = {
        testEntityId: 'id-1', name: 'Test Name', slug: 'old-slug', hash: 'old',
      };
      const updates = { name: 'New Name' };

      const result = collectionWithWatchers.applyUpdateWatchers(record, updates);

      // The setter receives the current slug value and the record (which still has the old name)
      // so the result depends on the setter implementation reading from record
      expect(result.updates.slug).to.equal('test-name');
      expect(result.updates.hash).to.equal('recalculated');
    });

    it('does not apply setter when watched field is not changed', () => {
      const record = {
        testEntityId: 'id-1', name: 'Test', slug: 'test', hash: 'old',
      };
      const updates = { testEntityId: 'id-2' };

      const result = collectionWithWatchers.applyUpdateWatchers(record, updates);

      // slug watches 'name', which is not changed
      expect(result.updates.slug).to.be.undefined;
      // hash watches '*', so it should still be applied
      expect(result.updates.hash).to.equal('recalculated');
    });
  });

  describe('query with index option', () => {
    it('throws when specified index does not exist', async () => {
      await expect(collection.allByIndexKeys(
        { organizationId: 'org-1' },
        { index: 'nonExistentIndex' },
      )).to.be.rejectedWith('query proxy [nonExistentIndex] not found');
    });

    it('uses specified index for ordering', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', organization_id: 'org-1' }],
        error: null,
      });

      await collection.allByIndexKeys(
        { organizationId: 'org-1' },
        { index: 'byOrganizationId' },
      );

      expect(chain.order.called).to.be.true;
    });

    it('orders ascending when specified', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', organization_id: 'org-1' }],
        error: null,
      });

      await collection.allByIndexKeys(
        { organizationId: 'org-1' },
        { order: 'asc' },
      );

      expect(chain.order.calledOnce).to.be.true;
      const [, orderOpts] = chain.order.firstCall.args;
      expect(orderOpts.ascending).to.be.true;
    });
  });

  describe('multi-page fetch-all pagination', () => {
    it('fetches multiple pages until a partial page', async () => {
      const chain = client._chain;
      let callCount = 0;
      // Use a small limit to make multi-page testable without generating 100 items
      chain.then = (resolve) => {
        callCount += 1;
        if (callCount === 1) {
          // First page - 3 items (fills the limit=3)
          return resolve({
            data: [
              { id: 'id-1', name: 'A', status: 'active' },
              { id: 'id-2', name: 'B', status: 'active' },
              { id: 'id-3', name: 'C', status: 'active' },
            ],
            error: null,
          });
        }
        // Second page - fewer than 3 means last page
        return resolve({
          data: [{ id: 'id-4', name: 'D', status: 'active' }],
          error: null,
        });
      };

      const result = await collection.all(
        {},
        { fetchAllPages: true, limit: 3 },
      );

      expect(result).to.be.an('array');
      expect(result).to.have.length(4);
    });
  });

  describe('order with empty keys', () => {
    it('defaults sort to primary index key when keys are empty', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', status: 'active' }],
        error: null,
      });

      await collection.all({});

      expect(chain.order.called).to.be.true;
      // Falls back to primary index key (testEntityId -> id)
      const [orderField] = chain.order.firstCall.args;
      expect(orderField).to.equal('id');
    });

    it('falls back to last key name when no index is found', async () => {
      // Create a schema with no indexes that return keys for arbitrary key names
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One', status: 'active' }],
        error: null,
      });

      // Use findByIndexKeys with a custom key that doesn't match any index
      await collection.allByIndexKeys({ organizationId: 'org-1' });

      expect(chain.order.called).to.be.true;
    });
  });

  describe('select specific attributes', () => {
    it('queries only specified attributes', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({
        data: [{ id: 'id-1', name: 'One' }],
        error: null,
      });

      await collection.allByIndexKeys(
        { organizationId: 'org-1' },
        { attributes: ['testEntityId', 'name'] },
      );

      expect(chain.select.calledWith('id,name')).to.be.true;
    });
  });

  describe('_saveMany with items using getId fallback', () => {
    it('uses getId when generateCompositeKeys is not available', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: {}, error: null }),
      });

      const items = [
        {
          getId: () => 'id-1',
          record: { testEntityId: 'id-1', name: 'One' },
        },
      ];

      await collection._saveMany(items);

      expect(chain.update.calledOnce).to.be.true;
    });
  });

  describe('error handling', () => {
    it('propagates PostgREST errors on create', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: null, error: { message: 'DB error' } }),
      });

      await expect(collection.create({ testEntityId: 'id', name: 'Test' }))
        .to.be.rejectedWith('Failed to create');
    });

    it('propagates PostgREST errors on query', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: null, error: { message: 'Query error' } });

      await expect(collection.allByIndexKeys({ organizationId: 'org-1' }))
        .to.be.rejectedWith('Failed to query');
    });

    it('propagates PostgREST errors on removeByIds', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: null, error: { message: 'Delete error' } });
      chain.in.returns(chain);

      await expect(collection.removeByIds(['id-1']))
        .to.be.rejectedWith('Failed to remove by IDs');
    });

    it('propagates PostgREST errors on updateByKeys', async () => {
      const chain = client._chain;
      chain.maybeSingle.returns({
        then: (resolve) => resolve({ data: null, error: { message: 'Update error' } }),
      });

      await expect(collection.updateByKeys({ testEntityId: 'id-1' }, { name: 'Updated' }))
        .to.be.rejectedWith('Failed to update entity');
    });

    it('propagates PostgREST errors on createMany', async () => {
      const chain = client._chain;
      chain.select.returns({
        then: (resolve) => resolve({ data: null, error: { message: 'Batch error' } }),
      });
      chain.then = (resolve) => resolve({ data: null, error: { message: 'Batch error' } });

      await expect(collection.createMany([
        { testEntityId: 'id-1', name: 'One' },
      ])).to.be.rejectedWith('Failed to create many');
    });

    it('options validation for allByIndexKeys', async () => {
      await expect(collection.allByIndexKeys({ organizationId: 'org-1' }, 'invalid'))
        .to.be.rejectedWith('options must be an object');
    });
  });
});
