/*
 * Copyright 2025 Adobe. All rights reserved.
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
import sinonChai from 'sinon-chai';

import AccessGrantLog from '../../../../src/models/access-grant-log/access-grant-log.model.js';
import AccessGrantLogCollection from '../../../../src/models/access-grant-log/access-grant-log.collection.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AccessGrantLogCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    organizationId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    productCode: 'LLMO',
    action: 'grant',
    role: 'agency',
    performedBy: 'ims:user123',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(AccessGrantLog, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the AccessGrantLogCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('COLLECTION_NAME', () => {
    it('has the correct collection name', () => {
      expect(AccessGrantLogCollection.COLLECTION_NAME).to.equal('AccessGrantLogCollection');
    });
  });
});
