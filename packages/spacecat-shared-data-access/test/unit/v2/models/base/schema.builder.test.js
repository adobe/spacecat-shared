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
import { validate as uuidValidate } from 'uuid';

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import SchemaBuilder from '../../../../../src/v2/models/base/schema.builder.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SchemaBuilder', () => {
  let instance;

  beforeEach(() => {
    instance = new SchemaBuilder('test', 1, 'testService');
  });

  describe('constructor', () => {
    it('throws error if entity name is not provided', () => {
      expect(() => new SchemaBuilder())
        .to.throw('entityName is required and must be a non-empty string.');
    });

    it('throws error if version is not provided', () => {
      expect(() => new SchemaBuilder('test'))
        .to.throw('schemaVersion is required and must be a positive integer.');
    });

    it('throws an error if version is not a positive integer', () => {
      expect(() => new SchemaBuilder('test', -1))
        .to.throw('schemaVersion is required and must be a positive integer.');
      expect(() => new SchemaBuilder('test', '-1'))
        .to.throw('schemaVersion is required and must be a positive integer.');
      expect(() => new SchemaBuilder('test', 1.2))
        .to.throw('schemaVersion is required and must be a positive integer.');
    });

    it('throws error if service is not provided', () => {
      expect(() => new SchemaBuilder('test', 1))
        .to.throw('serviceName is required and must be a non-empty string.');
    });

    it('successfully creates an instance', () => {
      expect(instance).to.be.an.instanceOf(SchemaBuilder);
      expect(instance.entityName).to.equal('test');
      expect(instance.serviceName).to.equal('testService');
      expect(instance.schema).to.deep.equal({
        model: {
          entity: 'test',
          version: '1',
          service: 'testService',
        },
        attributes: {
          testId: {
            default: instance.schema.attributes.testId.default,
            type: 'string',
            required: true,
            readOnly: true,
            validate: instance.schema.attributes.testId.validate,
          },
          createdAt: {
            default: instance.schema.attributes.createdAt.default,
            type: 'string',
            readOnly: true,
            required: true,
          },
          updatedAt: {
            default: instance.schema.attributes.updatedAt.default,
            type: 'string',
            required: true,
            readOnly: true,
            watch: '*',
            set: instance.schema.attributes.updatedAt.set,
          },
        },
        indexes: {},
        references: { belongs_to: [], has_many: [], has_one: [] },
      });

      expect(instance.rawIndexes).to.deep.equal({
        primary: {
          pk: { composite: ['testId'], field: 'pk' },
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
      expect(instance.schema.attributes.test).to.deep.equal({
        type: 'string',
        required: true,
        default: 'test',
        validate: instance.schema.attributes.test.validate,
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
        index: 'testservice-data-test-all',
        pk: { field: 'gsi1pk', template: 'ALL_TESTS' },
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
        index: 'testservice-data-test-all',
        pk: { field: 'gsi1pk', template: 'ALL_TESTS' },
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
        index: 'testservice-data-test-test',
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
      expect(instance.schema.references.has_many).to.deep.equal([{ target: 'someEntity' }]);
      expect(instance.schema.attributes).to.not.have.property('someEntityId');
      expect(instance.rawIndexes.belongs_to).to.not.have.property('bySomeEntityId');
    });

    it('successfully adds a belongs_to reference', () => {
      const result = instance.addReference('belongs_to', 'someEntity');

      expect(result).to.equal(instance);
      expect(instance.schema.references.belongs_to).to.deep.equal([{ target: 'someEntity' }]);
      expect(instance.schema.attributes.someEntityId).to.deep.equal({
        required: true,
        type: 'string',
        validate: instance.schema.attributes.someEntityId.validate,
      });
      expect(instance.rawIndexes.belongs_to.bySomeEntityId).to.deep.equal({
        index: 'testservice-data-test-bySomeEntityId',
        pk: { composite: ['someEntityId'] },
        sk: { composite: ['updatedAt'] },
      });
    });
  });

  describe('validate, default, and set', () => {
    it('sets defaults for createdAt and updatedAt', () => {
      expect(isIsoDate(instance.schema.attributes.createdAt.default())).to.be.true;
      expect(isIsoDate(instance.schema.attributes.updatedAt.default())).to.be.true;
      expect(isIsoDate(instance.schema.attributes.updatedAt.set())).to.be.true;
    });

    it('sets default for id attribute', () => {
      expect(uuidValidate(instance.schema.attributes.testId.default())).to.be.true;
    });

    it('validates id attribute', () => {
      expect(instance.schema.attributes.testId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.schema.attributes.testId.validate('invalid')).to.be.false;
    });

    it('validates foreign key attribute', () => {
      instance.addReference('belongs_to', 'someEntity');
      expect(instance.schema.attributes.someEntityId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.schema.attributes.someEntityId.validate('invalid')).to.be.false;
    });

    it('validates non-required foreign key attribute', () => {
      instance.addReference('belongs_to', 'someEntity', [], false);
      expect(instance.schema.attributes.someEntityId.required).to.be.false;
      expect(instance.schema.attributes.someEntityId.validate()).to.be.true;
      expect(instance.schema.attributes.someEntityId.validate('78fec9c7-2141-4600-b7b1-ea5c78752b91')).to.be.true;
      expect(instance.schema.attributes.someEntityId.validate('invalid')).to.be.false;
    });
  });

  describe('build', () => {
    it('returns the built schema', () => {
      instance.addReference('belongs_to', 'Organization');
      instance.addReference('belongs_to', 'Site', ['someField'], false);
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
        model: { entity: 'test', version: '1', service: 'testService' },
        attributes: {
          testId: {
            type: 'string',
            required: true,
            readOnly: true,
            validate: instance.schema.attributes.testId.validate,
            default: instance.schema.attributes.testId.default,
          },
          createdAt: {
            type: 'string',
            readOnly: true,
            required: true,
            default: instance.schema.attributes.createdAt.default,
          },
          updatedAt: {
            type: 'string',
            required: true,
            readOnly: true,
            watch: '*',
            default: instance.schema.attributes.updatedAt.default,
            set: instance.schema.attributes.updatedAt.set,
          },
          organizationId: {
            type: 'string',
            required: true,
            validate: instance.schema.attributes.organizationId.validate,
          },
          siteId: {
            type: 'string',
            required: false,
            validate: instance.schema.attributes.siteId.validate,
          },
          baseURL: {
            type: 'string',
            required: true,
            validate: instance.schema.attributes.baseURL.validate,
          },
        },
        indexes: {
          primary: {
            pk: { field: 'pk', composite: ['testId'] },
            sk: { field: 'sk', composite: [] },
          },
          all: {
            index: 'testservice-data-test-all',
            pk: { field: 'gsi1pk', template: 'ALL_TESTS' },
            sk: { field: 'test', template: '${test}' },
          },
          byOrganizationId: {
            index: 'testservice-data-test-byOrganizationId',
            pk: { composite: ['organizationId'], field: 'gsi2pk' },
            sk: { composite: ['updatedAt'], field: 'gsi2sk' },
          },
          bySiteId: {
            index: 'testservice-data-test-bySiteId',
            pk: { composite: ['siteId'], field: 'gsi3pk' },
            sk: { composite: ['someField'], field: 'gsi3sk' },
          },
          byDeliveryType: {
            index: 'testservice-data-test-byDeliveryType',
            pk: { composite: ['deliveryType'], field: 'gsi4pk' },
            sk: { composite: ['updatedAt'], field: 'gsi4sk' },
          },
          bySomeField: {
            index: 'testservice-data-test-bySomeField',
            pk: { composite: ['deliveryType'], field: 'someField' },
            sk: { composite: ['updatedAt'], field: 'gsi5sk' },
          },
        },
        references: {
          belongs_to: [{ target: 'Organization' }, { target: 'Site' }],
          has_many: [{ target: 'Audits' }],
          has_one: [],
        },
      });
    });
  });
});
