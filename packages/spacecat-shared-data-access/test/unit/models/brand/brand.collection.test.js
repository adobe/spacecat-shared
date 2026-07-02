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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import Brand from '../../../../src/models/brand/brand.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('BrandCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    brandId: 'c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201',
    name: 'Collection Test Brand',
    status: 'active',
    semrushWorkspaceId: 'sub-ws-collection',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Brand, mockRecord));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('initializes the BrandCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  // The addAllIndex(['semrushWorkspaceId']) generates these accessors; assert
  // them so a schema typo that drops the index fails here rather than silently
  // breaking the 403-drift pointer-repair path.
  describe('auto-generated index accessors', () => {
    it('exposes allBySemrushWorkspaceId and findBySemrushWorkspaceId', () => {
      expect(instance.allBySemrushWorkspaceId).to.be.a('function');
      expect(instance.findBySemrushWorkspaceId).to.be.a('function');
    });

    // Symmetric addAllIndex(['semrushSubWorkspaceId']) for the transitional
    // mirror column — not used by any caller yet, but ready for the cutover.
    it('exposes allBySemrushSubWorkspaceId and findBySemrushSubWorkspaceId', () => {
      expect(instance.allBySemrushSubWorkspaceId).to.be.a('function');
      expect(instance.findBySemrushSubWorkspaceId).to.be.a('function');
    });
  });
});
