/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const read = (rel) => readFileSync(resolve(pkgRoot, rel), 'utf-8');

describe('Project Engine foundation: vendored spec', () => {
  const spec = read('spec/projectengine_swagger_public.yaml');

  it('is the vendored Swagger 2.0 file', () => {
    expect(spec).to.match(/^swagger:\s*['"]?2\.0['"]?/m);
  });

  it('declares the Project Engine basePath', () => {
    expect(spec).to.include('basePath: /enterprise/projects/api');
  });

  // The spec models the Semrush-native Auth-Data-Jwt header as a per-operation param. The client
  // does NOT send it — it sends Authorization: Bearer, which Semrush accepts directly — so the
  // client's typed surface narrows it out; the vendored contract keeps it.
  it('carries the Semrush-native Auth-Data-Jwt header param in the vendored spec', () => {
    expect(spec).to.include('name: Auth-Data-Jwt');
  });
});

describe('Project Engine foundation: generated TypeScript types', () => {
  // Committed in its own commit, marked linguist-generated (see .gitattributes).
  const types = read('src/generated/types.ts');

  it('exposes the openapi-typescript paths interface', () => {
    expect(types).to.match(/export interface paths/);
  });

  it('includes a known v1 path from the spec', () => {
    expect(types).to.include('/v1/countries');
  });

  it('includes a known v2 path from the spec', () => {
    expect(types).to.include('/v2/workspaces/{id}/projects');
  });
});

describe('Project Engine foundation: overlay guard', () => {
  const types = read('src/generated/types.ts');

  it('exposes GET /v1/ai_models on the typed surface (CR1)', () => {
    expect(types).to.include('/v1/ai_models');
  });

  it('has no Auth-Data-Jwt header in generated types (CR2)', () => {
    expect(types).to.not.include('Auth-Data-Jwt');
  });
});
