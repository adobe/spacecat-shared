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

import { expect } from 'chai';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

describe('SuggestionGrant IT', () => {
  let sampleData;
  let SuggestionGrant;
  let Suggestion;
  let Token;

  // Use site 1 so token pool is independent of token.test.js
  // (site 0) and aligned with suggestion.test.js
  const siteId = '78fec9c7-2141-4600-b7b1-ea5c78752b91';
  const tokenType = 'grant_cwv';

  /** One suggestion granted in before(); used by tests that need a granted suggestion */
  let grantedSuggestionId;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SuggestionGrant = dataAccess.SuggestionGrant;
    Suggestion = dataAccess.Suggestion;
    Token = dataAccess.Token;

    expect(SuggestionGrant).to.be.an('object');
    expect(sampleData.suggestions.length).to.be.at.least(6);

    // Ensure token exists and grant one suggestion so suggestion_grants has at least one row
    await Token.findBySiteIdAndTokenType(siteId, tokenType, { createIfNotFound: true });
    const suggestionToGrant = sampleData.suggestions[4];
    const grantResult = await Suggestion.grantSuggestions(
      [suggestionToGrant.getId()],
      siteId,
      tokenType,
    );
    const reason = grantResult.reason ?? 'unknown';
    expect(
      grantResult.success,
      `grantSuggestions should succeed. reason=${reason}`,
    ).to.be.true;
    grantedSuggestionId = suggestionToGrant.getId();
  });

  describe('findBySuggestionIds', () => {
    it('returns grant rows for granted suggestion IDs', async () => {
      const result = await SuggestionGrant.findBySuggestionIds([grantedSuggestionId]);

      expect(result).to.be.an('array').with.length(1);
      expect(result[0]).to.have.property('suggestion_id', grantedSuggestionId);
      expect(result[0]).to.have.property('grant_id');
      expect(result[0].grant_id).to.match(/^[0-9a-f-]{36}$/i);
    });

    it('returns empty array when given empty array', async () => {
      const result = await SuggestionGrant.findBySuggestionIds([]);

      expect(result).to.deep.equal([]);
    });

    it('returns empty array for suggestion IDs that are not granted', async () => {
      const notGrantedId = sampleData.suggestions[0].getId();
      const result = await SuggestionGrant.findBySuggestionIds([notGrantedId]);

      expect(result).to.be.an('array').that.is.empty;
    });

    it('returns only rows for granted IDs when mixing granted and not granted', async () => {
      const notGrantedId = sampleData.suggestions[0].getId();
      const suggestionIds = [notGrantedId, grantedSuggestionId];
      const result = await SuggestionGrant.findBySuggestionIds(suggestionIds);

      expect(result).to.be.an('array').with.length(1);
      expect(result[0].suggestion_id).to.equal(grantedSuggestionId);
    });
  });

  describe('invokeGrantSuggestionsRpc', () => {
    it('inserts suggestion_grants and returns success when token is available', async function () {
      this.timeout(10000);
      // Use a suggestion not yet granted
      const suggestionToGrant = sampleData.suggestions[3];
      const suggestionId = suggestionToGrant.getId();
      const token = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      expect(token).to.be.an('object');
      expect(token.getRemaining()).to.be.at.least(0);

      // If no tokens left, create a new cycle token so the RPC can succeed
      let cycle = token.getCycle();
      if (token.getRemaining() < 1) {
        const opts = { createIfNotFound: true, total: 5 };
        await Token.findBySiteIdAndTokenType(siteId, tokenType, opts);
        const newToken = await Token.findBySiteIdAndTokenType(siteId, tokenType);
        cycle = newToken.getCycle();
      }

      const rpcResult = await SuggestionGrant.invokeGrantSuggestionsRpc(
        [suggestionId],
        siteId,
        tokenType,
        cycle,
      );

      expect(rpcResult.error).to.be.null;
      expect(rpcResult.data).to.be.an('array').with.lengthOf.at.least(1);
      const row = rpcResult.data[0];
      expect(row).to.have.property('success');
      if (row.success) {
        const findByResult = await SuggestionGrant.findBySuggestionIds([suggestionId]);
        expect(findByResult.data).to.be.an('array').with.length(1);
        expect(findByResult.data[0].suggestion_id).to.equal(suggestionId);
      }
    });
  });
});
