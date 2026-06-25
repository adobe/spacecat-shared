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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Static handler for GET /v1/workspaces/{id}/brand-topics — the workspace-scoped topic
 * generator the consumer (spacecat-api-service `getBrandTopics`) reads at brand-create to seed
 * a project's prompts. Live shape is a TOP-LEVEL ARRAY `[{ topic, volume, prompts: string[] }]`
 * (verified 2026-06-25, see docs/mock-vs-live-parity.md). Excluded from coverage (materialized).
 */

const TOPICS = [
  {
    topic: 'Running Shoes',
    volume: 120000,
    prompts: ['What is the best running shoe?', 'best trail running shoes'],
  },
  {
    topic: 'Trail Gear',
    volume: 45000,
    prompts: ['best hydration pack for trail running'],
  },
];

/** GET — generate the workspace's top brand topics (top-level array). */
export function GET($) {
  return $.response[200].json(TOPICS);
}
