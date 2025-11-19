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

/* eslint-disable no-use-before-define */

import * as z from 'zod';

// ===== SCHEMA DEFINITIONS ====================================================
// Schemas defined here must be forward- and backward-compatible when making changes.
// This means:
// - Always wrap arrays in an object, so that extra properties can be added later.
// - When using unions, always include a catchall case to cover unknown future cases.
// - Always allow extra properties in objects, so that future config versions don't break parsing.
//   (this is the default. Do not add `.strict()`!)
// - it is ok to add new optional properties to objects, but not to remove existing ones.
// - enums (z.enum([...])) are not forward-compatible.
//   Use z.string() or `z.union([..., z.string()])` instead.
// - never rename properties, only add new ones.
// - never broaden or narrow types.
//   E.g., don't change `z.string()` to `z.union([z.string(), z.number()])` or vice versa.
//   If you anticipate that need, use the union from the start.
// ============================================================================

/**
 * @typedef {z.output<llmoConfig>} LLMOConfig
 */

const nonEmptyString = z.string().min(1);

const region = z.string().length(2).regex(/^[a-z][a-z]$/i);

const prompt = z.object({
  prompt: nonEmptyString,
  regions: z.array(region),
  origin: z.union([z.literal('human'), z.literal('ai'), z.string()]),
  source: z.union([z.literal('config'), z.literal('api'), z.string()]),
  status: z.union([z.literal('completed'), z.literal('processing'), z.string()]).optional(),
});

const entity = z.object({
  type: nonEmptyString,
  name: nonEmptyString,
});

const categoryUrl = z.object({
  value: nonEmptyString,
  type: z.union([z.literal('prefix'), z.literal('url')]),
}).superRefine((data, ctx) => {
  // Validate URL format only for type 'url'
  if (data.type === 'url') {
    if (!URL.canParse(data.value)) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Invalid URL format',
      });
    }
  }
});

const category = z.object({
  name: nonEmptyString,
  region: z.union([region, z.array(region)]),
  origin: z.union([z.literal('human'), z.literal('ai'), z.string()]).optional(),
  urls: z.array(categoryUrl).optional(),
});

const topic = z.object({
  name: nonEmptyString,
  prompts: z.array(prompt).min(1),
  category: z.union([z.uuid(), nonEmptyString]),
});

const deletedPrompt = prompt.extend({
  topic: nonEmptyString,
  category: nonEmptyString,
});

export const llmoConfig = z.object({
  entities: z.record(z.uuid(), entity),
  categories: z.record(z.uuid(), category),
  topics: z.record(z.uuid(), topic),
  aiTopics: z.record(z.uuid(), topic).optional(),
  brands: z.object({
    aliases: z.array(
      z.object({
        aliases: z.array(nonEmptyString),
        category: z.uuid().optional(),
        region: z.union([region, z.array(region)]).optional(),
      }),
    ),
  }),
  competitors: z.object({
    competitors: z.array(
      z.object({
        category: z.uuid(),
        region: z.union([region, z.array(region)]),
        name: nonEmptyString,
        aliases: z.array(nonEmptyString),
        urls: z.array(z.url().optional()),
      }),
    ),
  }),
  deleted: z.object({
    prompts: z.record(z.uuid(), deletedPrompt).optional(),
  }).optional(),
  cdnBucketConfig: z.object({
    bucketName: z.string().optional(),
    allowedPaths: z.array(z.string()).optional(),
    cdnProvider: z.string(),
  }).optional(),
}).superRefine((value, ctx) => {
  const {
    categories, topics, brands, competitors,
  } = value;

  brands.aliases.forEach((alias, index) => {
    // Ensure category and region are both provided or both omitted
    if (alias.category && !alias.region) {
      ctx.addIssue({
        code: 'custom',
        path: ['brands', 'aliases', index, 'region'],
        message: 'region is required when category is provided',
      });
    } else if (!alias.category && alias.region) {
      ctx.addIssue({
        code: 'custom',
        path: ['brands', 'aliases', index, 'category'],
        message: 'category is required when region is provided',
      });
    } else if (alias.category && alias.region) {
      ensureCategoryExists(categories, ctx, alias.category, ['brands', 'aliases', index, 'category']);
      ensureRegionCompatibility(categories, ctx, alias.category, alias.region, ['brands', 'aliases', index, 'region'], 'brand alias');
    }
  });

  competitors.competitors.forEach((competitor, index) => {
    ensureCategoryExists(categories, ctx, competitor.category, ['competitors', 'competitors', index, 'category']);
    ensureRegionCompatibility(categories, ctx, competitor.category, competitor.region, ['competitors', 'competitors', index, 'region'], 'competitor');
  });

  // Validate topic prompts regions against their category
  validateTopicPromptRegions(categories, ctx, topics, 'topics');

  // Validate aiTopics prompts regions against their category
  if (value.aiTopics) {
    validateTopicPromptRegions(categories, ctx, value.aiTopics, 'aiTopics');
  }
});

/**
 * @param {LLMOConfig['categories']} categories
 * @param {z.RefinementCtx} ctx
 * @param {Record<string, z.infer<typeof topic>>} topics
 * @param {string} topicsKey - The key name in the path (e.g., 'topics' or 'aiTopics')
 */
function validateTopicPromptRegions(categories, ctx, topics, topicsKey) {
  Object.entries(topics).forEach(([topicId, topicEntity]) => {
    if (topicEntity.prompts && topicEntity.category) {
      // If category is a UUID, validate against the referenced category entity
      if (topicEntity.category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        topicEntity.prompts.forEach((promptItem, promptIndex) => {
          ensureRegionCompatibility(
            categories,
            ctx,
            topicEntity.category,
            promptItem.regions,
            [topicsKey, topicId, 'prompts', promptIndex, 'regions'],
            `${topicsKey} prompt`,
          );
        });
      }
    }
  });
}

/**
   * @param {LLMOConfig['categories']} categories
   * @param {z.RefinementCtx} ctx
   * @param {string} id
   * @param {Array<number | string>} path
   */
function ensureCategoryExists(categories, ctx, id, path) {
  if (!categories[id]) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Category ${id} does not exist`,
    });
  }
}

/**
 * @param {LLMOConfig['categories']} categories
 * @param {z.RefinementCtx} ctx
 * @param {string} categoryId
 * @param {string | string[]} itemRegion
 * @param {Array<number | string>} path
 * @param {string} itemLabel
 */
function ensureRegionCompatibility(categories, ctx, categoryId, itemRegion, path, itemLabel) {
  const categoryEntity = categories[categoryId];
  if (!categoryEntity) {
    // Category validation is handled by ensureCategoryExists
    return;
  }

  const categoryRegions = categoryEntity.region;

  // Normalize regions to arrays for comparison
  const categoryRegionArray = Array.isArray(categoryRegions) ? categoryRegions : [categoryRegions];
  const itemRegionArray = Array.isArray(itemRegion) ? itemRegion : [itemRegion];

  // Check if all item regions are contained in category regions
  const invalidRegions = itemRegionArray.filter(
    (regionItem) => !categoryRegionArray.includes(regionItem),
  );
  if (invalidRegions.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `${itemLabel} regions [${invalidRegions.join(', ')}] are not allowed. Category only supports regions: [${categoryRegionArray.join(', ')}]`,
    });
  }
}
