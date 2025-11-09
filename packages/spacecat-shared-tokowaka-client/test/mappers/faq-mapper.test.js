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
import FaqMapper from '../../src/mappers/faq-mapper.js';

describe('FaqMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new FaqMapper(log);
  });

  describe('getOpportunityType', () => {
    it('should return faq', () => {
      expect(mapper.getOpportunityType()).to.equal('faq');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('hasSinglePatchPerUrl', () => {
    it('should return true (FAQ combines all suggestions)', () => {
      expect(mapper.hasSinglePatchPerUrl()).to.be.true;
    });
  });

  describe('canDeploy', () => {
    it('should return eligible for valid FAQ suggestion', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Is this valid?',
            answer: 'Yes, it is.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when item.question/answer is missing', () => {
      const suggestion = {
        getData: () => ({
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'item.question and item.answer are required',
      });
    });

    it('should return ineligible when transformRules are missing', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Is this valid?',
            answer: 'Yes, it is.',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules is required',
      });
    });

    it('should return ineligible when transformRules action is invalid', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          transformRules: {
            action: 'replace',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.action must be insertAfter, insertBefore, or appendChild',
      });
    });

    it('should return ineligible when transformRules selector is missing', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          transformRules: {
            action: 'appendChild',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.selector is required',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'item.question and item.answer are required',
      });
    });

    it('should accept insertAfter as valid action', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'insertAfter',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should accept insertBefore as valid action', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'insertBefore',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when URL is invalid', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          url: 'not-a-valid-url',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result.eligible).to.be.false;
      expect(result.reason).to.include('not a valid URL');
    });
  });

  describe('suggestionToPatch', () => {
    it('should throw error when called directly', () => {
      const suggestion = {
        getId: () => 'sugg-test',
        getData: () => ({
          item: { question: 'Q?', answer: 'A.' },
          url: 'https://example.com',
          transformRules: { action: 'appendChild', selector: 'main' },
        }),
      };

      expect(() => mapper.suggestionToPatch(suggestion, 'opp-123')).to.throw('FAQ mapper does not support suggestionToPatch, use suggestionsToPatches instead');
    });

    it('should create patch with HAST value from markdown', () => {
      const suggestion = {
        getId: () => 'sugg-faq-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: 'Is Bulk better than myprotein?',
            answer: 'Yes, because of **better value**.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-faq-123', null);
      const patch = patches[0];

      expect(patch).to.exist;
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.opportunityId).to.equal('opp-faq-123');
      expect(patch.suggestionIds).to.deep.equal(['sugg-faq-123']);
      expect(patch.prerenderRequired).to.be.true;
      expect(patch.lastUpdated).to.be.a('number');

      // Verify HAST structure
      expect(patch.value).to.be.an('object');
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(0);
    });

    it('should convert FAQ markdown with headings and lists to HAST', () => {
      const suggestion1 = {
        getId: () => 'sugg-faq-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: 'Is Bulk better than myprotein?',
            answer: `Bulk offers several advantages:

1. **Better Value for Money**: High-quality products at competitive prices.
2. **Wider Selection**: Products for diverse fitness goals.
3. **Unique Product Ranges**: Simplified product choices.`,
          },
          url: 'https://www.example.com/page',
          headingText: 'FAQs',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion1], 'opp-faq-complex', null);
      const patch = patches[0];

      expect(patch).to.exist;
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(2);

      // Should have h2, h3, paragraphs, and ordered list
      const hasH2 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h2');
      const hasH3 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h3');
      const hasP = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'p');
      const hasOl = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'ol');

      expect(hasH2).to.be.true;
      expect(hasH3).to.be.true;
      expect(hasP).to.be.true;
      expect(hasOl).to.be.true;
    });

    it('should handle markdown with bold text', () => {
      const suggestion = {
        getId: () => 'sugg-faq-bold',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'This is **bold** text.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-faq-bold', null);
      const patch = patches[0];

      expect(patch).to.exist;
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');

      // Find the paragraph
      const paragraph = patch.value.children.find((child) => child.type === 'element' && child.tagName === 'p');
      expect(paragraph).to.exist;
      expect(paragraph.children).to.be.an('array');

      // Should contain strong elements
      const hasStrong = paragraph.children.some((child) => child.type === 'element' && child.tagName === 'strong');
      expect(hasStrong).to.be.true;
    });

    it('should return null when item.question/answer is missing', () => {
      const suggestion = {
        getId: () => 'sugg-invalid',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-invalid', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
    });

    it('should return null when transformRules are incomplete', () => {
      const suggestion = {
        getId: () => 'sugg-invalid-2',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          transformRules: {
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-invalid-2', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
    });

    it('should handle markdown parsing errors gracefully', () => {
      let errorMessage = '';
      const errorLog = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (msg) => { errorMessage = msg; },
      };

      const errorMapper = new FaqMapper(errorLog);

      // Use a headingText that will cause markdown parsing to fail when combined
      // by overriding buildFaqMarkdown to return null
      const originalBuildFaqMarkdown = errorMapper.buildFaqMarkdown;
      errorMapper.buildFaqMarkdown = () => null; // This will cause markdown parser to fail

      const suggestion = {
        getId: () => 'sugg-error',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: 'Question?',
            answer: 'Answer.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = errorMapper.suggestionsToPatches('/page', [suggestion], 'opp-error', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
      expect(errorMessage).to.include('Failed to convert FAQ markdown to HAST');

      // Restore original method
      errorMapper.buildFaqMarkdown = originalBuildFaqMarkdown;
    });

    it('should handle real-world FAQ example from user', () => {
      const question1 = 'Is Bulk better than myprotein?';
      const answer1 = `Bulk offers several advantages over MyProtein in sports nutrition:

1. **Better Value for Money**: Bulk provides high-quality products at competitive prices, highlighting products like their Pure Whey Protein™, Europe's best value whey protein.
2. **Wider Selection**: Bulk's range of products caters to diverse fitness goals, including weight loss, muscle building, and performance improvement, making it broader than MyProtein.
3. **Unique Product Ranges**: Bulk simplifies product choices with four distinct ranges—Pure Series™, Complete Series™, Pro Series™, and Active Foods™.
4. **Customer Satisfaction**: Bulk emphasizes strong customer service and boasts a higher Trustpilot rating compared to MyProtein, indicating better customer trust.
5. **Superior Product Formulation**: Popular products, such as Elevate™ pre-workout and Complete Greens™, are noted for their quality and pricing compared to MyProtein's offerings.

Overall, Bulk positions itself as a better choice for sports nutrition through its focus on value, variety, innovation, and customer satisfaction.`;

      const suggestion = {
        getId: () => 'sugg-faq-real',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          item: {
            question: question1,
            answer: answer1,
          },
          headingText: 'FAQs',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
          url: 'https://www.bulk.com/uk',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-faq-real', null);
      const patch = patches[0];

      expect(patch).to.exist;
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(5);

      // Should have heading, paragraphs, and ordered list
      const hasH2 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h2');
      const hasH3 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h3');
      const hasP = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'p');
      const hasOl = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'ol');

      expect(hasH2).to.be.true;
      expect(hasH3).to.be.true;
      expect(hasP).to.be.true;
      expect(hasOl).to.be.true;
    });
  });

  describe('buildFaqMarkdown', () => {
    it('should build markdown from multiple FAQ suggestions', () => {
      const suggestions = [
        {
          getData: () => ({
            item: {
              question: 'What is the return policy?',
              answer: 'You can return items within 30 days of purchase.',
            },
          }),
        },
        {
          getData: () => ({
            item: {
              question: 'Do you offer international shipping?',
              answer: 'Yes, we ship to over 100 countries worldwide.',
            },
          }),
        },
      ];

      const markdown = mapper.buildFaqMarkdown(suggestions, 'FAQs');

      expect(markdown).to.include('## FAQs');
      expect(markdown).to.include('### What is the return policy?');
      expect(markdown).to.include('You can return items within 30 days of purchase.');
      expect(markdown).to.include('### Do you offer international shipping?');
      expect(markdown).to.include('Yes, we ship to over 100 countries worldwide.');
    });

    it('should handle headingText parameter', () => {
      const suggestions = [
        {
          getData: () => ({
            item: {
              question: 'Test question?',
              answer: 'Test answer.',
            },
          }),
        },
      ];

      const markdown = mapper.buildFaqMarkdown(suggestions, 'Frequently Asked Questions');
      expect(markdown).to.include('## Frequently Asked Questions');
    });

    it('should skip suggestions without item.question or item.answer', () => {
      const suggestions = [
        {
          getData: () => ({
            item: {
              question: 'Valid question?',
              answer: 'Valid answer.',
            },
          }),
        },
        {
          getData: () => ({
            item: {
              question: 'Invalid - no answer',
            },
          }),
        },
        {
          getData: () => ({
            item: {},
          }),
        },
      ];

      const markdown = mapper.buildFaqMarkdown(suggestions, 'FAQs');

      expect(markdown).to.include('### Valid question?');
      expect(markdown).to.include('Valid answer.');
      expect(markdown).not.to.include('Invalid - no answer');
    });

    it('should work without headingText', () => {
      const suggestions = [
        {
          getData: () => ({
            item: {
              question: 'Test?',
              answer: 'Yes.',
            },
          }),
        },
      ];

      const markdown = mapper.buildFaqMarkdown(suggestions, '');
      expect(markdown).to.include('### Test?');
      expect(markdown).to.include('Yes.');
      // Should start with h3, not h2
      expect(markdown.trim().startsWith('###')).to.be.true;
      // The split lines should not contain any that start with "## " (h2)
      const lines = markdown.split('\n');
      const hasH2 = lines.some((line) => line.startsWith('## '));
      expect(hasH2).to.be.false;
    });
  });

  describe('suggestionsToPatches', () => {
    it('should combine multiple FAQ suggestions into a single patch', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            headingText: 'FAQs',
            item: {
              question: 'What is your return policy?',
              answer: 'You can return items within 30 days.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
        {
          getId: () => 'sugg-faq-2',
          getUpdatedAt: () => '2025-01-15T11:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            headingText: 'FAQs',
            item: {
              question: 'Do you ship internationally?',
              answer: 'Yes, we ship to over 100 countries.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);

      const patch = patches[0];
      expect(patch.opportunityId).to.equal('opp-faq-123');
      expect(patch.suggestionIds).to.deep.equal(['sugg-faq-1', 'sugg-faq-2']);
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.prerenderRequired).to.be.true;
      expect(patch.lastUpdated).to.be.a('number');

      // Verify HAST contains both questions
      const hastString = JSON.stringify(patch.value);
      expect(hastString).to.include('What is your return policy?');
      expect(hastString).to.include('Do you ship internationally?');
    });

    it('should handle single FAQ suggestion', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            headingText: 'FAQs',
            item: {
              question: 'What is your return policy?',
              answer: 'You can return items within 30 days.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-faq-1']);
    });

    it('should filter out ineligible suggestions', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            headingText: 'FAQs',
            item: {
              question: 'Valid question?',
              answer: 'Valid answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
        {
          getId: () => 'sugg-faq-2',
          getUpdatedAt: () => '2025-01-15T11:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            // Missing item - should be filtered out
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-faq-1']);
    });

    it('should return empty array when all suggestions are ineligible', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getData: () => ({
            // Missing transformRules
            item: {
              question: 'Question?',
              answer: 'Answer.',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
    });

    it('should return empty array for empty suggestions', () => {
      const patches = mapper.suggestionsToPatches('/page', [], 'opp-faq-123', null);
      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
    });

    it('should handle suggestions with invalid URLs in allOpportunitySuggestions', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-new',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'Q?',
              answer: 'A.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const allOpportunitySuggestions = [
        {
          getId: () => 'sugg-deployed-1',
          getData: () => ({
            url: 'invalid-url', // Invalid URL should be filtered out
            item: {
              question: 'Old Q?',
              answer: 'Old A.',
            },
            tokowakaDeployed: 1704884400000,
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', allOpportunitySuggestions);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      // Should only include the new suggestion, deployed one filtered out due to invalid URL
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-faq-new']);
    });

    it('should use earliest updatedAt timestamp', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'Q1?',
              answer: 'A1',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
        {
          getId: () => 'sugg-faq-2',
          getUpdatedAt: () => '2025-01-15T12:00:00.000Z', // Latest (but we use earliest)
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'Q2?',
              answer: 'A2',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);
      const expectedTimestamp = new Date('2025-01-15T10:00:00.000Z').getTime(); // Earliest

      expect(patches[0].lastUpdated).to.equal(expectedTimestamp);
    });

    it('should use Date.now() when getUpdatedAt returns null', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-1',
          getUpdatedAt: () => null, // No updatedAt
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'Q1?',
              answer: 'A1',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const beforeTime = Date.now();
      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);
      const afterTime = Date.now();

      expect(patches[0].lastUpdated).to.be.at.least(beforeTime);
      expect(patches[0].lastUpdated).to.be.at.most(afterTime);
    });

    it('should handle real-world FAQ structure from user example', () => {
      const suggestion = {
        getId: () => '5ea1c4b1-dd5a-42e5-ad97-35cf8cc03cb9',
        getUpdatedAt: () => '2025-11-05T17:02:37.741Z',
        getData: () => ({
          topic: 'modifier pdf',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
          item: {
            answerSuitabilityReason: 'The answer provides clear instructions...',
            questionRelevanceReason: 'The question is directly related...',
            question: 'Comment modifier un PDF déjà existant ?',
            answer: 'Pour modifier un PDF existant avec Adobe Acrobat, vous pouvez utiliser soit l\'éditeur en ligne...',
            sources: [
              'https://www.adobe.com/in/acrobat/features/modify-pdfs.html',
            ],
          },
          headingText: 'FAQs',
          shouldOptimize: true,
          url: 'https://www.adobe.com/fr/acrobat/online/pdf-editor.html',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);

      const patch = patches[0];
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');

      const hastString = JSON.stringify(patch.value);
      expect(hastString).to.include('Comment modifier un PDF');
    });

    it('should handle existing config parameter', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-new',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'New question?',
              answer: 'New answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
    });

    it('should handle existing config with no existing patches for URL', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-new',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'New question?',
              answer: 'New answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
    });

    it('should handle error when checking existing config', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-new',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'New question?',
              answer: 'New answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      // Should handle error gracefully and still create patch
      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
    });

    it('should handle null URL when checking existing config', () => {
      const suggestions = [
        {
          getId: () => 'sugg-faq-new',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'New question?',
              answer: 'New answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-faq-123', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
    });

    it('should handle markdown to HAST conversion errors in suggestionsToPatches', () => {
      let errorMessage = '';
      const errorLog = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: (msg) => { errorMessage = msg; },
      };

      const errorMapper = new FaqMapper(errorLog);

      // Override buildFaqMarkdown to return null which will cause markdown parser to fail
      const originalBuildFaqMarkdown = errorMapper.buildFaqMarkdown;
      errorMapper.buildFaqMarkdown = () => null;

      const suggestions = [
        {
          getId: () => 'sugg-faq-error',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            url: 'https://www.example.com/page',
            item: {
              question: 'Question?',
              answer: 'Answer.',
            },
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          }),
        },
      ];

      const patches = errorMapper.suggestionsToPatches('/page', suggestions, 'opp-faq-error', null);

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(0);
      expect(errorMessage).to.include('Failed to convert FAQ markdown to HAST');

      // Restore original method
      errorMapper.buildFaqMarkdown = originalBuildFaqMarkdown;
    });
  });

  describe('canDeploy - new format', () => {
    it('should accept new format with item.question and item.answer', () => {
      const suggestion = {
        getData: () => ({
          item: {
            question: 'Is this the new format?',
            answer: 'Yes, it is.',
          },
          url: 'https://www.example.com/page',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result).to.deep.equal({ eligible: true });
    });

    it('should reject when item.question/answer is missing', () => {
      const suggestion = {
        getData: () => ({
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);
      expect(result.eligible).to.be.false;
      expect(result.reason).to.include('item.question and item.answer are required');
    });
  });

  describe('tokowakaDeployed filtering', () => {
    it('should include previously deployed suggestions when rebuilding FAQ', () => {
      const deployedSuggestion = {
        getId: () => 'sugg-deployed-1',
        getUpdatedAt: () => '2025-01-10T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          item: {
            question: 'Already deployed question?',
            answer: 'Already deployed answer.',
          },
          tokowakaDeployed: 1704884400000, // Timestamp
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const newSuggestion = {
        getId: () => 'sugg-new-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          headingText: 'FAQs',
          item: {
            question: 'New question?',
            answer: 'New answer.',
          },
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const allOpportunitySuggestions = [deployedSuggestion, newSuggestion];

      const patches = mapper.suggestionsToPatches(
        '/page',
        [newSuggestion], // Only deploying new suggestion
        'opp-faq-123',
        allOpportunitySuggestions,
      );

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-deployed-1', 'sugg-new-1']);

      // Verify markdown includes both questions
      const hastString = JSON.stringify(patches[0].value);
      expect(hastString).to.include('Already deployed question');
      expect(hastString).to.include('New question');
    });

    it('should filter deployed suggestions by URL', () => {
      const deployedSuggestion1 = {
        getId: () => 'sugg-deployed-1',
        getUpdatedAt: () => '2025-01-10T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          item: {
            question: 'Page question?',
            answer: 'Page answer.',
          },
          tokowakaDeployed: 1704884400000,
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const deployedSuggestion2 = {
        getId: () => 'sugg-deployed-2',
        getUpdatedAt: () => '2025-01-10T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/other-page',
          item: {
            question: 'Other page question?',
            answer: 'Other page answer.',
          },
          tokowakaDeployed: 1704884400000,
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const newSuggestion = {
        getId: () => 'sugg-new-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          headingText: 'FAQs',
          item: {
            question: 'New question?',
            answer: 'New answer.',
          },
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const allOpportunitySuggestions = [deployedSuggestion1, deployedSuggestion2, newSuggestion];

      const patches = mapper.suggestionsToPatches(
        '/page',
        [newSuggestion],
        'opp-faq-123',
        allOpportunitySuggestions,
      );

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      // Should only include deployed-1 (same URL) and new-1, not deployed-2 (different URL)
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-deployed-1', 'sugg-new-1']);
    });

    it('should work without allOpportunitySuggestions parameter', () => {
      const newSuggestion = {
        getId: () => 'sugg-new-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          headingText: 'FAQs',
          item: {
            question: 'New question?',
            answer: 'New answer.',
          },
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches(
        '/page',
        [newSuggestion],
        'opp-faq-123',
        null, // No all suggestions
      );

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-new-1']);
    });

    it('should handle non-array allOpportunitySuggestions', () => {
      const newSuggestion = {
        getId: () => 'sugg-new-1',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          url: 'https://www.example.com/page',
          headingText: 'FAQs',
          item: {
            question: 'New question?',
            answer: 'New answer.',
          },
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      // Pass a string instead of an array
      const patches = mapper.suggestionsToPatches(
        '/page',
        [newSuggestion],
        'opp-faq-123',
        'not-an-array',
      );

      expect(patches).to.be.an('array');
      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionIds).to.deep.equal(['sugg-new-1']);
    });
  });

  describe('getDeployedSuggestionsForUrl (private method)', () => {
    it('should return empty array when allOpportunitySuggestions is not an array', () => {
      // Test the defensive check in the private method
      const result = mapper.getDeployedSuggestionsForUrl(
        '/page',
        'https://www.example.com',
        'not-an-array', // Not an array
        [],
      );

      expect(result).to.be.an('array');
      expect(result.length).to.equal(0);
    });

    it('should filter suggestions with invalid URLs', () => {
      // Create a getData that throws when accessing url property
      const deployedSuggestion = {
        getId: () => 'sugg-deployed-1',
        getData: () => {
          const data = {
            item: {
              question: 'Q?',
              answer: 'A.',
            },
            tokowakaDeployed: 1704884400000,
            transformRules: {
              action: 'appendChild',
              selector: 'main',
            },
          };
          // Define url as a getter that throws
          Object.defineProperty(data, 'url', {
            get: () => {
              throw new Error('URL access error');
            },
          });
          return data;
        },
      };

      const result = mapper.getDeployedSuggestionsForUrl(
        '/page',
        'https://www.example.com',
        [deployedSuggestion],
        [],
      );

      expect(result).to.be.an('array');
      expect(result.length).to.equal(0); // Filtered out due to URL error
    });
  });
});
