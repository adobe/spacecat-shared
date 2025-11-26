/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { mergePatches, removePatchesBySuggestionIds } from '../../src/utils/patch-utils.js';

describe('Patch Utils', () => {
  describe('mergePatches', () => {
    it('should merge individual patches with same key', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-123',
          value: 'old-value',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-123',
          value: 'new-value',
        },
      ];

      const result = mergePatches(existingPatches, newPatches);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0].suggestionId).to.equal('sugg-123');
      expect(result.patches[0].value).to.equal('new-value');
      expect(result.updateCount).to.equal(1);
      expect(result.addCount).to.equal(0);
    });

    it('should keep individual patches with different keys', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-1',
          value: 'value-1',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-2',
          value: 'value-2',
        },
      ];

      const result = mergePatches(existingPatches, newPatches);
      expect(result.patches).to.have.lengthOf(2);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(1);
    });

    it('should handle empty existing patches', () => {
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          suggestionId: 'sugg-new',
          value: 'new-value',
        },
      ];

      const result = mergePatches([], newPatches);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0]).to.deep.equal(newPatches[0]);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(1);
    });

    it('should handle empty new patches', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          suggestionId: 'sugg-old',
          value: 'old-value',
        },
      ];

      const result = mergePatches(existingPatches, []);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0]).to.deep.equal(existingPatches[0]);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(0);
    });

    it('should handle patch without suggestionId (heading patch)', () => {
      const existingPatches = [];
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2' },
          // No suggestionId - this is a heading patch
        },
      ];

      const result = mergePatches(existingPatches, newPatches);

      expect(result.patches).to.have.lengthOf(1);
      expect(result.addCount).to.equal(1);
    });

    it('should merge heading patches with same opportunityId', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'Old' }] },
          // No suggestionId
        },
      ];
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'New' }] },
          // No suggestionId
        },
      ];

      const result = mergePatches(existingPatches, newPatches);

      expect(result.patches).to.have.lengthOf(1);
      expect(result.updateCount).to.equal(1);
      expect(result.patches[0].value.children[0].value).to.equal('New');
    });
  });

  describe('removePatchesBySuggestionIds', () => {
    it('should remove patches with matching suggestion IDs', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-1',
                op: 'replace',
                value: 'value-1',
              },
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-2',
                op: 'replace',
                value: 'value-2',
              },
            ],
          },
          '/page2': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-3',
                op: 'replace',
                value: 'value-3',
              },
            ],
          },
        },
      };

      const result = removePatchesBySuggestionIds(config, ['sugg-1', 'sugg-3']);

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(1);
      expect(result.tokowakaOptimizations['/page1'].patches[0].suggestionId).to.equal('sugg-2');
      expect(result.tokowakaOptimizations['/page2']).to.be.undefined; // URL removed because no patches left
      expect(result.removedCount).to.equal(2);
    });

    it('should remove URL paths with no remaining patches', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-1',
                op: 'replace',
                value: 'value-1',
              },
            ],
          },
        },
      };

      const result = removePatchesBySuggestionIds(config, ['sugg-1']);

      expect(result.tokowakaOptimizations).to.deep.equal({});
      expect(result.removedCount).to.equal(1);
    });

    it('should handle empty suggestion IDs array', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-1',
                op: 'replace',
                value: 'value-1',
              },
            ],
          },
        },
      };

      const result = removePatchesBySuggestionIds(config, []);

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(1);
      expect(result.removedCount).to.equal(0);
    });

    it('should handle non-matching suggestion IDs', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-1',
                op: 'replace',
                value: 'value-1',
              },
            ],
          },
        },
      };

      const result = removePatchesBySuggestionIds(config, ['sugg-999']);

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(1);
      expect(result.removedCount).to.equal(0);
    });

    it('should handle null/undefined config gracefully', () => {
      const result1 = removePatchesBySuggestionIds(null, ['sugg-1']);
      expect(result1).to.be.null;

      const result2 = removePatchesBySuggestionIds(undefined, ['sugg-1']);
      expect(result2).to.be.undefined;
    });

    it('should preserve patches without suggestionId (heading patches)', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-1',
                // No suggestionId - heading patch
                op: 'replace',
                value: 'heading-value',
              },
              {
                opportunityId: 'opp-1',
                suggestionId: 'sugg-1',
                op: 'replace',
                value: 'value-1',
              },
            ],
          },
        },
      };

      const result = removePatchesBySuggestionIds(config, ['sugg-1']);

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(1);
      expect(result.tokowakaOptimizations['/page1'].patches[0]).to.not.have.property('suggestionId');
      expect(result.removedCount).to.equal(1);
    });

    it('should remove patches by additional patch keys', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-faq',
                // No suggestionId - FAQ heading patch
                op: 'appendChild',
                value: 'FAQs',
              },
              {
                opportunityId: 'opp-faq',
                suggestionId: 'sugg-1',
                op: 'appendChild',
                value: 'FAQ item 1',
              },
              {
                opportunityId: 'opp-faq',
                suggestionId: 'sugg-2',
                op: 'appendChild',
                value: 'FAQ item 2',
              },
            ],
          },
        },
      };

      // Remove all FAQ suggestions and the heading patch (identified by opportunityId only)
      const result = removePatchesBySuggestionIds(
        config,
        ['sugg-1', 'sugg-2'],
        ['/page1:opp-faq'], // Additional patch key for FAQ heading
      );

      expect(result.tokowakaOptimizations).to.deep.equal({});
      expect(result.removedCount).to.equal(3);
    });

    it('should remove patches by additional patch keys while keeping other suggestions', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-faq',
                // No suggestionId - FAQ heading patch
                op: 'appendChild',
                value: 'FAQs',
              },
              {
                opportunityId: 'opp-faq',
                suggestionId: 'sugg-1',
                op: 'appendChild',
                value: 'FAQ item 1',
              },
              {
                opportunityId: 'opp-faq',
                suggestionId: 'sugg-2',
                op: 'appendChild',
                value: 'FAQ item 2',
              },
            ],
          },
        },
      };

      // Remove only one FAQ suggestion, keep the heading
      const result = removePatchesBySuggestionIds(config, ['sugg-1'], []);

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(2);
      expect(result.removedCount).to.equal(1);
    });

    it('should handle both suggestionIds and additional patch keys together', () => {
      const config = {
        siteId: 'site-123',
        baseURL: 'https://example.com',
        version: '1.0',
        tokowakaOptimizations: {
          '/page1': {
            prerender: true,
            patches: [
              {
                opportunityId: 'opp-headings',
                suggestionId: 'sugg-h1',
                op: 'replace',
                value: 'Heading 1',
              },
              {
                opportunityId: 'opp-faq',
                // FAQ heading patch
                op: 'appendChild',
                value: 'FAQs',
              },
              {
                opportunityId: 'opp-faq',
                suggestionId: 'sugg-f1',
                op: 'appendChild',
                value: 'FAQ 1',
              },
            ],
          },
        },
      };

      // Remove FAQ suggestion and heading, keep heading patch
      const result = removePatchesBySuggestionIds(
        config,
        ['sugg-f1'],
        ['/page1:opp-faq'], // Remove FAQ heading
      );

      expect(result.tokowakaOptimizations['/page1'].patches).to.have.lengthOf(1);
      expect(result.tokowakaOptimizations['/page1'].patches[0].suggestionId).to.equal('sugg-h1');
      expect(result.removedCount).to.equal(2);
    });
  });
});
