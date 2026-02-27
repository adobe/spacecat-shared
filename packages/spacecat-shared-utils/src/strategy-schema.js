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

import * as z from 'zod';

// ===== SCHEMA DEFINITIONS ====================================================
// Schemas defined here must be forward- and backward-compatible when making changes.
// See llmoConfig schema for detailed guidelines.
// ============================================================================

/**
 * @typedef {z.output<typeof strategyWorkspaceData>} StrategyWorkspaceData
 */

const nonEmptyString = z.string().min(1);

// Shared status union for forward compatibility
const workflowStatus = z.union([
  z.literal('new'),
  z.literal('planning'),
  z.literal('in_progress'),
  z.literal('completed'),
  z.literal('on_hold'),
  z.string(), // Catchall for future statuses
]);

const strategyGoalType = z.union([
  z.literal('visibility-score'),
  z.string(), // Catchall for future goal types
]);

/**
 * Library opportunity - user-created reusable opportunity template
 */
const opportunity = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  description: z.string(),
  category: nonEmptyString,
});

/**
 * Reference to an opportunity within a strategy
 * Two types:
 * 1. Library opportunity: opportunityId references Opportunity.id, no link field
 * 2. System opportunity: has link field, opportunityId is system ID
 */
const strategyOpportunity = z.object({
  opportunityId: nonEmptyString,
  name: z.string().optional(), // For system opportunities (name stored directly)
  link: z.string().optional(), // URL path to opportunity page (system-generated)
  status: workflowStatus,
  assignee: z.string(),
  completedAt: z.string().optional(), // ISO 8601 date string
});

const strategyPromptSelection = z.object({
  prompt: nonEmptyString,
  regions: z.array(z.string()),
});

/**
 * Strategy containing references to opportunities
 */
const strategy = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  status: workflowStatus,
  url: z.string(),
  description: z.string(),
  topic: z.string(),
  selectedPrompts: z.array(strategyPromptSelection).optional(),
  platform: nonEmptyString.optional(),
  opportunities: z.array(strategyOpportunity),
  createdAt: z.string(), // ISO 8601 date string
  createdBy: z.string().optional(), // Email of strategy creator/owner
  completedAt: z.string().optional(), // ISO 8601 date string
  goalType: strategyGoalType.optional(),
});

/**
 * Root schema for strategy workspace data
 */
export const strategyWorkspaceData = z.object({
  opportunities: z.array(opportunity),
  strategies: z.array(strategy),
}).superRefine((value, ctx) => {
  const { opportunities, strategies } = value;

  // Build a set of library opportunity IDs for reference validation
  const libraryOpportunityIds = new Set(opportunities.map((opp) => opp.id));

  // Validate that library opportunity references exist
  strategies.forEach((strat, strategyIndex) => {
    strat.opportunities.forEach((stratOpp, oppIndex) => {
      // Only validate library opportunities (those without a link)
      if (!stratOpp.link && !libraryOpportunityIds.has(stratOpp.opportunityId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['strategies', strategyIndex, 'opportunities', oppIndex, 'opportunityId'],
          message: `Library opportunity ${stratOpp.opportunityId} does not exist`,
        });
      }
    });
  });

  // Validate completedAt consistency with status
  strategies.forEach((strat, strategyIndex) => {
    if (strat.status === 'completed' && !strat.completedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['strategies', strategyIndex, 'completedAt'],
        message: 'completedAt is required when status is completed',
      });
    }

    strat.opportunities.forEach((stratOpp, oppIndex) => {
      if (stratOpp.status === 'completed' && !stratOpp.completedAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['strategies', strategyIndex, 'opportunities', oppIndex, 'completedAt'],
          message: 'completedAt is required when status is completed',
        });
      }
    });
  });
});
