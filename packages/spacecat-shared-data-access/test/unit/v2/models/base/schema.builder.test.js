/*
 * Copyright 2024 Adobe. All rights reserved.
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

// eslint-disable-next-line max-classes-per-file
import { isIsoDate } from '@adobe/spacecat-shared-utils';
import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { validate as uuidValidate } from 'uuid';

import SchemaBuilder from '../../../../../src/v2/models/base/schema.builder.js';
import { BaseCollection, BaseModel } from '../../../../../src/index.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SchemaBuilder', () => {
  const MockModel = class MockModel extends BaseModel {};
  const MockCollection = class MockCollection extends BaseCollection {};

  let instance;

  beforeEach(() => {
    instance = new SchemaBuilder(MockModel, MockCollection);
  });

  describe('constructor', () => {
    it('throws error if invalid model class is provided', () => {
      expect(() => new SchemaBuilder())
        .to.throw('modelClass must be a subclass of BaseModel.');
      expect(() => new SchemaBuilder(Number))
        .to.throw('modelClass must be a subclass of BaseModel.');
    });

    it('throws error if invalid collection class is provided', () => {
      expect(() => new SchemaBuilder(MockModel))
        .to.throw('collectionClass must be a subclass of BaseCollection.');
      expect(() => new SchemaBuilder(MockModel, Number))
        .to.throw('collectionClass must be a subclass of BaseCollection.');
    });

    it('throws an error if version is not a positive integer', () => {
      expect(() => new SchemaBuilder(MockModel, MockCollection, -1))
        .to.throw('schemaVersion is required and must be a positive integer.');
      expect(() => new SchemaBuilder(MockModel, MockCollection, '-1'))
        .to.throw('schemaVersion is required and must be a positive integer.');
      expect(() => new SchemaBuilder(MockModel, MockCollection, 1.2))
        .to.throw('schemaVersion is required and must be a positive integer.');
    });

    it('successfully creates an instance', () => {
      expect(instance).to.be.an.instanceOf(SchemaBuilder);
      expect(instance.entityName).to.equal('MockModel');
      expect(instance.serviceName).to.equal('SpaceCat');
      expect(instance.schemaVersion).to.equal(1);
      expect(instance.indexes).to.deep.equal({});
      expect(instance.references).to.deep.equal({ belongs_to: [], has_many: [], has_one: [] });
      expect(instance.attributes).to.deep.equal({
        mockModelId: {
          default: instance.attributes.mockModelId.default,
          type: 'string',
          required: true,
          readOnly: true,
          validate: instance.attributes.mockModelId.validate,
        },
        createdAt: {
          default: instance.attributes.createdAt.default,
          type: 'string',
          readOnly: true,
          required: true,
        },
        updatedAt: {
          default: instance.attributes.updatedAt.default,
          type: 'string',
          required: true,
          readOnly: true,
          watch: '*',
          set: instance.attributes.updatedAt.set,
        },
      });

      expect(instance.rawIndexes).to.deep.equal({
        primary: {
          pk: { composite: ['mockModelId'], field: 'pk' },
          sk: { composite: [], field: 'sk' },
        },
        all: null,
        belongs_to: {},
        other: {},
      });
    });
  });

  describe('addAttribute', () => {
    it('throws error if attribute name is not provided', () => {
      expect(() => instance.addAttribute())
        .to.throw('Attribute name is required and must be non-empty.');
    });

    it('throws error if attribute definition is not provided', () => {
      expect(() => instance.addAttribute('test'))
        .to.throw('Attribute data for "test" is required and must be a non-empty object.');
      expect(() => instance.addAttribute('test', 'test'))
        .to.throw('Attribute data for "test" is required and must be a non-empty object.');
      expect(() => instance.addAttribute('test', {}))
        .to.throw('Attribute data for "test" is required and must be a non-empty object.');
    });

    it('successfully adds an attribute', () => {
      const result = instance.addAttribute('test', {
        type: 'string',
        required: true,
        default: 'test',
        validate: () => true,
      });

      expect(result).to.equal(instance);
      expect(instance.attributes.test).to.deep.equal({
        type: 'string',
        required: true,
        default: 'test',
        validate: instance.attributes.test.validate,
      });
    });
  });

  describe('addAllIndexWithComposite', () => {
    it('throws error if attribute name is not provided', () => {
      expect(() => instance.addAllIndexWithComposite())
        .to.throw('At least one composite attribute name is required.');
    });

    it('successfully adds an all index', () => {
      const result = instance.addAllIndexWithComposite('test');

      expect(result).to.equal(instance);
      expect(instance.rawIndexes.all).to.deep.equal({
        index: 'spacecat-data-MockModel-all',
        pk: { field: 'gsi1pk', template: 'ALL_MOCKMODELS' },
        sk: { composite: ['test'], field: 'gsi1sk' },
      });
    });
  });

  describe('addAllIndexWithTemplateField', () => {
    it('throws error if field name is not provided', () => {
      expect(() => instance.addAllIndexWithTemplateField())
        .to.throw('fieldName is required and must be a non-empty string.');
    });

    it('throws error if template is not provided', () => {
      expect(() => instance.addAllIndexWithTemplateField('test'))
        .to.throw('template is required and must be a non-empty string.');
    });

    it('successfully adds an all index', () => { /* eslint-disable no-template-curly-in-string */
      const result = instance.addAllIndexWithTemplateField('test', '${test}');

      expect(result).to.equal(instance);
      expect(instance.rawIndexes.all).to.deep.equal({
        index: 'spacecat-data-MockModel-all',
        pk: { field: 'gsi1pk', template: 'ALL_MOCKMODELS' },
        sk: { field: 'test', template: '${test}' },
      });
    });
  });

  describe('addIndex', () => {
    it('throws error if index name is not provided', () => {
      expect(() => instance.addIndex())
        .to.throw('Index name is required and must be a non-empty string.');
    });

    it('throws error if index name is reserved', () => {
      expect(() => instance.addIndex('all'))
        .to.throw('Index name "all" is reserved.');
      expect(() => instance.addIndex('primary'))
        .to.throw('Index name "primary" is reserved.');
    });

    it('throws error if pk is not provided', () => {
      expect(() => instance.addIndex('test'))
        .to.throw('Partition key configuration (pk) is required and must be a non-empty object.');
      expect(() => instance.addIndex('test', 'pk'))
        .to.throw('Partition key configuration (pk) is required and must be a non-empty object.');
      expect(() => instance.addIndex('test', {}))
        .to.throw('Partition key configuration (pk) is required and must be a non-empty object.');
    });

    it('throws error if sk is not provided', () => {
      expect(() => instance.addIndex('test', { composite: ['test'] }))
        .to.throw('Sort key configuration (sk) is required and must be a non-empty object.');
      expect(() => instance.addIndex('test', { composite: ['test'] }, 'sk'))
        .to.throw('Sort key configuration (sk) is required and must be a non-empty object.');
      expect(() => instance.addIndex('test', { composite: ['test'] }, {}))
        .to.throw('Sort key configuration (sk) is required and must be a non-empty object.');
    });

    it('successfully adds an index', () => {
      const result = instance.addIndex('test', { composite: ['test'] }, { composite: ['test'] });

      expect(result).to.equal(instance);
      expect(instance.rawIndexes.other.test).to.deep.equal({
        index: 'spacecat-data-MockModel-test',
        pk: { composite: ['test'] },
        sk: { composite: ['test'] },
      });
    });
  });

  describe('addReference', () => {
    it('throws error if reference type is not provided', () => {
      expect(() => instance.addReference())
        .to.throw('Invalid referenceType: "undefined"');
    });

    it('throws error if reference type is invalid', () => {
      expect(() => instance.addReference('test'))
        .to.throw('Invalid referenceType: "test"');
    });

    it('throws error if entity name is not provided', () => {
      expect(() => instance.addReference('belongs_to'))
        .to.throw('entityName for reference is required and must be a non-empty string.');
    });

    it('successfully adds a has_many reference', () => {
      const result = instance.addReference('has_many', 'someEntity');

      expect(result).to.equal(instance);
      expect(instance.references.has_many)
        .to.deep.equal([{ target: 'someEntity', removeDependent: false }]);
      expect(instance.attributes).to.not.have.property('someEntityId');
      expect(instance.rawIndexes.belongs_to).to.not.have.property('bySomeEntityId');
    });

    it('successfully adds a has_many reference with removeDependent', () => {
      const result = instance.addReference('has_many', 'someEntity', [], { removeDependent: true });

      expect(result).to.equal(instance);
      expect(instance.references.has_many)
        .to.deep.equal([{ target: 'someEntity', removeDependent: true }]);
      expect(instance.attributes).to.not.have.property('someEntityId');
      expect(instance.rawIndexes.belongs_to).to.not.have.property('bySomeEntityId');
    });

    it('successfully adds a belongs_to reference', () => {
      const result = instance.addReference('belongs_to', 'someEntity');

      expect(result).to.equal(instance);
      expect(instance.references.belongs_to)
        .to.deep.equal([{ target: 'someEntity', required: true }]);
      expect(instance.attributes.someEntityId).to.deep.equal({
        required: true,
        type: 'string',
        validate: instance.attributes.someEntityId.validate,
      });
      expect(instance.rawIndexes.belongs_to.bySomeEntityId).to.deep.equal({
        index: 'spacecat-data-MockModel-bySomeEntityId',
        pk: { composite: ['someEntityId'] },
        sk: { composite: ['updatedAt'] },
      });
    });

    it('successfully adds a belongs_to reference which is not required', () => {
      const result = instance.addReference('belongs_to', 'someEntity', ['updatedAt'], { required: false });

      expect(result).to.equal(instance);
      expect(instance.references.belongs_to)
        .to.deep.equal([{ target: 'someEntity', required: false }]);
      expect(instance.attributes.someEntityId).to.deep.equal({
        required: false,
        type: 'string',
        validate: instance.attributes.someEntityId.validate,
      });
      expect(instance.rawIndexes.belongs_to.bySomeEntityId).to.deep.equal({
        index: 'spacecat-data-MockModel-bySomeEntityId',
        pk: { composite: ['someEntityId'] },
        sk: { composite: ['updatedAt'] },
      });
    });
  });

  describe('validate, default, and set', () => {
    it('sets defaults for createdAt and updatedAt', () => {
      expect(isIsoDate(instance.attributes.createdAt.default())).to.be.true;
      expect(isIsoDate(instance.attributes.updatedAt.default())).to.be.true;
      expect(isIsoDate(instance.attributes.updatedAt.set())).to.be.true;
    });

    it('sets default for id attribute', () => {
      expect(uuidValidate(instance.attributes.mockModelId.default())).to.be.true;
    });

    it('validates id attribute', () => {
      expect(instance.attributes.mockModelId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.attributes.mockModelId.validate('invalid')).to.be.false;
    });

    it('validates foreign key attribute', () => {
      instance.addReference('belongs_to', 'someEntity');
      expect(instance.attributes.someEntityId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.attributes.someEntityId.validate('invalid')).to.be.false;
    });

    it('validates non-required foreign key attribute', () => {
      instance.addReference('belongs_to', 'someEntity', [], { required: false });
      expect(instance.attributes.someEntityId.required).to.be.false;
      expect(instance.attributes.someEntityId.validate()).to.be.true;
      expect(instance.attributes.someEntityId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.attributes.someEntityId.validate('invalid')).to.be.false;
    });
  });

  describe('build', () => {
    it('returns the built schema', () => {
      instance.addReference('belongs_to', 'Organization');
      instance.addReference('belongs_to', 'Site', ['someField'], { required: false });
      instance.addReference('has_many', 'Audits');
      instance.addAttribute('baseURL', {
        type: 'string',
        required: true,
        validate: () => true,
      });
      instance.addAllIndexWithComposite('baseURL');
      instance.addAllIndexWithTemplateField('test', '${test}');
      instance.addIndex('byDeliveryType', { composite: ['deliveryType'] }, { composite: ['updatedAt'] });
      instance.addIndex('bySomeField', { field: 'someField', composite: ['deliveryType'] }, { composite: ['updatedAt'] });

      const schema = instance.build();

      expect(schema).to.deep.equal({
        schemaVersion: 1,
        serviceName: 'SpaceCat',
        modelClass: MockModel,
        collectionClass: MockCollection,
        attributes: {
          mockModelId: {
            type: 'string',
            required: true,
            readOnly: true,
            validate: instance.attributes.mockModelId.validate,
            default: instance.attributes.mockModelId.default,
          },
          createdAt: {
            type: 'string',
            readOnly: true,
            required: true,
            default: instance.attributes.createdAt.default,
          },
          updatedAt: {
            type: 'string',
            required: true,
            readOnly: true,
            watch: '*',
            default: instance.attributes.updatedAt.default,
            set: instance.attributes.updatedAt.set,
          },
          organizationId: {
            type: 'string',
            required: true,
            validate: instance.attributes.organizationId.validate,
          },
          siteId: {
            type: 'string',
            required: false,
            validate: instance.attributes.siteId.validate,
          },
          baseURL: {
            type: 'string',
            required: true,
            validate: instance.attributes.baseURL.validate,
          },
        },
        indexes: {
          primary: {
            pk: { field: 'pk', composite: ['mockModelId'] },
            sk: { field: 'sk', composite: [] },
          },
          all: {
            index: 'spacecat-data-MockModel-all',
            pk: { field: 'gsi1pk', template: 'ALL_MOCKMODELS' },
            sk: { field: 'test', template: '${test}' },
          },
          byOrganizationId: {
            index: 'spacecat-data-MockModel-byOrganizationId',
            pk: { composite: ['organizationId'], field: 'gsi2pk' },
            sk: { composite: ['updatedAt'], field: 'gsi2sk' },
          },
          bySiteId: {
            index: 'spacecat-data-MockModel-bySiteId',
            pk: { composite: ['siteId'], field: 'gsi3pk' },
            sk: { composite: ['someField'], field: 'gsi3sk' },
          },
          byDeliveryType: {
            index: 'spacecat-data-MockModel-byDeliveryType',
            pk: { composite: ['deliveryType'], field: 'gsi4pk' },
            sk: { composite: ['updatedAt'], field: 'gsi4sk' },
          },
          bySomeField: {
            index: 'spacecat-data-MockModel-bySomeField',
            pk: { composite: ['deliveryType'], field: 'someField' },
            sk: { composite: ['updatedAt'], field: 'gsi5sk' },
          },
        },
        references: {
          belongs_to: [{
            target: 'Organization',
            required: true,
          }, {
            target: 'Site',
            required: false,
          }],
          has_many: [{ target: 'Audits', removeDependent: false }],
          has_one: [],
        },
      });
    });
  });
});
