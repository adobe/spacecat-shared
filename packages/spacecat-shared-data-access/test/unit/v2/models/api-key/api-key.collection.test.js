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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import sinonChai from 'sinon-chai';

import ApiKeyCollection from '../../../../../src/v2/models/api-key/api-key.collection.js';
import ApiKey from '../../../../../src/v2/models/api-key/api-key.model.js';
import ApiKeySchema from '../../../../../src/v2/models/api-key/api-key.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ApiKeySchema).model.schema;

let mockElectroService;

describe('ApiKeyCollection', () => {
  let instance;
  let mockApiKeyModel;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    apiKeyId: 's12345',
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      warn: spy(),
    };

    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockElectroService = {
      entities: {
        apiKey: {
          model: {
            name: 'apiKey',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['apiKeyId'],
                },
              },
            },
          },
        },
      },
    };

    mockApiKeyModel = new ApiKey(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    instance = new ApiKeyCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the ApiKeyCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.log).to.equal(mockLogger);

      expect(mockApiKeyModel).to.be.an('object');
    });
  });
});
