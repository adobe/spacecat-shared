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
import TokenCollection from '../../../../src/models/token/token.collection.js';
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
    tokenType: 'monthly_suggestion_broken_backlinks',
    cycle: '2025-02',
    total: 3,
    used: 1,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      model,
      schema,
    } = createElectroMocks(Token, mockRecord));
    // Use PostgREST path: clear entities then create collection so this.entity is undefined
    mockElectroService.entities = {};
    instance = new TokenCollection(mockElectroService, mockEntityRegistry, schema, mockLogger);
  });

  describe('constructor', () => {
    it('initializes the TokenCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.postgrestService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('findBySiteIdAndTokenType', () => {
    let expectedCycle;

    before(async () => {
      const { getTokenGrantConfig } = await import('@adobe/spacecat-shared-utils');
      expectedCycle = getTokenGrantConfig('monthly_suggestion_cwv').currentCycle;
    });

    it('returns existing token when found', async () => {
      instance.findByIndexKeys = stub().resolves(model);

      const result = await instance.findBySiteIdAndTokenType('site-1', 'monthly_suggestion_cwv');

      expect(result).to.equal(model);
      expect(instance.findByIndexKeys).to.have.been.calledOnceWith(
        { siteId: 'site-1', tokenType: 'monthly_suggestion_cwv', cycle: expectedCycle },
        { limit: 1 },
      );
    });

    it('throws if siteId or tokenType is missing', async () => {
      await expect(instance.findBySiteIdAndTokenType(undefined, 'monthly_suggestion_cwv'))
        .to.be.rejectedWith(/siteId|required/);
      await expect(instance.findBySiteIdAndTokenType('site-1', ''))
        .to.be.rejectedWith(/tokenType|required/);
    });

    it('creates token from config when not found and returns it', async function () {
      const { getTokenGrantConfig } = await import('@adobe/spacecat-shared-utils');
      if (typeof getTokenGrantConfig !== 'function') {
        this.skip();
      }
      instance.findByIndexKeys = stub().resolves(null);
      instance.create = stub().resolves(model);

      const result = await instance.findBySiteIdAndTokenType('site-1', 'monthly_suggestion_cwv');

      expect(result).to.equal(model);
      const config = getTokenGrantConfig('monthly_suggestion_cwv');
      expect(instance.create).to.have.been.calledOnceWith({
        siteId: 'site-1',
        tokenType: 'monthly_suggestion_cwv',
        cycle: expectedCycle,
        total: config.tokensPerCycle,
        used: 0,
      });
    });

    it('returns null when not found and createIfNotFound is false', async () => {
      instance.findByIndexKeys = stub().resolves(null);
      instance.create = stub();

      const result = await instance.findBySiteIdAndTokenType(
        'site-1',
        'monthly_suggestion_cwv',
        false,
      );

      expect(result).to.be.null;
      expect(instance.create).to.not.have.been.called;
    });

    it('throws when no token grant config for tokenType', async function () {
      const { getTokenGrantConfig } = await import('@adobe/spacecat-shared-utils');
      if (typeof getTokenGrantConfig !== 'function') {
        this.skip();
      }

      await expect(
        instance.findBySiteIdAndTokenType('site-1', 'unknown_token_type'),
      ).to.be.rejectedWith(/no token grant config for tokenType: unknown_token_type/);
    });
  });

  describe('create', () => {
    it('creates a token via PostgREST when all required fields provided', async () => {
      const item = {
        siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
        tokenType: 'monthly_suggestion_cwv',
        cycle: '2025-02',
        total: 3,
        used: 0,
      };
      const dbRow = {
        site_id: item.siteId,
        token_type: item.tokenType,
        cycle: item.cycle,
        total: item.total,
        used: item.used,
        created_at: '2025-02-01T00:00:00.000Z',
        updated_at: '2025-02-01T00:00:00.000Z',
      };
      const chain = {};
      chain.insert = stub().returns(chain);
      chain.upsert = stub().returns(chain);
      chain.select = stub().returns(chain);
      chain.maybeSingle = stub().resolves({ data: dbRow, error: null });
      mockElectroService.from = stub().returns(chain);

      const result = await instance.create(item);

      expect(result).to.be.an('object');
      expect(result.record.siteId).to.equal(item.siteId);
      expect(result.record.tokenType).to.equal(item.tokenType);
      expect(result.record.cycle).to.equal(item.cycle);
      expect(mockElectroService.from).to.have.been.calledWith('tokens');
    });
  });
});
