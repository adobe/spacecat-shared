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

import EntityRegistry from '../../../../src/models/base/entity.registry.js';
import { BaseCollection, DataAccessError } from '../../../../src/index.js';
import { getEntitySchemas } from '../../../../src/models/base/entity-definitions.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('EntityRegistry', () => {
  let electroService;
  let entityRegistry;

  beforeEach(() => {
    electroService = {
      entities: {
        apiKey: {
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

    entityRegistry = new EntityRegistry(electroService, console);
  });

  it('gets collection by collection name', () => {
    const collection = entityRegistry.getCollection('ApiKeyCollection');

    expect(collection).to.be.an.instanceOf(BaseCollection);
  });

  it('throws error when getting a non-existing collection', () => {
    expect(() => entityRegistry.getCollection('NonExistentCollection'))
      .to.throw(DataAccessError, 'Collection NonExistentCollection not found');
  });

  it('gets all collections', () => {
    const collections = entityRegistry.getCollections();

    expect(collections).to.be.an('object');
    // Should have all registered entities from ENTITY_DEFINITIONS
    expect(Object.keys(collections).length).to.be.greaterThan(0);
    expect(collections.ApiKey).to.be.an.instanceOf(BaseCollection);
  });

  it('getEntitySchemas returns all entity schemas', () => {
    const entities = getEntitySchemas();

    expect(entities).to.be.an('object');
    // Should have all registered entities from ENTITY_DEFINITIONS
    expect(Object.keys(entities).length).to.be.greaterThan(0);
    expect(entities.apiKey).to.be.an('object');
    expect(entities.apiKey.model).to.be.an('object');
    expect(entities.apiKey.attributes).to.be.an('object');
  });
});
