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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Token from '../../../../src/models/token/token.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('TokenCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    tokenId: 'tok-12345',
    siteId: 'site-12345',
    tokenType: 'BROKEN_BACKLINK',
    cycle: '2025-02',
    total: 3,
    used: 1,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Token, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the TokenCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('findById', () => {
    it('throws if siteId is not provided', async () => {
      await expect(instance.findById(undefined, 'BROKEN_BACKLINK', '2025-02'))
        .to.be.rejectedWith(/siteId|required/);
    });

    it('throws if tokenType is not provided', async () => {
      await expect(instance.findById('site-12345', '', '2025-02'))
        .to.be.rejectedWith(/tokenType|required/);
    });

    it('throws if cycle is not provided', async () => {
      await expect(instance.findById('site-12345', 'BROKEN_BACKLINK', ''))
        .to.be.rejectedWith(/cycle|required/);
    });

    it('returns the token when found', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findById('site-12345', 'BROKEN_BACKLINK', '2025-02');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith(
        {
          siteId: 'site-12345',
          tokenType: 'BROKEN_BACKLINK',
          cycle: '2025-02',
        },
        { limit: 1 },
      );
    });

    it('returns null when not found', async () => {
      instance.findByIndexKeys = stub().resolves(null);

      const result = await instance.findById('site-12345', 'BROKEN_BACKLINK', '2025-02');

      expect(result).to.be.null;
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith(
        { siteId: 'site-12345', tokenType: 'BROKEN_BACKLINK', cycle: '2025-02' },
        { limit: 1 },
      );
    });
  });

  describe('allBySiteIdAndTokenType', () => {
    it('throws if siteId is not provided', async () => {
      await expect(instance.allBySiteIdAndTokenType(undefined, 'BROKEN_BACKLINK'))
        .to.be.rejectedWith(/siteId|required/);
    });

    it('throws if tokenType is not provided', async () => {
      await expect(instance.allBySiteIdAndTokenType('site-12345', ''))
        .to.be.rejectedWith(/tokenType|required/);
    });

    it('returns array of tokens from allByIndexKeys', async () => {
      const tokens = [model];
      instance.allByIndexKeys = stub().resolves(tokens);

      const result = await instance.allBySiteIdAndTokenType('site-12345', 'BROKEN_BACKLINK');

      expect(result).to.deep.equal(tokens);
      expect(instance.allByIndexKeys).to.have.been.calledOnceWith(
        { siteId: 'site-12345', tokenType: 'BROKEN_BACKLINK' },
        {},
      );
    });

    it('returns empty array when allByIndexKeys returns non-array', async () => {
      instance.allByIndexKeys = stub().resolves(null);

      const result = await instance.allBySiteIdAndTokenType('site-12345', 'BROKEN_BACKLINK');

      expect(result).to.deep.equal([]);
    });
  });

  describe('create', () => {
    it('throws if siteId, tokenType, or cycle is missing', async () => {
      await expect(instance.create({ tokenType: 'BROKEN_BACKLINK', cycle: '2025-02' }))
        .to.be.rejectedWith('siteId, tokenType, and cycle are required');
      await expect(instance.create({ siteId: 'site-1', cycle: '2025-02' }))
        .to.be.rejectedWith('siteId, tokenType, and cycle are required');
      await expect(instance.create({ siteId: 'site-1', tokenType: 'BROKEN_BACKLINK' }))
        .to.be.rejectedWith('siteId, tokenType, and cycle are required');
    });

    it('creates a token with upsert when all required fields provided', async () => {
      const item = {
        siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
        tokenType: 'BROKEN_BACKLINK',
        cycle: '2025-02',
        total: 3,
        used: 0,
      };
      const result = await instance.create(item);

      expect(result).to.be.an('object');
      expect(result.record.siteId).to.equal(item.siteId);
      expect(result.record.tokenType).to.equal(item.tokenType);
      expect(result.record.cycle).to.equal(item.cycle);
    });
  });
});
