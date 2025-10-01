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

import { llmoConfig } from '../src/schemas.js';

describe('schemas', () => {
  describe('llmoConfig', () => {
    const categoryId = '550e8400-e29b-41d4-a716-446655440000';
    const topicId = '123e4567-e89b-12d3-a456-426614174001';

    const baseConfig = {
      entities: {
        [categoryId]: { type: 'category', name: 'Category One' },
        [topicId]: { type: 'topic', name: 'Topic One' },
      },
      brands: {
        aliases: [{
          aliases: ['Brand Alias'],
          category: categoryId,
          region: 'US',
          topic: topicId,
        }],
      },
      competitors: {
        competitors: [{
          category: categoryId,
          region: 'US',
          name: 'Competitor One',
          aliases: ['Competitor Alias'],
          urls: [],
        }],
      },
    };

    it('validates configuration when all references exist', () => {
      const result = llmoConfig.safeParse(baseConfig);
      expect(result.success).true;
    });

    it('fails when brand references unknown entities', () => {
      const unknownCategoryId = '11111111-1111-4111-8111-111111111111';
      const unknownTopicId = '22222222-2222-4222-8222-222222222222';
      const config = {
        ...baseConfig,
        brands: {
          aliases: [{
            aliases: ['Brand Alias'],
            category: unknownCategoryId,
            region: 'US',
            topic: unknownTopicId,
          }],
        },
      };

      const result = llmoConfig.safeParse(config);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals(`Unknown category entity: ${unknownCategoryId}`);
      expect(result.error.issues[1].message).equals(`Unknown topic entity: ${unknownTopicId}`);
    });

    it('fails when competitor references a non-category entity', () => {
      const config = {
        ...baseConfig,
        competitors: {
          competitors: [{
            category: topicId,
            region: 'US',
            name: 'Competitor One',
            aliases: ['Competitor Alias'],
            urls: [],
          }],
        },
      };

      const result = llmoConfig.safeParse(config);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals(`Entity ${topicId} referenced as category must have type "category" but was "topic"`);
    });

    it('fails when brand references a non-topic entity as topic', () => {
      const config = {
        ...baseConfig,
        entities: {
          [categoryId]: { type: 'category', name: 'Category One' },
          [topicId]: { type: 'category', name: 'Category Two' },
        },
      };

      const result = llmoConfig.safeParse(config);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals(`Entity ${topicId} referenced as topic must have type "topic" but was "category"`);
    });

    it('fails when competitor references unknown entity', () => {
      const unknownCategoryId = '33333333-3333-4333-8333-333333333333';
      const config = {
        ...baseConfig,
        competitors: {
          competitors: [{
            category: unknownCategoryId,
            region: 'US',
            name: 'Competitor One',
            aliases: ['Competitor Alias'],
            urls: [],
          }],
        },
      };

      const result = llmoConfig.safeParse(config);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals(`Unknown category entity: ${unknownCategoryId}`);
    });
  });
});
