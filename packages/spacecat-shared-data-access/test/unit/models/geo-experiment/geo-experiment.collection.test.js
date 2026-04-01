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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import GeoExperiment from '../../../../src/models/geo-experiment/geo-experiment.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('GeoExperimentCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    geoExperimentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(GeoExperiment, mockRecord));
  });

  it('initializes correctly', () => {
    expect(instance).to.be.an('object');
    expect(instance.electroService).to.equal(mockElectroService);
    expect(instance.entityRegistry).to.equal(mockEntityRegistry);
    expect(instance.schema).to.equal(schema);
    expect(instance.log).to.equal(mockLogger);
    expect(model).to.be.an('object');
  });

  describe('allBySiteId', () => {
    it('throws when siteId is missing', async () => {
      await expect(instance.allBySiteId()).to.be.rejectedWith('SiteId is required');
    });

    it('returns data and cursor from allByIndexKeys', async () => {
      const mockExp = { getId: () => 'exp-1' };
      instance.allByIndexKeys = stub().resolves({ data: [mockExp], cursor: 'cur1' });

      const result = await instance.allBySiteId('site-123');

      expect(result.data).to.deep.equal([mockExp]);
      expect(result.cursor).to.equal('cur1');
      expect(instance.allByIndexKeys).to.have.been.calledWith(
        { siteId: 'site-123' },
        { returnCursor: true },
      );
    });

    it('returns empty array when no experiments found', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      const result = await instance.allBySiteId('site-123');

      expect(result.data).to.deep.equal([]);
      expect(result.cursor).to.be.null;
    });

    it('returns empty array when allByIndexKeys returns undefined data', async () => {
      instance.allByIndexKeys = stub().resolves({ data: undefined, cursor: null });

      const result = await instance.allBySiteId('site-123');

      expect(result.data).to.deep.equal([]);
    });

    it('passes pagination options through to allByIndexKeys', async () => {
      instance.allByIndexKeys = stub().resolves({ data: [], cursor: null });

      await instance.allBySiteId('site-123', { limit: 10, cursor: 'abc' });

      const callArgs = instance.allByIndexKeys.getCall(0).args;
      expect(callArgs[1]).to.deep.include({ limit: 10, cursor: 'abc', returnCursor: true });
    });
  });
});
