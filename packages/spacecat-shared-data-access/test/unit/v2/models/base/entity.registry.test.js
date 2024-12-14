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
import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import EntityRegistry from '../../../../../src/v2/models/base/entity.registry.js';
import { BaseCollection, BaseModel } from '../../../../../src/index.js';
import Schema from '../../../../../src/v2/models/base/schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('EntityRegistry', () => {
  const MockModel = class MockModel extends BaseModel {};
  const MockCollection = class MockCollection extends BaseCollection {};
  const MockSchema = new Schema(
    MockModel,
    MockCollection,
    { entity: 'test' },
    {},
    {},
    {},
  );

  let electroService;
  let entityRegistry;
  let originalEntities;

  beforeEach(() => {
    originalEntities = { ...EntityRegistry.entities };
    EntityRegistry.entities = {};

    electroService = {
      entities: {
        mockModel: {
          model: {
            name: 'test',
            indexes: [],
            schema: {},
            original: {
              references: {},
            },
          },
        },
      },
    };

    EntityRegistry.registerEntity(MockSchema, MockCollection);

    entityRegistry = new EntityRegistry(electroService, console);
  });

  afterEach(() => {
    EntityRegistry.entities = originalEntities;
  });

  it('gets collection by collection name', () => {
    const collection = entityRegistry.getCollection('MockCollection');

    expect(collection).to.be.an.instanceOf(BaseCollection);
  });

  it('throws error when getting a non-existing collection', () => {
    expect(() => entityRegistry.getCollection('NonExistentCollection'))
      .to.throw('Collection NonExistentCollection not found');
  });

  it('gets all collections', () => {
    const collections = entityRegistry.getCollections();

    expect(collections).to.be.an('object');
    expect(Object.keys(collections)).to.have.lengthOf(1);
    expect(collections.Mock).to.be.an.instanceOf(MockCollection);
  });

  it('gets all entities', () => {
    const entities = EntityRegistry.getEntities();

    expect(entities).to.be.an('object');
    expect(Object.keys(entities)).to.have.lengthOf(1);
    expect(entities).to.deep.equal({
      test: {
        attributes: {},
        indexes: {},
        model: {
          entity: 'test',
        },
      },
    });
  });
});
