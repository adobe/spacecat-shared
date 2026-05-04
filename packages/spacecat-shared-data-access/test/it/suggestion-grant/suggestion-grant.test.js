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

import { expect } from 'chai';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

describe('SuggestionGrant IT', () => {
  let sampleData;
  let SuggestionGrant;
  let Token;

  // Use site 1 so token pool is independent of token.test.js
  // (site 0) and aligned with suggestion.test.js
  const siteId = '78fec9c7-2141-4600-b7b1-ea5c78752b91';
  const tokenType = 'grant_cwv';

  /** One suggestion granted in before(); used by tests that need a granted suggestion */
  let grantedSuggestionId;

  before(async function () {
    this.timeout(30000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    SuggestionGrant = dataAccess.SuggestionGrant;
    Token = dataAccess.Token;

    expect(SuggestionGrant).to.be.an('object');
    expect(sampleData.suggestions.length).to.be.at.least(6);

    // Ensure token exists and grant one suggestion so suggestion_grants has at least one row
    await Token.findBySiteIdAndTokenType(siteId, tokenType, { createIfNotFound: true });
    const suggestionToGrant = sampleData.suggestions[4];
    const grantResult = await SuggestionGrant.grantSuggestions(
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
      this.timeout(30000);
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
        expect(findByResult).to.be.an('array').with.length(1);
        expect(findByResult[0].suggestion_id).to.equal(suggestionId);
      }
    });
  });

  describe('revokeSuggestionGrant', () => {
    it('revokes a granted suggestion and refunds the token', async function () {
      this.timeout(30000);

      // Grant a fresh suggestion so we have a known grant to revoke
      const suggestionToRevoke = sampleData.suggestions[5];
      const suggestionId = suggestionToRevoke.getId();

      await Token.findBySiteIdAndTokenType(siteId, tokenType, { createIfNotFound: true });
      const grantResult = await SuggestionGrant.grantSuggestions(
        [suggestionId],
        siteId,
        tokenType,
      );
      expect(grantResult.success, `grant should succeed: ${grantResult.reason}`).to.be.true;

      // Get the grant ID from the suggestion_grants table
      const grantRows = await SuggestionGrant.findBySuggestionIds([suggestionId]);
      expect(grantRows).to.be.an('array').with.length(1);
      const { grant_id: grantId } = grantRows[0];

      // Record token usage before revoke
      const tokenBefore = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      const usedBefore = tokenBefore.getUsed();

      // Revoke the grant
      const revokeResult = await SuggestionGrant.revokeSuggestionGrant(grantId);

      expect(revokeResult).to.have.property('success', true);
      expect(revokeResult).to.have.property('revokedCount').that.is.at.least(1);

      // Verify suggestion_grants rows are removed
      const afterRows = await SuggestionGrant.findBySuggestionIds([suggestionId]);
      expect(afterRows).to.be.an('array').that.is.empty;

      // Verify token was refunded (used decremented by 1)
      const tokenAfter = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      expect(tokenAfter.getUsed()).to.equal(usedBefore - 1);
    });

    it('returns success false for a non-existent grant ID', async function () {
      this.timeout(30000);

      const fakeGrantId = '00000000-0000-0000-0000-000000000000';
      const result = await SuggestionGrant.revokeSuggestionGrant(fakeGrantId);

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('reason', 'grant_not_found');
    });
  });

  describe('invokeRevokeSuggestionGrantRpc', () => {
    it('returns grant_not_found for a non-existent grant ID', async function () {
      this.timeout(30000);

      const fakeGrantId = '00000000-0000-0000-0000-000000000000';
      const rpcResult = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(fakeGrantId);

      expect(rpcResult.error).to.be.null;
      expect(rpcResult.data).to.be.an('array').with.lengthOf(1);
      expect(rpcResult.data[0]).to.deep.equal({
        success: false,
        reason: 'grant_not_found',
        revoked_count: null,
      });
    });

    it('deletes suggestion_grants rows and decrements token used by 1', async function () {
      this.timeout(30000);

      // Grant two suggestions under one grant_id
      const sugg0 = sampleData.suggestions[0];
      const sugg1 = sampleData.suggestions[1];
      const ids = [sugg0.getId(), sugg1.getId()];

      await Token.findBySiteIdAndTokenType(siteId, tokenType, { createIfNotFound: true });
      const grantResult = await SuggestionGrant.grantSuggestions(ids, siteId, tokenType);
      expect(grantResult.success, `grant failed: ${grantResult.reason}`).to.be.true;

      // All granted suggestions share the same grant_id
      const grantRows = await SuggestionGrant.findBySuggestionIds(ids);
      expect(grantRows).to.have.lengthOf(2);
      const { grant_id: grantId } = grantRows[0];
      expect(grantRows[1].grant_id).to.equal(grantId);

      // Snapshot token.used before revoke
      const tokenBefore = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      const usedBefore = tokenBefore.getUsed();

      // Revoke via RPC
      const rpcResult = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(grantId);

      expect(rpcResult.error).to.be.null;
      const row = rpcResult.data[0];
      expect(row.success).to.be.true;
      expect(row.reason).to.be.null;
      expect(row.revoked_count).to.equal(2);

      // Verify suggestion_grants rows deleted
      const afterRows = await SuggestionGrant.findBySuggestionIds(ids);
      expect(afterRows).to.be.an('array').that.is.empty;

      // Verify token.used decremented by exactly 1
      const tokenAfter = await Token.findBySiteIdAndTokenType(siteId, tokenType);
      expect(tokenAfter.getUsed()).to.equal(usedBefore - 1);
    });

    it('revoking the same grant_id twice returns grant_not_found on second call', async function () {
      this.timeout(30000);

      const sugg = sampleData.suggestions[2];
      const suggId = sugg.getId();

      await Token.findBySiteIdAndTokenType(siteId, tokenType, { createIfNotFound: true });
      const grantResult = await SuggestionGrant.grantSuggestions([suggId], siteId, tokenType);
      expect(grantResult.success, `grant failed: ${grantResult.reason}`).to.be.true;

      const grantRows = await SuggestionGrant.findBySuggestionIds([suggId]);
      const { grant_id: grantId } = grantRows[0];

      // First revoke succeeds
      const first = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(grantId);
      expect(first.data[0].success).to.be.true;

      // Second revoke on same grant_id fails
      const second = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(grantId);
      expect(second.error).to.be.null;
      expect(second.data[0]).to.deep.equal({
        success: false,
        reason: 'grant_not_found',
        revoked_count: null,
      });
    });

    it('revoke only affects the targeted grant_id, not other grants', async function () {
      this.timeout(30000);

      // Use separate token types so each grant gets its own fresh token pool
      const tokenTypeA = 'grant_broken_backlinks';
      const tokenTypeB = 'grant_alt_text';
      const suggA = sampleData.suggestions[0];
      const suggB = sampleData.suggestions[1];

      await Token.findBySiteIdAndTokenType(siteId, tokenTypeA, { createIfNotFound: true });
      await Token.findBySiteIdAndTokenType(siteId, tokenTypeB, { createIfNotFound: true });

      const grantA = await SuggestionGrant.grantSuggestions(
        [suggA.getId()],
        siteId,
        tokenTypeA,
      );
      expect(grantA.success, `grantA failed: ${grantA.reason}`).to.be.true;

      const grantB = await SuggestionGrant.grantSuggestions(
        [suggB.getId()],
        siteId,
        tokenTypeB,
      );
      expect(grantB.success, `grantB failed: ${grantB.reason}`).to.be.true;

      const rowsA = await SuggestionGrant.findBySuggestionIds([suggA.getId()]);
      const rowsB = await SuggestionGrant.findBySuggestionIds([suggB.getId()]);
      const grantIdA = rowsA[0].grant_id;
      const grantIdB = rowsB[0].grant_id;

      // Revoke only grant A
      const rpcResult = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(grantIdA);
      expect(rpcResult.data[0].success).to.be.true;

      // Grant A's rows are gone
      const afterA = await SuggestionGrant.findBySuggestionIds([suggA.getId()]);
      expect(afterA).to.be.an('array').that.is.empty;

      // Grant B's rows are untouched
      const afterB = await SuggestionGrant.findBySuggestionIds([suggB.getId()]);
      expect(afterB).to.have.lengthOf(1);
      expect(afterB[0].grant_id).to.equal(grantIdB);
    });

    it('revoke with a single suggestion returns revoked_count of 1', async function () {
      this.timeout(30000);

      // Use a fresh token type to avoid exhausting the grant_cwv pool
      const freshTokenType = 'grant_alt_text';
      const sugg = sampleData.suggestions[2];
      await Token.findBySiteIdAndTokenType(siteId, freshTokenType, { createIfNotFound: true });
      const grantResult = await SuggestionGrant.grantSuggestions(
        [sugg.getId()],
        siteId,
        freshTokenType,
      );
      expect(grantResult.success, `grant failed: ${grantResult.reason}`).to.be.true;

      const rows = await SuggestionGrant.findBySuggestionIds([sugg.getId()]);
      const { grant_id: grantId } = rows[0];

      const rpcResult = await SuggestionGrant.invokeRevokeSuggestionGrantRpc(grantId);
      expect(rpcResult.data[0].success).to.be.true;
      expect(rpcResult.data[0].revoked_count).to.equal(1);
    });
  });
});
