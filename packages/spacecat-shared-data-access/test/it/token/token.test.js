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

import { getTokenGrantConfig } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Token IT', () => {
  let Token;

  before(async function () {
    this.timeout(10000);
    await seedDatabase();

    const dataAccess = getDataAccess();
    Token = dataAccess.Token;
  });

  describe('findBySiteIdAndTokenType', () => {
    const siteId = '5d6d4439-6659-46c2-b646-92d110fa5a52'; // fixtures.sites[0].siteId
    const tokenType = 'monthly_suggestion_cwv';

    it('auto-creates a token for the current cycle when none exists', async () => {
      const config = getTokenGrantConfig(tokenType);
      const token = await Token.findBySiteIdAndTokenType(siteId, tokenType);

      expect(token).to.be.an('object');
      expect(token.getSiteId()).to.equal(siteId);
      expect(token.getTokenType()).to.equal(tokenType);
      expect(token.getCycle()).to.equal(config.currentCycle);
      expect(token.getTotal()).to.equal(config.tokensPerCycle);
      expect(token.getUsed()).to.equal(0);
      expect(token.getRemaining()).to.equal(config.tokensPerCycle);
    });

    it('returns the existing token on subsequent calls', async () => {
      const first = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      const second = await Token.findBySiteIdAndTokenType(siteId, tokenType);

      expect(second.getSiteId()).to.equal(first.getSiteId());
      expect(second.getTokenType()).to.equal(first.getTokenType());
      expect(second.getCycle()).to.equal(first.getCycle());
      expect(second.getTotal()).to.equal(first.getTotal());
      expect(second.getUsed()).to.equal(first.getUsed());
    });

    it('creates separate tokens for different token types', async () => {
      const cwvToken = await Token.findBySiteIdAndTokenType(siteId, 'monthly_suggestion_cwv');
      const bbToken = await Token.findBySiteIdAndTokenType(siteId, 'monthly_suggestion_broken_backlinks');

      expect(cwvToken.getTokenType()).to.equal('monthly_suggestion_cwv');
      expect(bbToken.getTokenType()).to.equal('monthly_suggestion_broken_backlinks');
      expect(cwvToken.getTotal()).to.equal(3);
      expect(bbToken.getTotal()).to.equal(3);
    });

    it('throws for an unknown token type', async () => {
      await expect(
        Token.findBySiteIdAndTokenType(siteId, 'nonexistent_type'),
      ).to.be.rejectedWith(/no token grant config/);
    });

    it('throws when siteId is missing', async () => {
      await expect(
        Token.findBySiteIdAndTokenType('', tokenType),
      ).to.be.rejectedWith(/required/);
    });

    it('throws when tokenType is missing', async () => {
      await expect(
        Token.findBySiteIdAndTokenType(siteId, ''),
      ).to.be.rejectedWith(/required/);
    });
  });
});
