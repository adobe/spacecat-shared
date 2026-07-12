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

/**
 * Compile-only proof that the mock factories produce spec-shaped entities, derived from the
 * overlayed schema. Type-checked by `npm run test:types`; emits nothing. This is the guard that
 * the "mock factory pattern" actually enforces shape — if a factory or the generated types drift,
 * the build fails here. NOT run by mocha.
 */

import {
  createProjectMock,
  createProjectResponseFromRequest,
  applyProjectUpdate,
  createProjectAiModelMock,
  createAiModelMock,
  createPromptMock,
  createBenchmarkMock,
  createBrandUrlMock,
  createAIOTagMock,
  createAIOTagLeafMock,
  createUrlResolveMock,
} from '../../mock/factories.js';
import type { components } from '../../src/index.js';

type Project = components['schemas']['model.ProjectResponse'];
type ProjectAIModel = components['schemas']['model.ProjectAIModelResponse'];
type Prompt = components['schemas']['model.AIOPromptWithStatus'];
type AIModel = components['schemas']['model.AIModelResponse'];
type Benchmark = components['schemas']['model.AIOBenchmarkWithCounters'];
type BrandUrl = components['schemas']['model.BrandURL'];
type AIOTag = components['schemas']['model.AIOTag'];
type UrlResolve = components['schemas']['model.ResolveURLResponse'];

// 1. Each factory returns exactly its spec type (assignable in both directions).
const project: Project = createProjectMock();
const assigned: ProjectAIModel = createProjectAiModelMock();
const prompt: Prompt = createPromptMock();
const model: AIModel = createAiModelMock();

// 1b. createProjectResponseFromRequest maps a create-request to a spec-shaped ProjectResponse.
const created: Project = createProjectResponseFromRequest({
  name: 'Acme', type: 'ai', domain: 'acme.com', brand_names: ['Acme'], language_id: 'l', location_id: 2840,
});
void created;
// @ts-expect-error — location_id is an integer in ProjectRequest, not a string.
createProjectResponseFromRequest({ location_id: 'nope' });

// 1c. applyProjectUpdate maps a flat ProjectUpdateRequest onto a stored draft, returning a Project.
const updatedProject: Project = applyProjectUpdate(
  createProjectMock(),
  { type: 'ai', brand_names: ['X'] },
);
void updatedProject;

// 1d. the benchmark + brand-url factories (the overlay drift-guarded list shapes).
const benchmark: Benchmark = createBenchmarkMock();
const brandUrl: BrandUrl = createBrandUrlMock();
// 1e. the AIO tag factory (the GET /aio/tags list item + persisted shape).
const aioTag: AIOTag = createAIOTagMock({ id: 'tag-x', name: 'Running Shoes' });
void aioTag.prompts_count;
void aioTag;
// @ts-expect-error — keyword_count is a TreeNodeResponse field, not on AIOTag.
createAIOTagMock({ keyword_count: 0 });
// 1e-nested: a child tag carries parent_id + a path[] of AIOTagLeaf ancestors, root-first.
type AIOTagLeaf = components['schemas']['model.AIOTagLeaf'];
const tagLeaf: AIOTagLeaf = createAIOTagLeafMock({ id: 'tag-root', name: 'category' });
const childTag: AIOTag = createAIOTagMock({
  id: 'tag-child', name: 'Trail', parent_id: 'tag-root', path: [tagLeaf],
});
void childTag.parent_id;
void childTag.path;
// CR13: live returns null (not omitted/[]) for a flat root's parent_id + path — the overlay makes
// both nullable, so these only compile while CR13 is in the schema.
const rootTag: AIOTag = createAIOTagMock({ parent_id: null, path: null });
void rootTag;
// @ts-expect-error — a path leaf is an AIOTagLeaf, not a bare string.
createAIOTagMock({ path: ['tag-root'] });
// CR10: primary_url + root_domain are added to AIOBenchmarkWithCounters by the overlay (live
// returns them). These reads only compile while CR10 is in the schema — drop CR10 and they error.
void benchmark.primary_url;
void benchmark.root_domain;
void benchmark.project_id;
void benchmark;
void brandUrl;

// 1f. the url-resolve factory (overlay CR16). All three fields are required by the schema, so the
// default must supply them — this only compiles while CR16 is in the schema.
const urlResolve: UrlResolve = createUrlResolveMock();
const resolveFields: [string, string, boolean] = [
  urlResolve.domain, urlResolve.primary_url, urlResolve.is_valid,
];
void resolveFields;
createUrlResolveMock({ domain: 'lovesac.com', primary_url: 'lovesac.com', is_valid: true });
// @ts-expect-error — is_valid is a boolean, not a string.
createUrlResolveMock({ is_valid: 'yes' });

// 2. Partial overrides of real fields are accepted.
createProjectMock({ name: 'Acme' });
createPromptMock({ is_new: true, tags: [] });
createProjectAiModelMock({ model: createAiModelMock({ name: 'Claude' }) });

// 3. Unknown fields are rejected — this is the `workspace_id` drift that slipped past
//    hand-authored literals. If ProjectResponse ever gains workspace_id, this stops erroring.
// @ts-expect-error — workspace_id is not part of ProjectResponse.
createProjectMock({ workspace_id: 'not-a-real-field' });

// 4. Wrong field types are rejected.
// @ts-expect-error — prompts_count is a number, not a string.
createProjectAiModelMock({ prompts_count: 'zero' });

// 5. Overlay CR5 made the identity fields required: the factory outputs satisfy them as
//    non-optional `string`. If CR5 were dropped (fields back to optional), `id` would be
//    `string | undefined` and these assignments would fail.
const ids: string[] = [project.id, assigned.id, prompt.id, model.id];
const names: string[] = [project.name, prompt.name];
void ids;
void names;
