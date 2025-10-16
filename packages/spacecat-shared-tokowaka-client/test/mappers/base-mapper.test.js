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
import BaseOpportunityMapper from '../../src/mappers/base-mapper.js';

describe('BaseOpportunityMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new BaseOpportunityMapper();
  });

  describe('abstract methods', () => {
    it('getOpportunityType should throw error', () => {
      expect(() => mapper.getOpportunityType())
        .to.throw('getOpportunityType() must be implemented by subclass');
    });

    it('requiresPrerender should throw error', () => {
      expect(() => mapper.requiresPrerender())
        .to.throw('requiresPrerender() must be implemented by subclass');
    });

    it('suggestionToPatch should throw error', () => {
      expect(() => mapper.suggestionToPatch({}, 'opp-123'))
        .to.throw('suggestionToPatch() must be implemented by subclass');
    });

    it('validateSuggestionData should return false by default', () => {
      const result = mapper.validateSuggestionData({});
      expect(result).to.be.false;
    });

    it('canDeploy should return eligible by default', () => {
      const result = mapper.canDeploy({});

      expect(result).to.deep.equal({ eligible: true });
    });
  });
});
