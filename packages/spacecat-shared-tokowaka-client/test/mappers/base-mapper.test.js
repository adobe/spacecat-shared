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

    it('suggestionsToPatches should throw error', () => {
      expect(() => mapper.suggestionsToPatches('/path', [], 'opp-123', null))
        .to.throw('suggestionsToPatches() must be implemented by subclass');
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

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const suggestion = {
        getId: () => 'test-123',
        getData: () => ({}),
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

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const suggestion = {
        getId: () => 'test-no-date',
        getData: () => ({}),
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

    it('should prioritize scrapedAt from getData()', () => {
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const scrapedTime = '2025-01-20T15:30:00.000Z';
      const suggestion = {
        getId: () => 'test-scraped',
        getData: () => ({ scrapedAt: scrapedTime }),
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
      };

      const patch = testMapper.createBasePatch(suggestion, 'opp-scraped');

      expect(patch.lastUpdated).to.equal(new Date(scrapedTime).getTime());
    });

    it('should use transformRules.scrapedAt when scrapedAt is not available', () => {
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const transformScrapedTime = '2025-01-18T12:00:00.000Z';
      const suggestion = {
        getId: () => 'test-transform',
        getData: () => ({ transformRules: { scrapedAt: transformScrapedTime } }),
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
      };

      const patch = testMapper.createBasePatch(suggestion, 'opp-transform');

      expect(patch.lastUpdated).to.equal(new Date(transformScrapedTime).getTime());
    });

    it('should handle invalid date strings by using Date.now()', () => {
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const suggestion = {
        getId: () => 'test-invalid',
        getData: () => ({}),
        getUpdatedAt: () => 'invalid-date-string',
      };

      const beforeTime = Date.now();
      const patch = testMapper.createBasePatch(suggestion, 'opp-invalid');
      const afterTime = Date.now();

      // Should fallback to Date.now() for invalid dates
      expect(patch.lastUpdated).to.be.at.least(beforeTime);
      expect(patch.lastUpdated).to.be.at.most(afterTime);
    });

    it('should handle missing getData() gracefully', () => {
      class TestMapper extends BaseOpportunityMapper {
        getOpportunityType() { return 'test'; }

        requiresPrerender() { return true; }

        suggestionsToPatches() { return []; }

        canDeploy() { return { eligible: true }; }
      }

      const testMapper = new TestMapper(log);
      const suggestion = {
        getId: () => 'test-no-data',
        getData: () => null,
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
      };

      const patch = testMapper.createBasePatch(suggestion, 'opp-no-data');

      expect(patch.lastUpdated).to.equal(new Date('2025-01-15T10:00:00.000Z').getTime());
    });
  });
});
