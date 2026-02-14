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

import PostgresBaseModel from '../../../../../src/models/postgres/base/postgres-base.model.js';
import PostgresBaseCollection from '../../../../../src/models/postgres/base/postgres-base.collection.js';
import Schema from '../../../../../src/models/base/schema.js';
import DataAccessError from '../../../../../src/errors/data-access.error.js';

chaiUse(chaiAsPromised);

class TestModel extends PostgresBaseModel {
  static ENTITY_NAME = 'TestEntity';
}

class TestCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'TestEntityCollection';
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

describe('PostgresBaseModel', () => {
  let model;
  let schema;
  let client;
  let collection;
  let registry;
  let log;
  let record;

  beforeEach(() => {
    log = createMockLog();
    client = createMockPostgrestClient();

    schema = new Schema(
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
          createdAt: {
            type: 'string',
            readOnly: true,
          },
          updatedAt: {
            type: 'string',
            readOnly: true,
          },
        },
        indexes: {
          primary: {
            pk: { facets: ['testEntityId'] },
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

    collection = new TestCollection(client, null, schema, log);

    registry = {
      getCollection: sinon.stub().returns(collection),
      log,
    };

    // Re-create collection with proper registry
    collection = new TestCollection(client, registry, schema, log);
    registry.getCollection.returns(collection);

    record = {
      testEntityId: 'test-id-1',
      name: 'Test Entity',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    model = new TestModel(client, registry, schema, record, log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('initializes with correct properties', () => {
      expect(model.entityName).to.equal('testEntity');
      expect(model.idName).to.equal('testEntityId');
      expect(model.postgrestClient).to.equal(client);
    });

    it('uses PostgresPatcher instead of v2 Patcher', () => {
      expect(model.patcher).to.exist;
      expect(model.patcher.constructor.name).to.equal('PostgresPatcher');
    });
  });

  describe('getId', () => {
    it('returns the entity ID', () => {
      expect(model.getId()).to.equal('test-id-1');
    });
  });

  describe('getCreatedAt', () => {
    it('returns the creation timestamp', () => {
      expect(model.getCreatedAt()).to.equal('2026-01-01T00:00:00.000Z');
    });
  });

  describe('getUpdatedAt', () => {
    it('returns the update timestamp', () => {
      expect(model.getUpdatedAt()).to.equal('2026-01-01T00:00:00.000Z');
    });
  });

  describe('auto-generated getters', () => {
    it('generates getTestEntityId', () => {
      expect(model.getTestEntityId()).to.equal('test-id-1');
    });

    it('generates getName', () => {
      expect(model.getName()).to.equal('Test Entity');
    });

    it('generates getStatus', () => {
      expect(model.getStatus()).to.equal('active');
    });
  });

  describe('auto-generated setters', () => {
    it('generates setName', () => {
      const result = model.setName('New Name');

      expect(result).to.equal(model); // returns this for chaining
      expect(model.getName()).to.equal('New Name');
    });

    it('generates setStatus', () => {
      model.setStatus('inactive');

      expect(model.getStatus()).to.equal('inactive');
    });

    it('does not generate setters for read-only fields', () => {
      expect(model.setCreatedAt).to.not.exist;
      expect(model.setUpdatedAt).to.not.exist;
    });
  });

  describe('save', () => {
    it('delegates to patcher.save()', async () => {
      const saveSpy = sinon.stub(model.patcher, 'save').resolves();

      model.setName('Updated');
      await model.save();

      expect(saveSpy.calledOnce).to.be.true;
    });

    it('returns this for chaining', async () => {
      sinon.stub(model.patcher, 'save').resolves();

      model.setName('Updated');
      const result = await model.save();

      expect(result).to.equal(model);
    });
  });

  describe('remove', () => {
    it('throws when schema does not allow removal', async () => {
      const noRemoveSchema = new Schema(
        TestModel,
        TestCollection,
        {
          serviceName: 'TestService',
          schemaVersion: 1,
          attributes: {
            testEntityId: { type: 'string', required: true },
            name: { type: 'string', required: true },
          },
          indexes: {
            primary: {
              pk: { facets: ['testEntityId'] },
              sk: { facets: [] },
            },
          },
          references: [],
          options: {
            allowUpdates: false,
            allowRemove: false,
          },
        },
      );

      const noRemoveCollection = new TestCollection(client, registry, noRemoveSchema, log);
      registry.getCollection.returns(noRemoveCollection);
      const noRemoveModel = new TestModel(client, registry, noRemoveSchema, record, log);

      await expect(noRemoveModel.remove())
        .to.be.rejectedWith('does not allow removal');
    });

    it('removes the entity via collection.removeByIndexKeys', async () => {
      const removeByIndexKeysStub = sinon.stub(collection, 'removeByIndexKeys').resolves();

      await model.remove();

      expect(removeByIndexKeysStub.calledOnce).to.be.true;
      expect(removeByIndexKeysStub.firstCall.args[0]).to.deep.equal([
        { testEntityId: 'test-id-1' },
      ]);
    });

    it('invalidates accessor cache after removal', async () => {
      sinon.stub(collection, 'removeByIndexKeys').resolves();
      model._accessorCache = { cached: 'value' };

      await model.remove();

      expect(model._accessorCache).to.deep.equal({});
    });

    it('returns this after successful removal', async () => {
      sinon.stub(collection, 'removeByIndexKeys').resolves();

      const result = await model.remove();

      expect(result).to.equal(model);
    });

    it('throws DataAccessError when removal fails', async () => {
      sinon.stub(collection, 'removeByIndexKeys').rejects(new Error('DB error'));

      await expect(model.remove())
        .to.be.rejectedWith('Failed to remove entity');
    });
  });

  describe('_remove (internal)', () => {
    it('removes without checking allowsRemove', async () => {
      sinon.stub(collection, 'removeByIndexKeys').resolves();

      // eslint-disable-next-line no-underscore-dangle
      const result = await model._remove();

      expect(result).to.equal(model);
    });
  });

  describe('generateCompositeKeys', () => {
    it('returns the primary key', () => {
      expect(model.generateCompositeKeys()).to.deep.equal({
        testEntityId: 'test-id-1',
      });
    });
  });

  describe('toJSON', () => {
    it('returns a plain object with schema attributes', () => {
      const json = model.toJSON();

      expect(json).to.deep.equal({
        testEntityId: 'test-id-1',
        name: 'Test Entity',
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('excludes undefined attributes', () => {
      delete record.status;
      const modelNoStatus = new TestModel(client, registry, schema, record, log);
      const json = modelNoStatus.toJSON();

      expect(json).to.not.have.property('status');
    });
  });

  describe('electroService Proxy traps', () => {
    it('throws DataAccessError when accessing an un-proxied ElectroDB entity property', () => {
      expect(() => model.entity.query)
        .to.throw(DataAccessError)
        .with.property('message')
        .that.includes('entity.query');
    });

    it('allows entity.model access (needed by Patcher constructor)', () => {
      expect(model.entity.model).to.be.an('object');
      expect(model.entity.model.schema.attributes).to.deep.equal({});
    });

    it('throws DataAccessError when accessing electroService properties other than entities', () => {
      expect(() => model.electroService.collections)
        .to.throw(DataAccessError)
        .with.property('message')
        .that.includes('electroService.collections');
    });
  });
});
