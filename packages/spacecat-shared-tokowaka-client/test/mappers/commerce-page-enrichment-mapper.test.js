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

/**
 * Recursively finds the first HAST element node matching a predicate.
 */
function findNode(node, predicate) {
  if (predicate(node)) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Collects all HAST element nodes matching a predicate.
 */
function findAllNodes(node, predicate) {
  const results = [];
  if (predicate(node)) results.push(node);
  if (node.children) {
    for (const child of node.children) {
      results.push(...findAllNodes(child, predicate));
    }
  }
  return results;
}

/**
 * Extracts concatenated text content from a HAST subtree.
 */
function textContent(node) {
  if (node.type === 'text') return node.value;
  if (node.children) return node.children.map(textContent).join('');
  return '';
}

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

    it('should produce a HAST patch appended to body', () => {
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
      expect(patch.selector).to.equal('body');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.target).to.equal('ai-bots');
      expect(patch.opportunityId).to.equal(opportunityId);
      expect(patch.suggestionId).to.equal(suggestionId);
      expect(patch.prerenderRequired).to.be.true;
      expect(patch.lastUpdated).to.be.a('number');

      // HAST root
      expect(patch.value).to.be.an('object');
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
    });

    it('should produce HAST with correct wrapper and article structure', () => {
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

      const { value } = patches[0];

      // Outer div with data-enrichment="spacecat" and data-sku
      const wrapper = findNode(value, (n) => n.tagName === 'div'
        && n.properties?.dataEnrichment === 'spacecat');
      expect(wrapper).to.exist;
      expect(wrapper.properties.dataSku).to.equal('HT5695');

      // Article inside the wrapper
      const article = findNode(wrapper, (n) => n.tagName === 'article');
      expect(article).to.exist;
    });

    it('should render enrichment fields as semantic HTML elements', () => {
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
      const article = findNode(value, (n) => n.tagName === 'article');
      expect(article).to.exist;

      // String fields → <p> elements
      const paragraphs = findAllNodes(article, (n) => n.tagName === 'p');
      expect(paragraphs.length).to.be.greaterThan(0);

      // Category path → rendered with › separator
      const categoryP = paragraphs.find((p) => p.properties?.className?.includes('category'));
      expect(categoryP).to.exist;
      expect(textContent(categoryP)).to.include('›');

      // Description → <p class="description">
      const descP = paragraphs.find((p) => p.properties?.className?.includes('description'));
      expect(descP).to.exist;
      expect(textContent(descP)).to.equal('A great product.');
    });

    it('should render array fields as unordered lists', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'HT5695',
          'pdp.feature_bullets': ['Includes 4 Seats', 'StealthTech eligible'],
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const { value } = patches[0];

      const ul = findNode(value, (n) => n.tagName === 'ul'
        && n.properties?.className?.includes('features'));
      expect(ul).to.exist;

      const lis = ul.children.filter((c) => c.tagName === 'li');
      expect(lis).to.have.length(2);
      expect(textContent(lis[0])).to.equal('Includes 4 Seats');
      expect(textContent(lis[1])).to.equal('StealthTech eligible');
    });

    it('should render object fields as lists of key-value entries', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'HT5695',
          variants: { color: 'Blue', size: 'Large' },
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const { value } = patches[0];

      const ul = findNode(value, (n) => n.tagName === 'ul'
        && n.properties?.className?.includes('variants'));
      expect(ul).to.exist;

      const lis = ul.children.filter((c) => c.tagName === 'li');
      expect(lis).to.have.length(2);
      expect(textContent(lis[0])).to.include('color');
      expect(textContent(lis[0])).to.include('Blue');
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
      const { value } = patches[0];
      expect(value.type).to.equal('root');

      const wrapper = findNode(value, (n) => n.tagName === 'div'
        && n.properties?.dataEnrichment === 'spacecat');
      expect(wrapper).to.exist;
      expect(wrapper.properties.dataSku).to.equal('MINIMAL');
    });

    it('should render all enrichment field types correctly', () => {
      const enrichment = {
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
      };

      const suggestion = makeSuggestion({
        patchValue: JSON.stringify(enrichment),
        url: 'https://www.lovesac.com/products/4-seats-5-sides',
      });

      const patches = mapper.suggestionsToPatches(
        '/products/4-seats-5-sides',
        [suggestion],
        opportunityId,
      );

      expect(patches).to.have.length(1);
      const { value } = patches[0];
      const article = findNode(value, (n) => n.tagName === 'article');
      expect(article).to.exist;

      // Ordered fields rendered: category_path used (not category), description, features, variants
      const allText = textContent(article);
      expect(allText).to.include('Furniture');
      expect(allText).to.include('›');
      expect(allText).to.include('A modular sofa configuration.');
      expect(allText).to.include('Includes 4 Seats');
      expect(allText).to.include('Multiple fabric options');

      // Remaining fields rendered
      expect(allText).to.include('4 Seats + 5 Sides Sactional');
      expect(allText).to.include('Lovesac');
      expect(allText).to.include('Corded Velvet');
      expect(allText).to.include('Grey');
      expect(allText).to.include('homeowners');
      expect(allText).to.include('modular couch');
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
          brand: 'Lovesac',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches(
        '/page',
        [suggestion],
        opportunityId,
      );

      const allText = textContent(patches[0].value);
      expect(allText).to.not.include('This should not appear in output');
      expect(allText).to.include('Lovesac');
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

      const allText = textContent(patches[0].value);
      expect(allText).to.include('Lovesac');
      // null name should not produce any element
      const article = findNode(patches[0].value, (n) => n.tagName === 'article');
      const nameP = findAllNodes(article, (n) => n.tagName === 'p'
        && n.properties?.className?.includes('name'));
      expect(nameP).to.have.length(0);
    });

    it('should render string category as plain text with › not needed', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          category: 'Electronics',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const article = findNode(patches[0].value, (n) => n.tagName === 'article');
      const categoryP = findNode(article, (n) => n.tagName === 'p'
        && n.properties?.className?.includes('category'));
      expect(categoryP).to.exist;
      expect(textContent(categoryP)).to.equal('Electronics');
    });

    it('should skip empty arrays and empty objects', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          'pdp.feature_bullets': [],
          variants: {},
          brand: 'TestBrand',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const article = findNode(patches[0].value, (n) => n.tagName === 'article');
      const allText = textContent(article);
      expect(allText).to.include('TestBrand');

      // Empty array and empty object should not produce elements
      const featureUl = findNode(article, (n) => n.tagName === 'ul'
        && n.properties?.className?.includes('features'));
      expect(featureUl).to.not.exist;
    });

    it('should skip empty string values', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          name: '',
          brand: 'Visible',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const article = findNode(patches[0].value, (n) => n.tagName === 'article');
      const allText = textContent(article);
      expect(allText).to.include('Visible');

      const nameP = findAllNodes(article, (n) => n.tagName === 'p'
        && n.properties?.className?.includes('name'));
      expect(nameP).to.have.length(0);
    });

    it('should filter null and empty entries from object values', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          variants: { color: 'Blue', size: null, weight: '' },
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const ul = findNode(patches[0].value, (n) => n.tagName === 'ul'
        && n.properties?.className?.includes('variants'));
      expect(ul).to.exist;
      const lis = ul.children.filter((c) => c.tagName === 'li');
      expect(lis).to.have.length(1);
      expect(textContent(lis[0])).to.include('Blue');
    });

    it('should produce empty article when object has only null entries', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          variants: { color: null, size: '' },
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const ul = findNode(patches[0].value, (n) => n.tagName === 'ul'
        && n.properties?.className?.includes('variants'));
      expect(ul).to.not.exist;
    });

    it('should handle enrichment with no sku', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          brand: 'NoBrand',
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const wrapper = findNode(patches[0].value, (n) => n.tagName === 'div'
        && n.properties?.dataEnrichment === 'spacecat');
      expect(wrapper).to.exist;
      expect(wrapper.properties.dataSku).to.be.undefined;
    });

    it('should use ordered fields priority (category_path over category)', () => {
      const suggestion = makeSuggestion({
        patchValue: JSON.stringify({
          sku: 'TEST',
          category: 'Simple Category',
          'facts.facets.category_path': ['Home', 'Furniture'],
        }),
        url: 'https://example.com/page',
      });

      const patches = mapper.suggestionsToPatches('/page', [suggestion], opportunityId);
      const { value } = patches[0];
      const article = findNode(value, (n) => n.tagName === 'article');

      // category_path should be used (has priority), not the flat category
      const categoryP = findNode(article, (n) => n.tagName === 'p'
        && n.properties?.className?.includes('category'));
      expect(categoryP).to.exist;
      expect(textContent(categoryP)).to.include('Home');
      expect(textContent(categoryP)).to.include('›');

      // Flat 'category' should NOT appear since category_path was consumed
      const allText = textContent(article);
      expect(allText).to.not.include('Simple Category');
    });
  });
});
