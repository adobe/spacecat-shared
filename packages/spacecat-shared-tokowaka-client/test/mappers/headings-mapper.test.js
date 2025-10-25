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
import HeadingsMapper from '../../src/mappers/headings-mapper.js';

describe('HeadingsMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new HeadingsMapper();
  });

  describe('getOpportunityType', () => {
    it('should return headings', () => {
      expect(mapper.getOpportunityType()).to.equal('headings');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('canDeploy', () => {
    it('should return eligible for heading-empty checkType', () => {
      const suggestion = {
        getData: () => ({ checkType: 'heading-empty' }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible for heading-missing checkType', () => {
      const suggestion = {
        getData: () => ({ checkType: 'heading-missing' }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only empty headings can be deployed. This suggestion has checkType: heading-missing',
      });
    });

    it('should return ineligible for unknown checkType', () => {
      const suggestion = {
        getData: () => ({ checkType: 'unknown-type' }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only empty headings can be deployed. This suggestion has checkType: unknown-type',
      });
    });

    it('should return ineligible when checkType is missing', () => {
      const suggestion = {
        getData: () => ({}),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only empty headings can be deployed. This suggestion has checkType: undefined',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only empty headings can be deployed. This suggestion has checkType: undefined',
      });
    });
  });

  describe('suggestionToPatch', () => {
    it('should create patch with headingTag selector', () => {
      const suggestion = {
        getId: () => 'sugg-123',
        getData: () => ({
          headingTag: 'h1',
          recommendedAction: 'New Heading',
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-123');

      expect(patch).to.deep.include({
        op: 'replace',
        selector: 'h1',
        value: 'New Heading',
        opportunityId: 'opp-123',
        suggestionId: 'sugg-123',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should create patch with path selector when headingTag is missing', () => {
      const suggestion = {
        getId: () => 'sugg-123',
        getData: () => ({
          path: 'body > h1',
          recommendedAction: 'New Heading',
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-123');

      expect(patch).to.deep.include({
        op: 'replace',
        selector: 'body > h1',
        value: 'New Heading',
        opportunityId: 'opp-123',
        suggestionId: 'sugg-123',
        prerenderRequired: true,
      });
    });
  });

  describe('validateSuggestionData', () => {
    it('should return true for valid data with headingTag', () => {
      const data = {
        headingTag: 'h1',
        recommendedAction: 'New Heading',
      };

      expect(mapper.validateSuggestionData(data)).to.be.true;
    });

    it('should return true for valid data with path', () => {
      const data = {
        path: 'body > h1',
        recommendedAction: 'New Heading',
      };

      expect(mapper.validateSuggestionData(data)).to.be.true;
    });

    it('should return false if both headingTag and path are missing', () => {
      const data = {
        recommendedAction: 'New Heading',
      };

      expect(mapper.validateSuggestionData(data)).to.be.false;
    });

    it('should return false if recommendedAction is missing', () => {
      const data = {
        headingTag: 'h1',
      };

      expect(mapper.validateSuggestionData(data)).to.be.false;
    });

    it('should return false if data is empty', () => {
      expect(mapper.validateSuggestionData({})).to.be.false;
    });

    it('should return false if data is null', () => {
      expect(mapper.validateSuggestionData(null)).to.be.false;
    });
  });
});
