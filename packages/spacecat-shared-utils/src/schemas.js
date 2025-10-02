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

const entity = z.union([
  z.object({ type: z.literal('category'), name: nonEmptyString, region: z.union([region, z.array(region)]) }),
  z.object({ type: z.literal('topic'), name: nonEmptyString }),
  z.object({ type: nonEmptyString }),
]);

export const llmoConfig = z.object({
  entities: z.record(z.uuid(), entity),
  brands: z.object({
    aliases: z.array(
      z.object({
        aliases: z.array(nonEmptyString),
        category: z.uuid(),
        region: z.union([region, z.array(region)]),
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
}).superRefine((value, ctx) => {
  const { entities, brands, competitors } = value;

  brands.aliases.forEach((alias, index) => {
    ensureEntityType(entities, ctx, alias.category, 'category', ['brands', 'aliases', index, 'category'], 'category');
    ensureRegionCompatibility(entities, ctx, alias.category, alias.region, ['brands', 'aliases', index, 'region'], 'brand alias');
  });

  competitors.competitors.forEach((competitor, index) => {
    ensureEntityType(entities, ctx, competitor.category, 'category', ['competitors', 'competitors', index, 'category'], 'category');
    ensureRegionCompatibility(entities, ctx, competitor.category, competitor.region, ['competitors', 'competitors', index, 'region'], 'competitor');
  });
});

/**
   * @param {LLMOConfig['entities']} entities
   * @param {z.RefinementCtx} ctx
   * @param {string} id
   * @param {string} expectedType
   * @param {Array<number | string>} path
   * @param {string} refLabel
   */
function ensureEntityType(entities, ctx, id, expectedType, path, refLabel) {
  const entityValue = entities[id];
  if (!entityValue) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Unknown ${refLabel} entity: ${id}`,
    });
    return;
  }

  if (entityValue.type !== expectedType) {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `Entity ${id} referenced as ${refLabel} must have type "${expectedType}" but was "${entityValue.type}"`,
    });
  }
}

/**
 * @param {LLMOConfig['entities']} entities
 * @param {z.RefinementCtx} ctx
 * @param {string} categoryId
 * @param {string | string[]} itemRegion
 * @param {Array<number | string>} path
 * @param {string} itemLabel
 */
function ensureRegionCompatibility(entities, ctx, categoryId, itemRegion, path, itemLabel) {
  const categoryEntity = entities[categoryId];
  if (!categoryEntity) {
    // Category validation is handled by ensureEntityType
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
