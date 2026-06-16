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

describe('User Manager foundation: vendored spec', () => {
  const spec = read('spec/usermanager_swagger.yaml');

  it('is the vendored Swagger 2.0 file', () => {
    expect(spec).to.match(/^swagger:\s*['"]?2\.0['"]?/m);
  });

  it('declares the User Manager basePath', () => {
    expect(spec).to.include('basePath: /enterprise/users/api');
  });

  it('carries the Auth-Data-Jwt parameter (vendor spec artifact — gateway uses Authorization: Bearer)', () => {
    // The spec models this as a required header on ~187 ops, but the live Adobe gateway
    // authenticates on Authorization: Bearer only. An overlay to strip it lands in a follow-up.
    expect(spec).to.include('name: Auth-Data-Jwt');
  });
});

describe('User Manager foundation: generated TypeScript types', () => {
  // Committed in its own commit, marked linguist-generated (see .gitattributes).
  const types = read('src/generated/types.ts');

  it('exposes the openapi-typescript paths interface', () => {
    expect(types).to.match(/export interface paths/);
  });

  it('includes the workspace routes the serenity integration exercises', () => {
    expect(types).to.include('/workspaces/');
  });

  it('includes a v2 workspace child-creation path', () => {
    expect(types).to.include('/v2/workspaces/{id}/child');
  });

  it('includes a v1 workspace status path', () => {
    expect(types).to.include('/v1/workspaces/{id}/status');
  });
});
