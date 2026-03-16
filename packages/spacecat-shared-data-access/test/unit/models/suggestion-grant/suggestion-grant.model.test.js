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

import SuggestionGrant from '../../../../src/models/suggestion-grant/suggestion-grant.model.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SuggestionGrantModel', () => {
  let instance;
  let mockRecord;

  beforeEach(() => {
    mockRecord = {
      suggestionGrantId: 'grant-uuid-1',
      suggestionId: 'sugg-uuid-1',
      grantId: 'grant-id-1',
      siteId: 'site-uuid-1',
      tokenId: 'token-uuid-1',
      tokenType: 'grant_cwv',
      createdAt: '2025-03-01T00:00:00.000Z',
      grantedAt: '2025-03-01T00:00:00.000Z',
      updatedAt: '2025-03-01T00:00:00.000Z',
      updatedBy: 'system',
    };

    ({
      model: instance,
    } = createElectroMocks(SuggestionGrant, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SuggestionGrant instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('ENTITY_NAME', () => {
    it('has ENTITY_NAME SuggestionGrant', () => {
      expect(SuggestionGrant.ENTITY_NAME).to.equal('SuggestionGrant');
    });
  });
});
