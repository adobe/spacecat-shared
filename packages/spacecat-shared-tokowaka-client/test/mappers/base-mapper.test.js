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
/* eslint-disable max-classes-per-file, class-methods-use-this */

import { expect } from 'chai';
import BaseOpportunityMapper from '../../src/mappers/base-mapper.js';

describe('BaseOpportunityMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new BaseOpportunityMapper(log);
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

    it('canDeploy should throw error if not implemented', () => {
      expect(() => mapper.canDeploy({}))
        .to.throw('canDeploy() must be implemented by subclass');
    });
  });

  describe('createBasePatch', () => {
    it('should use getUpdatedAt method when available', () => {
      // Create a concrete subclass for testing
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionToPatch() { return {}; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper();
      const suggestion = {
        getId: () => 'test-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
      };

      const patch = testMapper.createBasePatch(suggestion, 'opp-456');

      expect(patch.suggestionId).to.equal('test-123');
      expect(patch.opportunityId).to.equal('opp-456');
      expect(patch.lastUpdated).to.equal(new Date('2025-01-15T10:00:00.000Z').getTime());
      expect(patch.prerenderRequired).to.be.true;
    });

    it('should use Date.now() when getUpdatedAt returns null', () => {
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionToPatch() { return {}; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper();
      const suggestion = {
        getId: () => 'test-no-date',
        getUpdatedAt: () => null, // Returns null
      };

      const beforeTime = Date.now();
      const patch = testMapper.createBasePatch(suggestion, 'opp-fallback');
      const afterTime = Date.now();

      expect(patch.suggestionId).to.equal('test-no-date');
      expect(patch.opportunityId).to.equal('opp-fallback');
      expect(patch.lastUpdated).to.be.at.least(beforeTime);
      expect(patch.lastUpdated).to.be.at.most(afterTime);
      expect(patch.prerenderRequired).to.be.true;
    });
  });
});
