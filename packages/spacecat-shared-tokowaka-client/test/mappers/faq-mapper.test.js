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
import sinon from 'sinon';
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

  describe('canDeploy', () => {
    it('should return eligible for valid FAQ suggestion', () => {
      const suggestion = {
        getData: () => ({
          text: '### FAQs\n\n#### Is this valid?\n\nYes, it is.',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when text is missing', () => {
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
        reason: 'text is required',
      });
    });

    it('should return ineligible when transformRules are missing', () => {
      const suggestion = {
        getData: () => ({
          text: '### FAQs\n\n#### Is this valid?\n\nYes, it is.',
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
          text: '### FAQs',
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
          text: '### FAQs',
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
        reason: 'text is required',
      });
    });

    it('should accept insertAfter as valid action', () => {
      const suggestion = {
        getData: () => ({
          text: '### FAQs',
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
          text: '### FAQs',
          transformRules: {
            action: 'insertBefore',
            selector: 'main',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });
  });

  describe('suggestionToPatch', () => {
    it('should create patch with HAST value from markdown', () => {
      const suggestion = {
        getId: () => 'sugg-faq-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          text: '### FAQs\n\n#### Is Bulk better than myprotein?\n\nYes, because of **better value**.',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-faq-123');

      expect(patch).to.exist;
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.opportunityId).to.equal('opp-faq-123');
      expect(patch.suggestionId).to.equal('sugg-faq-123');
      expect(patch.prerenderRequired).to.be.true;
      expect(patch.lastUpdated).to.be.a('number');

      // Verify HAST structure
      expect(patch.value).to.be.an('object');
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(0);
    });

    it('should convert FAQ markdown with headings and lists to HAST', () => {
      const faqText = `### FAQs

#### Is Bulk better than myprotein?

Bulk offers several advantages:

1. **Better Value for Money**: High-quality products at competitive prices.
2. **Wider Selection**: Products for diverse fitness goals.
3. **Unique Product Ranges**: Simplified product choices.

#### What are Bulk powders?

Bulk Powders is a leading UK sports nutrition brand.`;

      const suggestion = {
        getId: () => 'sugg-faq-complex',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          text: faqText,
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-faq-complex');

      expect(patch).to.exist;
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(2);

      // Should have h3, h4, paragraphs, and ordered list
      const hasH3 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h3');
      const hasH4 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h4');
      const hasP = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'p');
      const hasOl = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'ol');

      expect(hasH3).to.be.true;
      expect(hasH4).to.be.true;
      expect(hasP).to.be.true;
      expect(hasOl).to.be.true;
    });

    it('should handle markdown with bold text', () => {
      const suggestion = {
        getId: () => 'sugg-faq-bold',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          text: '#### Question?\n\nThis is **bold** text.',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-faq-bold');

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

    it('should return null when text is missing', () => {
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

      const patch = mapper.suggestionToPatch(suggestion, 'opp-invalid');

      expect(patch).to.be.null;
    });

    it('should return null when transformRules are incomplete', () => {
      const suggestion = {
        getId: () => 'sugg-invalid-2',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          text: '### FAQs',
          transformRules: {
            selector: 'main',
          },
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-invalid-2');

      expect(patch).to.be.null;
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

      // Stub the markdownToHast method to throw an error
      const stub = sinon.stub(errorMapper, 'markdownToHast').throws(new Error('Markdown parsing failed'));

      const suggestion = {
        getId: () => 'sugg-error',
        getData: () => ({
          text: '### FAQs',
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
        }),
      };

      const patch = errorMapper.suggestionToPatch(suggestion, 'opp-error');

      expect(patch).to.be.null;
      expect(errorMessage).to.include('Failed to convert markdown to HAST');
      expect(errorMessage).to.include('Markdown parsing failed');

      stub.restore();
    });

    it('should handle real-world FAQ example from user', () => {
      const realWorldText = `### FAQs

#### Is Bulk better than myprotein?

Bulk offers several advantages over MyProtein in sports nutrition:

1. **Better Value for Money**: Bulk provides high-quality products at competitive prices, highlighting products like their Pure Whey Protein™, Europe's best value whey protein.
2. **Wider Selection**: Bulk's range of products caters to diverse fitness goals, including weight loss, muscle building, and performance improvement, making it broader than MyProtein.
3. **Unique Product Ranges**: Bulk simplifies product choices with four distinct ranges—Pure Series™, Complete Series™, Pro Series™, and Active Foods™.
4. **Customer Satisfaction**: Bulk emphasizes strong customer service and boasts a higher Trustpilot rating compared to MyProtein, indicating better customer trust.
5. **Superior Product Formulation**: Popular products, such as Elevate™ pre-workout and Complete Greens™, are noted for their quality and pricing compared to MyProtein's offerings.

Overall, Bulk positions itself as a better choice for sports nutrition through its focus on value, variety, innovation, and customer satisfaction.

#### What are Bulk powders?

Bulk Powders, now known as Bulk™, is a leading UK sports nutrition brand that offers a wide range of high-quality, scientifically-backed products. The company has a strong focus on transparency, quality, and innovation in its product offerings. Bulk™ ensures high standards by blending products in-house in a state-of-the-art clean room facility, conducting independent laboratory testing, and providing full ingredient lists and dosages for all products. Their product range includes whey protein, plant-based protein, protein snacks, creatine, BCAAs, and more, as well as premium ranges like Pro Series™ tested under the Informed Sport programme for banned substances. Bulk™ also emphasizes innovation with unique product formulations and offers a Wholesale Partner Programme for distributors.`;

      const suggestion = {
        getId: () => 'sugg-faq-real',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          text: realWorldText,
          transformRules: {
            action: 'appendChild',
            selector: 'main',
          },
          fullPage: false,
          url: 'https://www.bulk.com/uk',
        }),
      };

      const patch = mapper.suggestionToPatch(suggestion, 'opp-faq-real');

      expect(patch).to.exist;
      expect(patch.op).to.equal('appendChild');
      expect(patch.selector).to.equal('main');
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.value.type).to.equal('root');
      expect(patch.value.children).to.be.an('array');
      expect(patch.value.children.length).to.be.greaterThan(5);

      // Should have multiple headings, paragraphs, and ordered list
      const hasH3 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h3');
      const hasH4 = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'h4');
      const hasP = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'p');
      const hasOl = patch.value.children.some((child) => child.type === 'element' && child.tagName === 'ol');

      expect(hasH3).to.be.true;
      expect(hasH4).to.be.true;
      expect(hasP).to.be.true;
      expect(hasOl).to.be.true;
    });
  });
});
