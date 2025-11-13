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
      entities: {},
      categories: {
        [categoryId]: { name: 'Category One', region: 'US' },
      },
      topics: {
        [topicId]: {
          name: 'Topic One',
          prompts: [
            {
              prompt: 'Test prompt',
              regions: ['US'],
              origin: 'human',
              source: 'config',
            },
          ],
          category: categoryId,
        },
      },
      brands: {
        aliases: [{
          aliases: ['Brand Alias'],
          category: categoryId,
          region: 'US',
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
      const config = {
        ...baseConfig,
        brands: {
          aliases: [{
            aliases: ['Brand Alias'],
            category: unknownCategoryId,
            region: 'US',
          }],
        },
      };

      const result = llmoConfig.safeParse(config);
      expect(result.success).false;
      if (result.success) {
        throw new Error('Expected validation to fail');
      }
      expect(result.error.issues[0].message).equals(`Category ${unknownCategoryId} does not exist`);
    });

    it('fails when competitor references unknown category', () => {
      const unknownCategoryId = '22222222-2222-4222-8222-222222222222';
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
      expect(result.error.issues[0].message).equals(`Category ${unknownCategoryId} does not exist`);
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
      expect(result.error.issues[0].message).equals(`Category ${unknownCategoryId} does not exist`);
    });

    describe('region validation', () => {
      const categoryWithRegionsId = '444e4444-e44b-44d4-a444-444444444444';

      const configWithRegions = {
        entities: {},
        categories: {
          [categoryWithRegionsId]: { name: 'Category With Regions', region: ['us', 'ca'] },
        },
        topics: {
          [topicId]: {
            name: 'Topic One',
            prompts: [
              {
                prompt: 'Test prompt',
                regions: ['us'],
                origin: 'human',
                source: 'config',
              },
            ],
            category: categoryWithRegionsId,
          },
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

        it('fails when brand alias has single region not in category', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
                region: 'mx', // single region not in category
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

        it('fails when brand alias has region but no category', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                region: 'us',
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('category is required when region is provided');
        });

        it('fails when brand alias has category but no region', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
                category: categoryWithRegionsId,
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('region is required when category is provided');
        });

        it('validates when brand alias has neither category nor region', () => {
          const config = {
            ...configWithRegions,
            brands: {
              aliases: [{
                aliases: ['Brand Alias'],
              }],
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
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
      });

      describe('category with single region', () => {
        const singleRegionCategoryId = '666e6666-e66b-46d6-a666-666666666666';

        const configWithSingleRegion = {
          entities: {},
          categories: {
            [singleRegionCategoryId]: { name: 'Single Region Category', region: 'us' },
          },
          topics: {
            [topicId]: {
              name: 'Topic One',
              prompts: [
                {
                  prompt: 'Test prompt',
                  regions: ['us'],
                  origin: 'human',
                  source: 'config',
                },
              ],
              category: singleRegionCategoryId,
            },
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

      describe('topic prompts', () => {
        it('validates when topic prompt regions are subset of category regions', () => {
          const testTopicId = '777e7777-e77b-77d7-a777-777777777777';
          const config = {
            ...configWithRegions,
            topics: {
              ...configWithRegions.topics,
              [testTopicId]: {
                name: 'Test Topic',
                prompts: [
                  {
                    prompt: 'Test prompt 1',
                    regions: ['us'],
                    origin: 'human',
                    source: 'config',
                  },
                  {
                    prompt: 'Test prompt 2',
                    regions: ['ca', 'us'],
                    origin: 'ai',
                    source: 'api',
                  },
                ],
                category: categoryWithRegionsId,
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when topic prompt has regions not in category', () => {
          const testTopicId = '888e8888-e88b-48d8-a888-888888888888';
          const config = {
            ...configWithRegions,
            topics: {
              ...configWithRegions.topics,
              [testTopicId]: {
                name: 'Test Topic',
                prompts: [
                  {
                    prompt: 'Test prompt',
                    regions: ['us', 'mx'], // mx not in category regions
                    origin: 'human',
                    source: 'config',
                  },
                ],
                category: categoryWithRegionsId,
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('topics prompt regions [mx] are not allowed. Category only supports regions: [us, ca]');
        });

        it('validates when topic category is a string name (no region validation)', () => {
          const testTopicId = '777e7777-e77b-47d7-a777-777777777777';
          const config = {
            ...configWithRegions,
            topics: {
              ...configWithRegions.topics,
              [testTopicId]: {
                name: 'Test Topic',
                prompts: [
                  {
                    prompt: 'Test prompt',
                    regions: ['mx'], // Any regions allowed when category is string
                    origin: 'human',
                    source: 'config',
                  },
                ],
                category: 'Test Category Name', // String name, not UUID
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when topic has no prompts', () => {
          const testTopicId = 'aaae1111-e11b-41d1-a111-111111111111';
          const config = {
            ...configWithRegions,
            topics: {
              ...configWithRegions.topics,
              [testTopicId]: {
                name: 'Test Topic',
                prompts: [], // Empty prompts array should fail
                category: categoryWithRegionsId,
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
        });

        it('fails when topic has no category', () => {
          const testTopicId = 'bbbb2222-e22b-42d2-a222-222222222222';
          const config = {
            ...configWithRegions,
            topics: {
              ...configWithRegions.topics,
              [testTopicId]: {
                name: 'Test Topic',
                prompts: [
                  {
                    prompt: 'Test prompt',
                    regions: ['us'],
                    origin: 'human',
                    source: 'config',
                  },
                ],
                // Missing category field
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
        });
      });

      describe('aiTopics prompts', () => {
        it('validates when aiTopics prompt regions are subset of category regions', () => {
          const aiTopicId = '999e9999-e99b-49d9-a999-999999999999';
          const config = {
            ...configWithRegions,
            aiTopics: {
              [aiTopicId]: {
                name: 'AI Test Topic',
                prompts: [
                  {
                    prompt: 'AI Test prompt 1',
                    regions: ['us'],
                    origin: 'ai',
                    source: 'flow',
                  },
                  {
                    prompt: 'AI Test prompt 2',
                    regions: ['ca', 'us'],
                    origin: 'ai',
                    source: 'flow',
                  },
                ],
                category: categoryWithRegionsId,
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('fails when aiTopics prompt has regions not in category', () => {
          const aiTopicId = 'aaaa0000-ea0b-40d0-a000-000000000000';
          const config = {
            ...configWithRegions,
            aiTopics: {
              [aiTopicId]: {
                name: 'AI Test Topic',
                prompts: [
                  {
                    prompt: 'AI Test prompt',
                    regions: ['us', 'mx'], // mx not in category regions
                    origin: 'ai',
                    source: 'flow',
                  },
                ],
                category: categoryWithRegionsId,
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).false;
          if (result.success) {
            throw new Error('Expected validation to fail');
          }
          expect(result.error.issues[0].message).equals('aiTopics prompt regions [mx] are not allowed. Category only supports regions: [us, ca]');
        });

        it('validates when aiTopics category is a string name (no region validation)', () => {
          const aiTopicId = 'bbbb1111-eb1b-41d1-a111-111111111111';
          const config = {
            ...configWithRegions,
            aiTopics: {
              [aiTopicId]: {
                name: 'AI Test Topic',
                prompts: [
                  {
                    prompt: 'AI Test prompt',
                    regions: ['mx'], // Any regions allowed when category is string
                    origin: 'ai',
                    source: 'flow',
                  },
                ],
                category: 'AI Test Category Name', // String name, not UUID
              },
            },
          };

          const result = llmoConfig.safeParse(config);
          expect(result.success).true;
        });

        it('validates configuration without aiTopics (optional field)', () => {
          const result = llmoConfig.safeParse(configWithRegions);
          expect(result.success).true;
          if (result.success) {
            expect(result.data.aiTopics).to.be.undefined;
          }
        });
      });
    });

    describe('deleted', () => {
      const deletedPromptId1 = 'dddd1111-d11b-41d1-a111-111111111111';
      const deletedPromptId2 = 'dddd2222-d22b-42d2-a222-222222222222';

      it('validates configuration without deleted (optional field)', () => {
        const result = llmoConfig.safeParse(baseConfig);
        expect(result.success).true;
      });

      it('validates configuration with empty deleted prompts record', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {},
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });

      it('validates configuration without prompts field in deleted', () => {
        const config = {
          ...baseConfig,
          deleted: {},
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });

      it('validates configuration with valid deleted prompts', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Deleted prompt one',
                topic: 'Deleted Topic Name',
                regions: ['us'],
                category: 'Deleted Category Name',
                origin: 'human',
                source: 'config',
              },
              [deletedPromptId2]: {
                prompt: 'Deleted prompt two',
                topic: 'Another Deleted Topic',
                regions: ['ca', 'us'],
                category: 'Another Deleted Category',
                origin: 'ai',
                source: 'api',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });

      it('validates with custom origin and source values', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['us'],
                category: 'Test Category',
                origin: 'custom-origin',
                source: 'custom-source',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });

      it('fails when deleted prompt has empty prompt text', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: '',
                topic: 'Test Topic',
                regions: ['us'],
                category: 'Test Category',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when deleted prompt has empty topic', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                topic: '',
                regions: ['us'],
                category: 'Test Category',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when deleted prompt has empty category', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['us'],
                category: '',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when deleted prompt has invalid region format', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['usa'], // Invalid - must be 2 characters
                category: 'Test Category',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when deleted prompt is missing required fields', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                // Missing topic, regions, category, origin, source
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when deleted prompt has invalid UUID key', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              'not-a-uuid': {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['us'],
                category: 'Test Category',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('allows extra properties in deleted (forward compatibility)', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId1]: {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['us'],
                category: 'Test Category',
                origin: 'human',
                source: 'config',
                deletedAt: '2025-01-01T00:00:00Z', // Extra field for future compatibility
                deletedBy: 'user@example.com', // Extra field
              },
            },
            futureEntityType: {}, // Extra property at deleted level
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });
    });
    describe('category origin', () => {
      it('allows category without origin (optional field)', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: { name: 'Category One', region: 'US' },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.categories[categoryId].origin).to.be.undefined;
        }
      });

      it('accepts explicit human origin', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: { name: 'Category One', region: 'US', origin: 'human' },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.categories[categoryId].origin).equals('human');
        }
      });

      it('accepts ai origin', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: { name: 'Category One', region: 'US', origin: 'ai' },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.categories[categoryId].origin).equals('ai');
        }
      });
    });

    describe('category urls', () => {
      it('validates category without urls (optional field)', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: { name: 'Category One', region: 'US' },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.categories[categoryId].urls).to.be.undefined;
        }
      });

      it('validates category with valid URL type', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: 'https://example.com', type: 'url' },
                { value: 'https://another-example.com/path', type: 'url' },
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.categories[categoryId].urls).to.have.length(2);
          expect(result.data.categories[categoryId].urls[0].value).equals('https://example.com');
          expect(result.data.categories[categoryId].urls[0].type).equals('url');
        }
      });

      it('fails when URL type has invalid URL format', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: 'not-a-valid-url', type: 'url' },
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
        if (!result.success) {
          expect(result.error.issues[0].message).equals('Invalid URL format');
        }
      });

      it('validates prefix type with non-URL format (no validation for prefix)', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: 'some-prefix-string', type: 'prefix' },
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });

      it('fails when url object has empty value', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: '', type: 'url' },
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when url object has invalid type', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: 'https://example.com', type: 'invalid-type' },
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('fails when url object is missing required fields', () => {
        const config = {
          ...baseConfig,
          categories: {
            [categoryId]: {
              name: 'Category One',
              region: 'US',
              urls: [
                { value: 'https://example.com' }, // missing type
              ],
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });
    });

    describe('cdn bucket config', () => {
      it('validates configuration without cdn bucket config', () => {
        const result = llmoConfig.safeParse(baseConfig);
        expect(result.success).true;
      });

      it('fails configuration without cdnProvider', () => {
        const config = {
          ...baseConfig,
          cdnBucketConfig: {
            bucketName: 'test',
            orgId: 'test',
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).false;
      });

      it('validates configuration with cdn bucket config', () => {
        const config = {
          ...baseConfig,
          cdnBucketConfig: {
            bucketName: 'test',
            allowedPaths: ['test'],
            cdnProvider: 'test',
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
      });
    });

    describe('prompt status', () => {
      it('validates prompt without status (optional field)', () => {
        const config = {
          ...baseConfig,
          topics: {
            [topicId]: {
              name: 'Topic One',
              prompts: [
                {
                  prompt: 'Test prompt',
                  regions: ['US'],
                  origin: 'human',
                  source: 'config',
                  // no status field
                },
              ],
              category: categoryId,
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.topics[topicId].prompts[0].status).to.be.undefined;
        }
      });

      it('validates prompt with completed status', () => {
        const config = {
          ...baseConfig,
          topics: {
            [topicId]: {
              name: 'Topic One',
              prompts: [
                {
                  prompt: 'Test prompt',
                  regions: ['US'],
                  origin: 'human',
                  source: 'config',
                  status: 'completed',
                },
              ],
              category: categoryId,
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.topics[topicId].prompts[0].status).equals('completed');
        }
      });
    });

    describe('deleted prompt origin', () => {
      const deletedPromptId = 'eeee1111-e11b-41e1-a111-111111111111';

      it('validates deleted prompt with human origin', () => {
        const config = {
          ...baseConfig,
          deleted: {
            prompts: {
              [deletedPromptId]: {
                prompt: 'Test prompt',
                topic: 'Test Topic',
                regions: ['us'],
                category: 'Test Category',
                origin: 'human',
                source: 'config',
              },
            },
          },
        };

        const result = llmoConfig.safeParse(config);
        expect(result.success).true;
        if (result.success) {
          expect(result.data.deleted.prompts[deletedPromptId].origin).equals('human');
        }
      });
    });
  });
});
