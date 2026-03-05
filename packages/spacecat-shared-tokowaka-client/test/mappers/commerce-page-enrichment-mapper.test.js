/*
 * Copyright 2026 Adobe. All rights reserved.
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
import sinon from 'sinon';
import CommercePageEnrichmentMapper from '../../src/mappers/commerce-page-enrichment-mapper.js';

describe('CommercePageEnrichmentMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };
    mapper = new CommercePageEnrichmentMapper(log);
  });

  describe('getOpportunityType', () => {
    it('should return commerce-product-page-enrichment', () => {
      expect(mapper.getOpportunityType()).to.equal('commerce-product-page-enrichment');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('allowConfigsWithoutPatch', () => {
    it('should return false', () => {
      expect(mapper.allowConfigsWithoutPatch()).to.be.false;
    });
  });

  describe('canDeploy', () => {
    const validPatchValue = JSON.stringify({
      sku: 'HT5695',
      'pdp.description_plain': 'A product description.',
    });

    it('should return eligible for suggestion with patchValue and url', () => {
      const suggestion = {
        getData: () => ({
          patchValue: validPatchValue,
          url: 'https://www.lovesac.com/products/seat-cover-set',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({ eligible: true });
    });

    it('should return eligible when transformRules is absent', () => {
      const suggestion = {
        getData: () => ({
          patchValue: validPatchValue,
          url: 'https://www.lovesac.com/products/seat-cover-set',
          format: 'json',
          tag: 'div',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({ eligible: true });
    });

    it('should return eligible when transformRules is null', () => {
      const suggestion = {
        getData: () => ({
          patchValue: validPatchValue,
          url: 'https://www.lovesac.com/products/seat-cover-set',
          transformRules: null,
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when patchValue is missing', () => {
      const suggestion = {
        getData: () => ({
          url: 'https://example.com/page',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });

    it('should return ineligible when patchValue is empty string', () => {
      const suggestion = {
        getData: () => ({
          patchValue: '',
          url: 'https://example.com/page',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });

    it('should return ineligible when url is missing', () => {
      const suggestion = {
        getData: () => ({
          patchValue: validPatchValue,
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when url is empty string', () => {
      const suggestion = {
        getData: () => ({
          patchValue: validPatchValue,
          url: '',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when patchValue is not valid JSON', () => {
      const suggestion = {
        getData: () => ({
          patchValue: 'not valid json {{{',
          url: 'https://example.com/page',
        }),
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'patchValue must be valid JSON',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });

    it('should return ineligible when data is undefined', () => {
      const suggestion = {
        getData: () => undefined,
      };

      expect(mapper.canDeploy(suggestion)).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });
  });

  describe('suggestionsToPatches', () => {
    const opportunityId = '03189e92-ac0f-4436-965a-0a7b55fc4101';
    const suggestionId = '2fec9113-98e8-40b4-90e0-10aa9ce45abc';
    const updatedAt = '2026-02-17T09:48:58.974Z';

    function makeSuggestion(data, id = suggestionId) {
      return {
        getId: () => id,
        getUpdatedAt: () => updatedAt,
        getData: () => data,
      };
    }

    it('should produce a JSON-LD patch appended to head', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'HT5695',
          name: 'Seat Cover Set',
          brand: 'Lovesac',
          'pdp.description_plain': 'A great product.',
        }),
        url: 'https://www.lovesac.com/products/seat-cover-set',
      });

      const patches = mapper.suggestionsToPatches(
        '/products/seat-cover-set',
        [suggestion],
        opportunityId,
      );

      expect(patches).to.have.length(1);
      const patch = patches[0];

      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('head');
      expect(patch.valueFormat).to.equal('json');
      expect(patch.target).to.equal('ai-bots');
      expect(patch.tag).to.equal('script');
      expect(patch.attrs).to.deep.equal({ type: 'application/ld+json' });
      expect(patch.opportunityId).to.equal(opportunityId);
      expect(patch.suggestionId).to.equal(suggestionId);
      expect(patch.prerenderRequired).to.be.true;
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should transform enrichment data to schema.org Product JSON-LD', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'HT5695',
          name: 'Seat Cover Set',
          brand: 'Lovesac',
          'pdp.description_plain': 'A great product.',
          material: '100% polyester chenille',
          'facts.facets.category_path': ['Home', 'Sactionals', 'Covers'],
          color_family: 'Blue',
        }),
        url: 'https://www.lovesac.com/products/seat-cover-set',
      });

      const patches = mapper.suggestionsToPatches(
        '/products/seat-cover-set',
        [suggestion],
        opportunityId,
      );

      const { value } = patches[0];
      expect(value['@context']).to.equal('https://schema.org');
      expect(value['@type']).to.equal('Product');
      expect(value.sku).to.equal('HT5695');
      expect(value.name).to.equal('Seat Cover Set');
      expect(value.brand).to.deep.equal({ '@type': 'Brand', name: 'Lovesac' });
      expect(value.description).to.equal('A great product.');
      expect(value.material).to.equal('100% polyester chenille');
      expect(value.category).to.equal('Home > Sactionals > Covers');
      expect(value.additionalProperty).to.deep.equal([
        { '@type': 'PropertyValue', name: 'color_family', value: 'Blue' },
      ]);
      // Enrichment field names should not leak through
      expect(value['pdp.description_plain']).to.be.undefined;
      expect(value['facts.facets.category_path']).to.be.undefined;
    });

    it('should handle minimal enrichment data (only sku)', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({ sku: 'MINIMAL' }),
        url: 'https://example.com/products/minimal',
      });

      const patches = mapper.suggestionsToPatches(
        '/products/minimal',
        [suggestion],
        opportunityId,
      );

      expect(patches).to.have.length(1);
      expect(patches[0].value).to.deep.equal({
        '@context': 'https://schema.org',
        '@type': 'Product',
        sku: 'MINIMAL',
      });
    });

    it('should map all enrichment fields to schema.org Product structure', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: '4Seats5Sides',
          name: '4 Seats + 5 Sides Sactional',
          category: 'Sectional / Modular Sofa',
          brand: 'Lovesac',
          'pdp.description_plain': 'A modular sofa configuration.',
          'pdp.feature_bullets': ['Includes 4 Seats', 'StealthTech eligible'],
          'facts.facets.category_path': ['Furniture', 'Sectionals', 'Sactionals'],
          'facts.variants.summary': ['Multiple fabric options'],
          material: 'Corded Velvet',
          dimensions_or_capacity: '35" W x 29" D',
          care_instructions: ['Machine washable'],
          color_family: 'Grey',
          audience_tags: ['homeowners'],
          use_context: ['living room'],
          style_tags: ['modern'],
          keyword_synonyms: ['modular couch'],
          persona_phrases: ['for families'],
        }),
        url: 'https://www.lovesac.com/products/4-seats-5-sides',
      });

      const patches = mapper.suggestionsToPatches(
        '/products/4-seats-5-sides',
        [suggestion],
        opportunityId,
      );

      expect(patches).to.have.length(1);
      const { value } = patches[0];

      // schema.org envelope
      expect(value['@context']).to.equal('https://schema.org');
      expect(value['@type']).to.equal('Product');

      // Top-level mapped fields
      expect(value.sku).to.equal('4Seats5Sides');
      expect(value.name).to.equal('4 Seats + 5 Sides Sactional');
      // 'category' takes priority over 'facts.facets.category_path'
      expect(value.category).to.equal('Sectional / Modular Sofa');
      expect(value.brand).to.deep.equal({ '@type': 'Brand', name: 'Lovesac' });
      expect(value.description).to.equal('A modular sofa configuration.');
      expect(value.material).to.equal('Corded Velvet');

      // Remaining fields become additionalProperty
      expect(value.additionalProperty).to.deep.equal([
        { '@type': 'PropertyValue', name: 'pdp.feature_bullets', value: ['Includes 4 Seats', 'StealthTech eligible'] },
        { '@type': 'PropertyValue', name: 'facts.facets.category_path', value: ['Furniture', 'Sectionals', 'Sactionals'] },
        { '@type': 'PropertyValue', name: 'facts.variants.summary', value: ['Multiple fabric options'] },
        { '@type': 'PropertyValue', name: 'dimensions_or_capacity', value: '35" W x 29" D' },
        { '@type': 'PropertyValue', name: 'care_instructions', value: ['Machine washable'] },
        { '@type': 'PropertyValue', name: 'color_family', value: 'Grey' },
        { '@type': 'PropertyValue', name: 'audience_tags', value: ['homeowners'] },
        { '@type': 'PropertyValue', name: 'use_context', value: ['living room'] },
        { '@type': 'PropertyValue', name: 'style_tags', value: ['modern'] },
        { '@type': 'PropertyValue', name: 'keyword_synonyms', value: ['modular couch'] },
        { '@type': 'PropertyValue', name: 'persona_phrases', value: ['for families'] },
      ]);

      // Enrichment field names should not leak
      expect(value['pdp.description_plain']).to.be.undefined;
    });

    it('should skip ineligible suggestions and log warning', () => {
      const eligible = makeSuggestion({
        patchValue: JSON.stringify({ sku: 'GOOD' }),
        url: 'https://example.com/good',
      }, 'good-id');

      const ineligible = makeSuggestion({
        patchValue: '',
        url: 'https://example.com/bad',
      }, 'bad-id');

      const patches = mapper.suggestionsToPatches(
        '/test',
        [eligible, ineligible],
        opportunityId,
      );

      expect(patches).to.have.length(1);
      expect(patches[0].suggestionId).to.equal('good-id');
      expect(log.warn.calledOnce).to.be.true;
    });

    it('should produce multiple patches for multiple suggestions', () => {
      const s1 = makeSuggestion({
        patchValue: JSON.stringify({ sku: 'SKU1' }),
        url: 'https://example.com/page',
      }, 'id-1');

      const s2 = makeSuggestion({
        patchValue: JSON.stringify({ sku: 'SKU2' }),
        url: 'https://example.com/page',
      }, 'id-2');

      const patches = mapper.suggestionsToPatches(
        '/page',
        [s1, s2],
        opportunityId,
      );

      expect(patches).to.have.length(2);
      expect(patches[0].suggestionId).to.equal('id-1');
      expect(patches[1].suggestionId).to.equal('id-2');
    });

    it('should exclude rationale field from output', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'HT5695',
          rationale: 'This should not appear in output',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.rationale).to.be.undefined;
      expect(patches[0].value.sku).to.equal('HT5695');
      expect(patches[0].value['@context']).to.equal('https://schema.org');
    });

    it('should exclude null values from output', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          name: null,
          brand: 'Lovesac',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      const { value } = patches[0];
      expect(value['@context']).to.equal('https://schema.org');
      expect(value['@type']).to.equal('Product');
      expect(value.sku).to.equal('TEST');
      expect(value.name).to.be.undefined;
      expect(value.brand).to.deep.equal({ '@type': 'Brand', name: 'Lovesac' });
    });

    it('should use category string when provided directly', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          category: 'Furniture > Sofas',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.category).to.equal('Furniture > Sofas');
    });

    it('should join category_path array with " > "', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          'facts.facets.category_path': ['Home', 'Sactionals', 'Covers'],
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.category).to.equal('Home > Sactionals > Covers');
    });

    it('should prefer category over facts.facets.category_path', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          category: 'Direct Category',
          'facts.facets.category_path': ['Should', 'Not', 'Appear'],
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.category).to.equal('Direct Category');
      // category_path goes to additionalProperty since category took precedence
      expect(patches[0].value.additionalProperty).to.deep.include({
        '@type': 'PropertyValue',
        name: 'facts.facets.category_path',
        value: ['Should', 'Not', 'Appear'],
      });
    });

    it('should pass through brand objects as-is', () => {
      const brandObj = { '@type': 'Brand', name: 'Adobe', url: 'https://adobe.com' };
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          brand: brandObj,
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.brand).to.deep.equal(brandObj);
    });

    it('should map variants.color and variants.size to top-level', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          'variants.color': 'Navy Blue',
          'variants.size': 'XL',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      expect(patches[0].value.color).to.equal('Navy Blue');
      expect(patches[0].value.size).to.equal('XL');
      expect(patches[0].value['variants.color']).to.be.undefined;
      expect(patches[0].value['variants.size']).to.be.undefined;
    });
  });
});
