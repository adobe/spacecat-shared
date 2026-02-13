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
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import SemanticValueVisibilityMapper from '../../src/mappers/semantic-value-visibility-mapper.js';

const filename = fileURLToPath(import.meta.url);
const fixturesPath = join(dirname(filename), '../fixtures/semantic-value-visibility');

// Load real Mystique response fixtures
// Carahsoft proves the logic is correct, others prove it doesn't crash with different real inputs.
const carahsoftFixture = JSON.parse(readFileSync(join(fixturesPath, 'Carahsoft.json'), 'utf8'));
const koffievoordeeelFixture = JSON.parse(readFileSync(join(fixturesPath, 'Koffievoordeel.json'), 'utf8'));
const krisshopFixture = JSON.parse(readFileSync(join(fixturesPath, 'Krisshop.json'), 'utf8'));
const veserisFixture = JSON.parse(readFileSync(join(fixturesPath, 'Veseris.json'), 'utf8'));
const vuseFixture = JSON.parse(readFileSync(join(fixturesPath, 'Vuse.json'), 'utf8'));

describe('SemanticValueVisibilityMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new SemanticValueVisibilityMapper(log);
  });

  describe('getOpportunityType', () => {
    it('should return semantic-value-visibility', () => {
      expect(mapper.getOpportunityType()).to.equal('semantic-value-visibility');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('canDeploy', () => {
    it('should return eligible for valid suggestion', () => {
      const suggestion = {
        getData: () => ({
          semanticHtml: '<section><h2>Test</h2></section>',
          transformRules: {
            action: 'insertAfter',
            selector: 'img[src="https://example.com/image.jpg"]',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when semanticHtml is missing', () => {
      const suggestion = {
        getData: () => ({
          transformRules: {
            action: 'insertAfter',
            selector: 'img[src="https://example.com/image.jpg"]',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({
        eligible: false,
        reason: 'semanticHtml is required',
      });
    });

    it('should return ineligible when transformRules is missing', () => {
      const suggestion = {
        getData: () => ({
          semanticHtml: '<section><h2>Test</h2></section>',
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules is required',
      });
    });

    it('should return ineligible when selector is missing', () => {
      const suggestion = {
        getData: () => ({
          semanticHtml: '<section><h2>Test</h2></section>',
          transformRules: {
            action: 'insertAfter',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.selector is required',
      });
    });

    it('should return ineligible when action is invalid', () => {
      const suggestion = {
        getData: () => ({
          semanticHtml: '<section><h2>Test</h2></section>',
          transformRules: {
            action: 'replace',
            selector: 'img[src="https://example.com/image.jpg"]',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.action must be insertAfter, insertBefore, or appendChild',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({
        eligible: false,
        reason: 'semanticHtml is required',
      });
    });
  });

  describe('suggestionsToPatches - with Carahsoft fixture', () => {
    it('should convert Carahsoft suggestions to patches', () => {
      // Create suggestion mocks from fixture data
      const suggestions = carahsoftFixture.suggestions.map((s, index) => ({
        getId: () => `sugg-carahsoft-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-carahsoft');

      expect(patches.length).to.equal(carahsoftFixture.suggestions.length);

      // Verify first patch structure
      const firstPatch = patches[0];
      expect(firstPatch.op).to.equal('insertAfter');
      expect(firstPatch.selector).to.include('img[src=');
      expect(firstPatch.valueFormat).to.equal('hast');
      expect(firstPatch.target).to.equal('ai-bots');
      expect(firstPatch.prerenderRequired).to.be.true;
      expect(firstPatch.opportunityId).to.equal('opp-carahsoft');
      expect(firstPatch.suggestionId).to.equal('sugg-carahsoft-0');
      expect(firstPatch.lastUpdated).to.be.a('number');

      // Verify HAST structure
      expect(firstPatch.value).to.be.an('object');
      expect(firstPatch.value.type).to.equal('root');
      expect(firstPatch.value.children).to.be.an('array');
    });

    it('should preserve data-llm attributes in HAST', () => {
      const suggestions = carahsoftFixture.suggestions.slice(0, 1).map((s, index) => ({
        getId: () => `sugg-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-1');
      const section = patches[0].value.children.find((c) => c.tagName === 'section');

      expect(section.properties.dataLlmContext).to.equal('image');
      expect(section.properties.dataLlmShadow).to.equal('image-text');
    });
  });

  describe('suggestionsToPatches - with Koffievoordeel fixture', () => {
    it('should convert Koffievoordeel suggestions to patches', () => {
      const suggestions = koffievoordeeelFixture.suggestions.map((s, index) => ({
        getId: () => `sugg-koffie-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-koffie');

      expect(patches.length).to.equal(koffievoordeeelFixture.suggestions.length);

      // Verify all patches have required fields
      patches.forEach((patch, index) => {
        expect(patch.op).to.equal('insertAfter');
        expect(patch.selector).to.be.a('string');
        expect(patch.valueFormat).to.equal('hast');
        expect(patch.target).to.equal('ai-bots');
        expect(patch.suggestionId).to.equal(`sugg-koffie-${index}`);
      });
    });
  });

  describe('suggestionsToPatches - with Krisshop fixture', () => {
    it('should convert Krisshop suggestions to patches', () => {
      const suggestions = krisshopFixture.suggestions.map((s, index) => ({
        getId: () => `sugg-krisshop-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-krisshop');

      expect(patches.length).to.equal(krisshopFixture.suggestions.length);

      patches.forEach((patch, index) => {
        expect(patch.op).to.equal('insertAfter');
        expect(patch.selector).to.be.a('string');
        expect(patch.valueFormat).to.equal('hast');
        expect(patch.target).to.equal('ai-bots');
        expect(patch.suggestionId).to.equal(`sugg-krisshop-${index}`);
      });
    });
  });

  describe('suggestionsToPatches - with Veseris fixture', () => {
    it('should convert Veseris suggestions to patches', () => {
      const suggestions = veserisFixture.suggestions.map((s, index) => ({
        getId: () => `sugg-veseris-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-veseris');

      expect(patches.length).to.equal(veserisFixture.suggestions.length);

      patches.forEach((patch, index) => {
        expect(patch.op).to.equal('insertAfter');
        expect(patch.selector).to.be.a('string');
        expect(patch.valueFormat).to.equal('hast');
        expect(patch.target).to.equal('ai-bots');
        expect(patch.suggestionId).to.equal(`sugg-veseris-${index}`);
      });
    });
  });

  describe('suggestionsToPatches - with Vuse fixture', () => {
    it('should convert Vuse suggestions to patches', () => {
      const suggestions = vuseFixture.suggestions.map((s, index) => ({
        getId: () => `sugg-vuse-${index}`,
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => s.data,
      }));

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-vuse');

      expect(patches.length).to.equal(vuseFixture.suggestions.length);

      patches.forEach((patch, index) => {
        expect(patch.op).to.equal('insertAfter');
        expect(patch.selector).to.be.a('string');
        expect(patch.valueFormat).to.equal('hast');
        expect(patch.target).to.equal('ai-bots');
        expect(patch.suggestionId).to.equal(`sugg-vuse-${index}`);
      });
    });
  });

  describe('suggestionsToPatches - edge cases', () => {
    it('should return empty array for invalid suggestions', () => {
      const suggestions = [{
        getId: () => 'sugg-invalid',
        getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
        getData: () => ({
          // Missing semanticHtml
          transformRules: {
            action: 'insertAfter',
            selector: 'img',
          },
        }),
      }];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-1');
      expect(patches.length).to.equal(0);
    });

    it('should skip invalid suggestions but process valid ones', () => {
      const suggestions = [
        {
          getId: () => 'sugg-invalid',
          getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
          getData: () => ({ transformRules: { action: 'insertAfter', selector: 'img' } }),
        },
        {
          getId: () => 'sugg-valid',
          getUpdatedAt: () => '2025-02-13T10:00:00.000Z',
          getData: () => ({
            semanticHtml: '<section><h2>Valid</h2></section>',
            transformRules: { action: 'insertAfter', selector: 'img[src="test.jpg"]' },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-1');
      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionId).to.equal('sugg-valid');
    });

    it('should handle empty suggestions array', () => {
      const patches = mapper.suggestionsToPatches('/page', [], 'opp-1');
      expect(patches.length).to.equal(0);
    });
  });
});
