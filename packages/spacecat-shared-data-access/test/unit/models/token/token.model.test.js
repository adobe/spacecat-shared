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

import Token from '../../../../src/models/token/token.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('TokenModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      tokenId: 'tok-12345',
      siteId: 'site-12345',
      tokenType: 'BROKEN_BACKLINK',
      cycle: '2025-02',
      total: 3,
      used: 1,
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
      updatedBy: 'system',
    };

    ({
      model: instance,
    } = createElectroMocks(Token, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the Token instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('ENTITY_NAME', () => {
    it('has ENTITY_NAME Token', () => {
      expect(Token.ENTITY_NAME).to.equal('Token');
    });
  });

  describe('TOKEN_TYPES', () => {
    it('defines BROKEN_BACKLINK token type', () => {
      expect(Token.TOKEN_TYPES.BROKEN_BACKLINK).to.equal('BROKEN_BACKLINK');
    });
  });

  describe('getRemaining', () => {
    it('returns total minus used', () => {
      expect(instance.getRemaining()).to.equal(2);
    });

    it('returns 0 when used >= total', () => {
      instance.record.used = 3;
      expect(instance.getRemaining()).to.equal(0);
    });

    it('returns 0 when used > total', () => {
      instance.record.used = 5;
      expect(instance.getRemaining()).to.equal(0);
    });

    it('works with getter methods when available', () => {
      instance.getTotal = () => 10;
      instance.getUsed = () => 4;
      expect(instance.getRemaining()).to.equal(6);
    });
  });

  describe('generateCompositeKeys', () => {
    it('returns siteId, tokenType, and cycle', () => {
      instance.getSiteId = () => 'site-12345';
      instance.getTokenType = () => 'BROKEN_BACKLINK';
      instance.getCycle = () => '2025-02';

      const keys = instance.generateCompositeKeys();

      expect(keys).to.deep.equal({
        siteId: 'site-12345',
        tokenType: 'BROKEN_BACKLINK',
        cycle: '2025-02',
      });
    });
  });
});
