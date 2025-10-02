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
        [categoryId]: { type: 'category', name: 'Category One', region: 'US' },
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
        entities: {
          [categoryId]: { type: 'category', name: 'Category One', region: 'US' },
          [topicId]: { type: 'topic', name: 'Topic One', region: 'US' }, // Add region to topic so region validation passes
        },
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
            region: [], // Empty region array to avoid region validation error
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

    describe('region validation', () => {
      const categoryWithRegionsId = '444e4444-e44b-44d4-a444-444444444444';
      const categoryWithoutRegionsId = '555e5555-e55b-55d5-a555-555555555555';

      const configWithRegions = {
        entities: {
          [categoryWithRegionsId]: { type: 'category', name: 'Category With Regions', region: ['us', 'ca'] },
          [categoryWithoutRegionsId]: { type: 'category', name: 'Category Without Regions' },
          [topicId]: { type: 'topic', name: 'Topic One' },
        },
        brands: { aliases: [] },
        competitors: { competitors: [] },
      };

      describe('brand aliases', () => {
        it('validates when brand alias regions are subset of category regions', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
                region: 'us', // single region that exists in category
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('validates when brand alias regions array is subset of category regions', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
                region: ['us', 'ca'], // array that matches category regions
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when brand alias has regions not in category', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
                region: ['us', 'mx'], // mx not in category regions
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('brand alias regions [mx] are not allowed. Category only supports regions: [us, ca]');
        });

        it('fails when brand alias has regions but category has none', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithoutRegionsId,
                region: 'us',
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('brand alias cannot have regions when the referenced category has no regions defined');
        });

        it('fails when brand alias has single region not in category', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
                region: 'mx', // single region not in category
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('brand alias regions [mx] are not allowed. Category only supports regions: [us, ca]');
        });
      });

      describe('competitors', () => {
        it('validates when competitor regions are subset of category regions', () => {
          const config = {
            ...configWithRegions,
            competitors: {
              competitors: [{
                category: categoryWithRegionsId,
                region: ['us'], // subset of category regions
                name: 'Competitor One',
                aliases: ['Competitor Alias'],
                urls: [],
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when competitor has regions not in category', () => {
          const config = {
            ...configWithRegions,
            competitors: {
              competitors: [{
                category: categoryWithRegionsId,
                region: ['us', 'mx', 'uk'], // mx and uk not in category
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
          expect(result.error.issues[0].message).equals('competitor regions [mx, uk] are not allowed. Category only supports regions: [us, ca]');
        });

        it('fails when competitor has regions but category has none', () => {
          const config = {
            ...configWithRegions,
            competitors: {
              competitors: [{
                category: categoryWithoutRegionsId,
                region: 'us',
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
          expect(result.error.issues[0].message).equals('competitor cannot have regions when the referenced category has no regions defined');
        });
      });

      describe('category with single region', () => {
        const singleRegionCategoryId = '666e6666-e66b-66d6-a666-666666666666';

        const configWithSingleRegion = {
          entities: {
            [singleRegionCategoryId]: { type: 'category', name: 'Single Region Category', region: 'us' },
            [topicId]: { type: 'topic', name: 'Topic One' },
          },
          brands: { aliases: [] },
          competitors: { competitors: [] },
        };

        it('validates brand alias with matching single region', () => {
          const config = {
            ...configWithSingleRegion,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: singleRegionCategoryId,
                region: 'us',
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when brand alias region does not match category single region', () => {
          const config = {
            ...configWithSingleRegion,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: singleRegionCategoryId,
                region: 'ca',
                topic: topicId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('brand alias regions [ca] are not allowed. Category only supports regions: [us]');
        });
      });
    });
  });
});
