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
import GenericMapper from '../../src/mappers/generic-mapper.js';

describe('GenericMapper', () => {
  let mapper;
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new GenericMapper(log);
  });

  describe('getOpportunityType', () => {
    it('should return generic', () => {
      expect(mapper.getOpportunityType()).to.equal('generic-tokowaka-patch');
    });
  });

  describe('requiresPrerender', () => {
    it('should return true', () => {
      expect(mapper.requiresPrerender()).to.be.true;
    });
  });

  describe('canDeploy', () => {
    it('should return eligible for valid suggestion with all required fields', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#create-with-multiple-top-ai-models-all-in-one-place',
          patchValue: 'Blah Blah some text',
          insertionOperation: 'insertAfter',
          url: 'https://www.adobe.com/products/firefly.html',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return eligible for insertBefore operation', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: 'h1',
          patchValue: 'New content',
          insertionOperation: 'insertBefore',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return eligible for replace operation', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '.content',
          patchValue: 'Replaced content',
          insertionOperation: 'replace',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible when cssSelector is missing', () => {
      const suggestion = {
        getData: () => ({
          patchValue: 'Some text',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'cssSelector is required',
      });
    });

    it('should return ineligible when cssSelector is empty string', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '',
          patchValue: 'Some text',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'cssSelector is required',
      });
    });

    it('should return ineligible when patchValue is missing', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });

    it('should return ineligible when patchValue is empty string', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: '',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'patchValue is required',
      });
    });

    it('should return ineligible when insertionOperation is missing', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Some text',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'insertionOperation is required',
      });
    });

    it('should return ineligible when insertionOperation is empty string', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Some text',
          insertionOperation: '',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'insertionOperation is required',
      });
    });

    it('should return ineligible when insertionOperation is invalid', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Some text',
          insertionOperation: 'invalidOperation',
          url: 'https://example.com/page',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'insertionOperation must be one of: insertBefore, insertAfter, replace. Got: invalidOperation',
      });
    });

    it('should return ineligible when url is missing', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Some text',
          insertionOperation: 'insertAfter',
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'url is required',
      });
    });

    it('should return ineligible when url is empty string', () => {
      const suggestion = {
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Some text',
          insertionOperation: 'insertAfter',
          url: '',
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
        reason: 'cssSelector is required',
      });
    });

    it('should return ineligible when data is undefined', () => {
      const suggestion = {
        getData: () => undefined,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'cssSelector is required',
      });
    });
  });

  describe('suggestionsToPatches', () => {
    it('should create patch for valid suggestion with insertAfter', () => {
      const suggestion = {
        getId: () => 'ee8fc5e8-29c1-4894-9391-efc10b8a5f5c',
        getUpdatedAt: () => '2025-11-27T16:22:14.258Z',
        getData: () => ({
          cssSelector: '#create-with-multiple-top-ai-models-all-in-one-place',
          patchValue: 'Blah Blah some text',
          insertionOperation: 'insertAfter',
          url: 'https://www.adobe.com/products/firefly.html',
          contentBefore: '**Create with multiple top AI models, all in one place.**',
          rationale: 'This makes LLMs read more text about blah blah.',
        }),
      };

      const patches = mapper.suggestionsToPatches(
        '/products/firefly.html',
        [suggestion],
        '7a663e47-e132-4bba-954a-26419e0541b8',
      );

      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'insertAfter',
        selector: '#create-with-multiple-top-ai-models-all-in-one-place',
        value: 'Blah Blah some text',
        valueFormat: 'text',
        opportunityId: '7a663e47-e132-4bba-954a-26419e0541b8',
        suggestionId: 'ee8fc5e8-29c1-4894-9391-efc10b8a5f5c',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
      expect(patch.target).to.equal('ai-bots');
    });

    it('should create patch for insertBefore operation', () => {
      const suggestion = {
        getId: () => 'sugg-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          cssSelector: 'h1',
          patchValue: 'Important notice',
          insertionOperation: 'insertBefore',
          url: 'https://example.com/page',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-123');

      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'insertBefore',
        selector: 'h1',
        value: 'Important notice',
        valueFormat: 'text',
        opportunityId: 'opp-123',
        suggestionId: 'sugg-123',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should create patch for replace operation', () => {
      const suggestion = {
        getId: () => 'sugg-456',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          cssSelector: '.content',
          patchValue: 'Replaced content text',
          insertionOperation: 'replace',
          url: 'https://example.com/page2',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page2', [suggestion], 'opp-456');

      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'replace',
        selector: '.content',
        value: 'Replaced content text',
        valueFormat: 'text',
        opportunityId: 'opp-456',
        suggestionId: 'sugg-456',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should handle multiple suggestions', () => {
      const suggestions = [
        {
          getId: () => 'sugg-1',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            cssSelector: '#selector1',
            patchValue: 'Text 1',
            insertionOperation: 'insertAfter',
            url: 'https://example.com/page',
          }),
        },
        {
          getId: () => 'sugg-2',
          getUpdatedAt: () => '2025-01-15T11:00:00.000Z',
          getData: () => ({
            cssSelector: '#selector2',
            patchValue: 'Text 2',
            insertionOperation: 'insertBefore',
            url: 'https://example.com/page',
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-123');

      expect(patches.length).to.equal(2);
      expect(patches[0].suggestionId).to.equal('sugg-1');
      expect(patches[0].value).to.equal('Text 1');
      expect(patches[1].suggestionId).to.equal('sugg-2');
      expect(patches[1].value).to.equal('Text 2');
    });

    it('should return empty array for invalid suggestion', () => {
      const suggestion = {
        getId: () => 'sugg-invalid',
        getData: () => ({
          cssSelector: '#selector',
          // Missing patchValue
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-invalid');

      expect(patches.length).to.equal(0);
    });

    it('should skip invalid suggestions but process valid ones', () => {
      const suggestions = [
        {
          getId: () => 'sugg-valid',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            cssSelector: '#valid',
            patchValue: 'Valid text',
            insertionOperation: 'insertAfter',
            url: 'https://example.com/page',
          }),
        },
        {
          getId: () => 'sugg-invalid',
          getData: () => ({
            cssSelector: '#invalid',
            // Missing patchValue
            insertionOperation: 'insertAfter',
            url: 'https://example.com/page',
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/page', suggestions, 'opp-123');

      expect(patches.length).to.equal(1);
      expect(patches[0].suggestionId).to.equal('sugg-valid');
    });

    it('should log warning for invalid suggestion', () => {
      let warnMessage = '';
      const warnLog = {
        debug: () => {},
        info: () => {},
        warn: (msg) => { warnMessage = msg; },
        error: () => {},
      };
      const warnMapper = new GenericMapper(warnLog);

      const suggestion = {
        getId: () => 'sugg-warn',
        getData: () => ({
          cssSelector: '#selector',
          // Missing patchValue
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const patches = warnMapper.suggestionsToPatches('/page', [suggestion], 'opp-warn');

      expect(patches.length).to.equal(0);
      expect(warnMessage).to.include('Generic suggestion sugg-warn cannot be deployed');
      expect(warnMessage).to.include('patchValue is required');
    });

    it('should handle complex CSS selectors', () => {
      const suggestion = {
        getId: () => 'sugg-complex',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          cssSelector: '#text-85a9876220 > h2:nth-of-type(1)',
          patchValue: 'Complex selector content',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-complex');

      expect(patches.length).to.equal(1);
      expect(patches[0].selector).to.equal('#text-85a9876220 > h2:nth-of-type(1)');
    });

    it('should handle multiline patchValue', () => {
      const suggestion = {
        getId: () => 'sugg-multiline',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          cssSelector: '.content',
          patchValue: 'Line 1\nLine 2\nLine 3',
          insertionOperation: 'replace',
          url: 'https://example.com/page',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-multiline');

      expect(patches.length).to.equal(1);
      expect(patches[0].value).to.equal('Line 1\nLine 2\nLine 3');
    });

    it('should not include UI-only fields in patch', () => {
      const suggestion = {
        getId: () => 'sugg-ui',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          cssSelector: '#selector',
          patchValue: 'Text content',
          insertionOperation: 'insertAfter',
          url: 'https://example.com/page',
          contentBefore: 'Original content',
          expectedContentAfter: 'Expected result',
          rationale: 'This improves SEO',
          aggregationKey: 'some-key',
        }),
      };

      const patches = mapper.suggestionsToPatches('/page', [suggestion], 'opp-ui');

      expect(patches.length).to.equal(1);
      const patch = patches[0];

      // Should not include UI-only fields
      expect(patch.contentBefore).to.be.undefined;
      expect(patch.expectedContentAfter).to.be.undefined;
      expect(patch.rationale).to.be.undefined;
      expect(patch.aggregationKey).to.be.undefined;

      // Should include only operational fields
      expect(patch.op).to.equal('insertAfter');
      expect(patch.selector).to.equal('#selector');
      expect(patch.value).to.equal('Text content');
    });
  });
});
