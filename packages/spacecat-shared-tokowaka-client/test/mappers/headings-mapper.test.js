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
  let log;

  beforeEach(() => {
    log = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    mapper = new HeadingsMapper(log);
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
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading',
          transformRules: {
            action: 'replace',
            selector: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return eligible for heading-missing-h1 checkType', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New H1',
          transformRules: {
            action: 'insertAfter',
            selector: '#header',
            tag: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return eligible for heading-h1-length checkType', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-h1-length',
          recommendedAction: 'Better H1',
          transformRules: {
            action: 'replace',
            selector: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return eligible for heading-order-invalid checkType', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: '.invalid-section',
            valueFormat: 'hast',
            value: { type: 'element', tagName: 'h2', children: [] },
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({ eligible: true });
    });

    it('should return ineligible for unknown checkType', () => {
      const suggestion = {
        getData: () => ({ checkType: 'unknown-type' }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only heading-empty, heading-missing-h1, heading-h1-length, heading-order-invalid can be deployed. This suggestion has checkType: unknown-type',
      });
    });

    it('should return ineligible when checkType is missing', () => {
      const suggestion = {
        getData: () => ({}),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only heading-empty, heading-missing-h1, heading-h1-length, heading-order-invalid can be deployed. This suggestion has checkType: undefined',
      });
    });

    it('should return ineligible when data is null', () => {
      const suggestion = {
        getData: () => null,
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'Only heading-empty, heading-missing-h1, heading-h1-length, heading-order-invalid can be deployed. This suggestion has checkType: undefined',
      });
    });

    it('should return ineligible when recommendedAction is missing', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-empty',
          transformRules: {
            action: 'replace',
            selector: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'recommendedAction is required',
      });
    });

    it('should return ineligible when transformRules.selector is missing', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading',
          transformRules: {
            action: 'replace',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.selector is required',
      });
    });

    it('should return ineligible for heading-missing-h1 with invalid action', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New H1',
          transformRules: {
            action: 'replace',
            selector: '#header',
            tag: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.action must be insertBefore or insertAfter for heading-missing-h1',
      });
    });

    it('should return ineligible for heading-missing-h1 without tag', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New H1',
          transformRules: {
            action: 'insertAfter',
            selector: '#header',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.tag is required for heading-missing-h1',
      });
    });

    it('should return ineligible for heading-h1-length with invalid action', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-h1-length',
          recommendedAction: 'New H1',
          transformRules: {
            action: 'insertAfter',
            selector: 'h1',
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.action must be replace for heading-h1-length',
      });
    });

    it('should return ineligible for heading-order-invalid with invalid action', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replace',
            selector: '.invalid-section',
            valueFormat: 'hast',
            value: { type: 'element', tagName: 'h2', children: [] },
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.action must be replaceWith for heading-order-invalid',
      });
    });

    it('should return ineligible for heading-order-invalid with missing valueFormat', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: '.invalid-section',
            value: { type: 'element', tagName: 'h2', children: [] },
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.valueFormat must be hast for heading-order-invalid',
      });
    });

    it('should return ineligible for heading-order-invalid with invalid valueFormat', () => {
      const suggestion = {
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: '.invalid-section',
            valueFormat: 'text',
            value: { type: 'element', tagName: 'h2', children: [] },
          },
        }),
      };

      const result = mapper.canDeploy(suggestion);

      expect(result).to.deep.equal({
        eligible: false,
        reason: 'transformRules.valueFormat must be hast for heading-order-invalid',
      });
    });
  });

  describe('suggestionsToPatches', () => {
    it('should create patch for heading-empty with transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading',
          transformRules: {
            action: 'replace',
            selector: 'h1',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-123');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

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

    it('should create patch with custom selector', () => {
      const suggestion = {
        getId: () => 'sugg-123',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading',
          transformRules: {
            action: 'replace',
            selector: 'body > h1',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-123');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'replace',
        selector: 'body > h1',
        value: 'New Heading',
        opportunityId: 'opp-123',
        suggestionId: 'sugg-123',
        prerenderRequired: true,
      });
    });

    it('should create patch for heading-missing-h1 with transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-456',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'Exclusive Flight Booking Deals & Partner Discounts.',
          transformRules: {
            action: 'insertAfter',
            selector: '#text-85a9876220 > h2:nth-of-type(1)',
            tag: 'h1',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-456');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'insertAfter',
        selector: '#text-85a9876220 > h2:nth-of-type(1)',
        value: 'Exclusive Flight Booking Deals & Partner Discounts.',
        tag: 'h1',
        opportunityId: 'opp-456',
        suggestionId: 'sugg-456',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should create patch for heading-h1-length with transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-789',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-h1-length',
          recommendedAction: 'New H1 Heading',
          transformRules: {
            action: 'replace',
            selector: 'body > h1',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-789');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'replace',
        selector: 'body > h1',
        value: 'New H1 Heading',
        opportunityId: 'opp-789',
        suggestionId: 'sugg-789',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
      expect(patch.tag).to.be.undefined;
    });

    it('should create patch for heading-order-invalid with transformRules', () => {
      const hastValue = {
        type: 'element',
        tagName: 'div',
        children: [
          { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'Section Title' }] },
          { type: 'element', tagName: 'h3', children: [{ type: 'text', value: 'Subsection' }] },
        ],
      };

      const suggestion = {
        getId: () => 'sugg-101',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: '.content-section',
            valueFormat: 'hast',
            value: hastValue,
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-101');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'replaceWith',
        selector: '.content-section',
        value: hastValue,
        valueFormat: 'hast',
        opportunityId: 'opp-101',
        suggestionId: 'sugg-101',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
      expect(patch.tag).to.be.undefined;
    });

    it('should return empty array for heading-order-invalid without transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-102',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-102');
      expect(patches.length).to.equal(0);
    });

    it('should return empty array for heading-order-invalid with invalid action', () => {
      const suggestion = {
        getId: () => 'sugg-103',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replace',
            selector: '.content-section',
            valueFormat: 'hast',
            value: { type: 'element', tagName: 'h2', children: [] },
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-103');
      expect(patches.length).to.equal(0);
    });

    it('should create patch for heading-order-invalid with real-world HAST structure', () => {
      const hastValue = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'h2',
            children: [
              {
                type: 'text',
                value: 'Complete Cover Sets',
              },
            ],
            properties: {},
          },
        ],
      };

      const suggestion = {
        getId: () => 'sugg-104',
        getUpdatedAt: () => '2026-01-03T06:24:06.229Z',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Adjust heading levels to maintain proper hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: 'h4#complete-cover-sets',
            valueFormat: 'hast',
            value: hastValue,
            scrapedAt: '2026-01-03T06:24:06.229Z',
            currValue: 'Complete Cover Sets',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-104');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch).to.deep.include({
        op: 'replaceWith',
        selector: 'h4#complete-cover-sets',
        value: hastValue,
        valueFormat: 'hast',
        opportunityId: 'opp-104',
        suggestionId: 'sugg-104',
        prerenderRequired: true,
      });
      expect(patch.lastUpdated).to.be.a('number');
    });

    it('should create patch for heading-order-invalid with complex selector', () => {
      const hastValue = {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'h3',
            properties: { id: 'section-title' },
            children: [{ type: 'text', value: 'Updated Section' }],
          },
        ],
      };

      const suggestion = {
        getId: () => 'sugg-105',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Fix heading hierarchy from h5 to h3.',
          transformRules: {
            action: 'replaceWith',
            selector: 'body > main > section:nth-child(2) > h5',
            valueFormat: 'hast',
            value: hastValue,
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-105');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch.selector).to.equal('body > main > section:nth-child(2) > h5');
      expect(patch.value).to.deep.equal(hastValue);
      expect(patch.valueFormat).to.equal('hast');
    });

    it('should handle multiple heading-order-invalid suggestions', () => {
      const suggestions = [
        {
          getId: () => 'sugg-106',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            checkType: 'heading-order-invalid',
            recommendedAction: 'Fix heading hierarchy.',
            transformRules: {
              action: 'replaceWith',
              selector: 'h4.title',
              valueFormat: 'hast',
              value: {
                type: 'root',
                children: [
                  {
                    type: 'element',
                    tagName: 'h2',
                    properties: { class: 'title' },
                    children: [{ type: 'text', value: 'Title 1' }],
                  },
                ],
              },
            },
          }),
        },
        {
          getId: () => 'sugg-107',
          getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
          getData: () => ({
            checkType: 'heading-order-invalid',
            recommendedAction: 'Fix another heading.',
            transformRules: {
              action: 'replaceWith',
              selector: 'h5.subtitle',
              valueFormat: 'hast',
              value: {
                type: 'root',
                children: [
                  {
                    type: 'element',
                    tagName: 'h3',
                    properties: { class: 'subtitle' },
                    children: [{ type: 'text', value: 'Subtitle' }],
                  },
                ],
              },
            },
          }),
        },
      ];

      const patches = mapper.suggestionsToPatches('/path', suggestions, 'opp-106');
      expect(patches.length).to.equal(2);
      expect(patches[0].selector).to.equal('h4.title');
      expect(patches[1].selector).to.equal('h5.subtitle');
      expect(patches[0].valueFormat).to.equal('hast');
      expect(patches[1].valueFormat).to.equal('hast');
    });

    it('should not use text valueFormat for heading-order-invalid', () => {
      const hastValue = {
        type: 'root',
        children: [
          { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'Heading' }] },
        ],
      };

      const suggestion = {
        getId: () => 'sugg-108',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-order-invalid',
          recommendedAction: 'Fix heading hierarchy.',
          transformRules: {
            action: 'replaceWith',
            selector: 'h4',
            valueFormat: 'hast',
            value: hastValue,
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-108');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      // Verify it uses HAST format, not text
      expect(patch.valueFormat).to.equal('hast');
      expect(patch.value).to.be.an('object');
      expect(patch.value).to.deep.equal(hastValue);
    });

    it('should include currValue when currentValue is not null for heading-empty', () => {
      const suggestion = {
        getId: () => 'sugg-109',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading Text',
          currentValue: 'Old Heading',
          transformRules: {
            action: 'replace',
            selector: 'h2.empty',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-109');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch.currValue).to.equal('Old Heading');
      expect(patch.value).to.equal('New Heading Text');
    });

    it('should not include currValue when currentValue is null', () => {
      const suggestion = {
        getId: () => 'sugg-110',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-empty',
          recommendedAction: 'New Heading Text',
          currentValue: null,
          transformRules: {
            action: 'replace',
            selector: 'h2.empty',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-110');
      expect(patches.length).to.equal(1);
      const patch = patches[0];

      expect(patch.currValue).to.be.undefined;
      expect(patch.value).to.equal('New Heading Text');
    });

    it('should return empty array for heading-missing-h1 without transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-999',
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New Heading',
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-999');
      expect(patches.length).to.equal(0);
    });

    it('should return empty array for heading-h1-length without selector in transformRules', () => {
      const suggestion = {
        getId: () => 'sugg-888',
        getData: () => ({
          checkType: 'heading-h1-length',
          recommendedAction: 'New Heading',
          transformRules: {
            action: 'insertAt',
          },
        }),
      };

      const patches = mapper.suggestionsToPatches('/path', [suggestion], 'opp-888');
      expect(patches.length).to.equal(0);
    });

    it('should log warning for heading-missing-h1 with missing transformRules - validation path', () => {
      let warnLogged = false;
      const warnLog = {
        debug: () => {},
        info: () => {},
        warn: () => { warnLogged = true; },
        error: () => {},
      };
      const warnMapper = new HeadingsMapper(warnLog);

      const suggestion = {
        getId: () => 'sugg-warn',
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New Heading',
        }),
      };

      const patches = warnMapper.suggestionsToPatches('/path', [suggestion], 'opp-warn');

      expect(patches.length).to.equal(0);
      expect(warnLogged).to.be.true;
    });

    it('should log warning for heading-missing-h1 with invalid transformRules', () => {
      let warnMessage = '';
      const warnLog = {
        debug: () => {},
        info: () => {},
        warn: (msg) => { warnMessage = msg; },
        error: () => {},
      };
      const warnMapper = new HeadingsMapper(warnLog);

      const suggestion = {
        getId: () => 'sugg-defensive',
        getUpdatedAt: () => '2025-01-15T10:00:00.000Z',
        getData: () => ({
          checkType: 'heading-missing-h1',
          recommendedAction: 'New Heading',
          // Missing transformRules
        }),
      };

      const patches = warnMapper.suggestionsToPatches('/path', [suggestion], 'opp-defensive');

      expect(patches.length).to.equal(0);
      expect(warnMessage).to.include('cannot be deployed');
    });
  });
});
