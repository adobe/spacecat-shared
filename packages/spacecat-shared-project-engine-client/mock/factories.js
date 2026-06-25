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

// @ts-check

/**
 * Mock factory functions for the Project Engine entities — the "mock factory pattern". Each
 * returns a fully-typed entity (typed against the generated, overlay-corrected component schemas)
 * with realistic defaults, and accepts a `Partial<…>` override. Fixtures therefore stay correctly
 * shaped and in sync with the spec, and a per-test caller overrides only what it cares about.
 *
 * Enforcement: this file opts into type-checking via `// @ts-check`, so `npm run test:types`
 * (tsc) fails if a default drifts from the overlayed schema — wrong field type, an unknown field,
 * or (thanks to overlay CR5) a now-`required` field missing from a default. The types come from
 * `build/openapi3.json` (the overlayed artifact), so the fixtures are derived from the spec, not
 * hand-asserted. Ids use real UUIDs (`globalThis.crypto.randomUUID()`) to mirror production.
 */

/** @typedef {import('../src/index.js').components['schemas']} Schemas */
/** @typedef {Schemas['model.AIModelResponse']} AIModel */
/** @typedef {Schemas['model.ProjectAIModelResponse']} ProjectAIModel */
/** @typedef {Schemas['model.AIOPromptWithStatus']} Prompt */
/** @typedef {Schemas['model.ProjectResponse']} Project */

const uuid = () => globalThis.crypto.randomUUID();

/**
 * A catalog AI model (`AIModelResponse`). Only `id` is required by the spec; `name`/`key` are
 * realistic defaults (the add path knows only the id, so callers that mirror it omit them).
 * @param {Partial<AIModel>} [overrides]
 * @returns {AIModel}
 */
export const createAiModelMock = (overrides = {}) => ({
  id: uuid(),
  key: 'gpt-4o',
  name: 'GPT-4o',
  ...overrides,
});

/**
 * A project's assigned AI model (`ProjectAIModelResponse`).
 * @param {Partial<ProjectAIModel>} [overrides]
 * @returns {ProjectAIModel}
 */
export const createProjectAiModelMock = (overrides = {}) => ({
  id: uuid(),
  model: createAiModelMock(),
  prompts_count: 0,
  ...overrides,
});

/**
 * An AIO prompt with status (`AIOPromptWithStatus`) — the `by_tags` list item.
 * @param {Partial<Prompt>} [overrides]
 * @returns {Prompt}
 */
export const createPromptMock = (overrides = {}) => ({
  id: uuid(),
  name: 'What is the best running shoe?',
  is_new: false,
  tags: [],
  ...overrides,
});

/**
 * A project (`ProjectResponse`). Required fields are `id` + `name`; the rest (type,
 * publish_status, …) are situational and omitted by default.
 * @param {Partial<Project>} [overrides]
 * @returns {Project}
 */
export const createProjectMock = (overrides = {}) => ({
  id: uuid(),
  name: 'Seeded Project',
  ...overrides,
});
