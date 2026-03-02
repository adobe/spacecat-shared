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
import PrerenderMapper from '../../src/mappers/prerender-mapper.js';

describe('PrerenderMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new PrerenderMapper(log);
  });

  describe('getOpportunityType', () => {
    it('should return prerender', () => {
      expect(mapper.getOpportunityType()).to.equal('prerender');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('allowConfigsWithoutPatch', () => {
    it('should return true for prerender mapper', () => {
      expect(mapper.allowConfigsWithoutPatch()).to.be.true;
    });
  });

  describe('suggestionsToPatches', () => {
    it('should return empty array for prerender suggestions', () => {
      const suggestion = {
        getId: () => 'test-suggestion-id',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://example.com/page',
        }),
      };

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        'test-opportunity-id',
      );

      expect(patches).to.be.an('array');
      expect(patches).to.be.empty;
    });

    it('should return empty array even with multiple suggestions', () => {
      const suggestions = [
        {
          getId: () => 'suggestion-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page1',
          }),
        },
        {
          getId: () => 'suggestion-2',
          getUpdatedAt: () => '2025-01-15T11:00:00.000Z',
          getData: () => ({
            url: 'https://example.com/page2',
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches(
        '/page',
        suggestions,
        'test-opportunity-id',
      );

      expect(patches).to.be.an('array');
      expect(patches).to.be.empty;
    });
  });

  describe('canDeploy', () => {
    it('should return eligible for valid suggestion with URL', () => {
      const suggestion = {
        getData: () => ({
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when URL is missing', () => {
      const suggestion = {
        getData: () => ({}),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when URL is empty string', () => {
      const suggestion = {
        getData: () => ({
          url: '',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when URL is null', () => {
      const suggestion = {
        getData: () => ({
          url: null,
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when URL is undefined', () => {
      const suggestion = {
        getData: () => ({
          url: undefined,
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when data is undefined', () => {
      const suggestion = {
        getData: () => undefined,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return eligible for various valid URL formats', () => {
      const urls = [
        'https://example.com',
        'https://example.com/path',
        'https://subdomain.example.com/path/to/page',
        'https://example.com/path?query=value',
        'https://example.com/path#hash',
      ];

      urls.forEach((url) => {
        const suggestion = {
          getData: () => ({ url }),
        };

        const result = mapper.canDeploy(suggestion);

        expect(result).to.deep.equal({ eligible: true });
      });
    });
  });
});
