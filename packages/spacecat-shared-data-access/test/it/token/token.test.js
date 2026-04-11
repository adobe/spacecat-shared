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

import { getTokenGrantConfig } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Token IT', () => {
  let sampleData;
  let Token;
  let SuggestionGrant;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Token = dataAccess.Token;
    SuggestionGrant = dataAccess.SuggestionGrant;
  });

  const createOpts = { createIfNotFound: true };

  describe('findBySiteIdAndTokenType', () => {
    // fixtures.sites[0].siteId
    const siteId = '5d6d4439-6659-46c2-b646-92d110fa5a52';
    const tokenType = 'grant_cwv';

    it('auto-creates a token for the current cycle when none exists', async () => {
      const config = getTokenGrantConfig(tokenType);
      const token = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);

      expect(token).to.be.an('object');
      expect(token.getSiteId()).to.equal(siteId);
      expect(token.getTokenType()).to.equal(tokenType);
      expect(token.getCycle()).to.equal(config.currentCycle);
      expect(token.getTotal()).to.equal(config.tokensPerCycle);
      expect(token.getUsed()).to.equal(0);
      expect(token.getRemaining()).to.equal(config.tokensPerCycle);
    });

    it('returns the existing token on subsequent calls', async () => {
      const first = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      const second = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);

      expect(second.getSiteId()).to.equal(first.getSiteId());
      expect(second.getTokenType()).to.equal(first.getTokenType());
      expect(second.getCycle()).to.equal(first.getCycle());
      expect(second.getTotal()).to.equal(first.getTotal());
      expect(second.getUsed()).to.equal(first.getUsed());
    });

    it('creates separate tokens for different token types', async () => {
      const cwvToken = await Token.findBySiteIdAndTokenType(siteId, 'grant_cwv', createOpts);
      const bbToken = await Token.findBySiteIdAndTokenType(siteId, 'grant_broken_backlinks', createOpts);

      expect(cwvToken.getTokenType()).to.equal('grant_cwv');
      expect(bbToken.getTokenType()).to.equal('grant_broken_backlinks');
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

  describe('grantSuggestions', () => {
    const siteId = '5d6d4439-6659-46c2-b646-92d110fa5a52';
    const tokenType = 'grant_cwv';

    it('grants a suggestion and consumes a token', async () => {
      const suggestion = sampleData.suggestions[6];
      const suggestionId = suggestion.getId();

      const tokenBefore = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      const usedBefore = tokenBefore.getUsed();

      const result = await SuggestionGrant.grantSuggestions([suggestionId], siteId, tokenType);

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('grantedSuggestions').that.is.an('array');

      const tokenAfter = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      expect(tokenAfter.getUsed()).to.equal(usedBefore + 1);
    });

    it('grants multiple suggestions in one call', async () => {
      const s1 = sampleData.suggestions[1];
      const s2 = sampleData.suggestions[2];
      const ids = [s1.getId(), s2.getId()];

      const tokenBefore = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      const usedBefore = tokenBefore.getUsed();

      const result = await SuggestionGrant.grantSuggestions(ids, siteId, tokenType);

      expect(result).to.have.property('success', true);

      const tokenAfter = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      expect(tokenAfter.getUsed()).to.equal(usedBefore + 1);
    });

    it('returns no_tokens when quota is exhausted', async () => {
      const { tokensPerCycle } = getTokenGrantConfig(tokenType);

      // Exhaust quota: each grantSuggestions call consumes one token regardless of list size
      for (let i = 0; i < tokensPerCycle; i += 1) {
        const suggestion = sampleData.suggestions[i % sampleData.suggestions.length];
        // eslint-disable-next-line no-await-in-loop -- sequential: each call consumes one token
        await SuggestionGrant.grantSuggestions([suggestion.getId()], siteId, tokenType);
      }

      const exhaustedToken = await Token.findBySiteIdAndTokenType(siteId, tokenType, createOpts);
      expect(exhaustedToken.getRemaining()).to.equal(0);
      expect(exhaustedToken.getUsed()).to.equal(tokensPerCycle);

      const lastSuggestion = sampleData.suggestions[sampleData.suggestions.length - 1];
      const result = await SuggestionGrant
        .grantSuggestions([lastSuggestion.getId()], siteId, tokenType);

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('reason', 'no_tokens');
    });

    it('throws when suggestionIds is not an array', async () => {
      await expect(
        SuggestionGrant.grantSuggestions('not-an-array', siteId, tokenType),
      ).to.be.rejectedWith(/suggestionIds must be an array/);
    });

    it('throws when suggestionIds contains empty strings', async () => {
      await expect(
        SuggestionGrant.grantSuggestions([''], siteId, tokenType),
      ).to.be.rejectedWith(/suggestionIds must be an array of non-empty strings/);
    });

    it('throws when siteId is missing', async () => {
      await expect(
        SuggestionGrant.grantSuggestions(['some-id'], '', tokenType),
      ).to.be.rejectedWith(/siteId is required/);
    });

    it('throws when tokenType is missing', async () => {
      await expect(
        SuggestionGrant.grantSuggestions(['some-id'], siteId, ''),
      ).to.be.rejectedWith(/tokenType is required/);
    });
  });
});
