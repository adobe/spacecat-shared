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
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const read = (rel) => readFileSync(resolve(pkgRoot, rel), 'utf-8');
const readBytes = (rel) => readFileSync(resolve(pkgRoot, rel));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const VENDORED_SPEC = 'spec/usermanager_swagger.yaml';
const SPEC_CHECKSUM = 'spec/usermanager_swagger.yaml.sha256';

describe('User Manager foundation: vendored spec', () => {
  const spec = read('spec/usermanager_swagger.yaml');

  it('is the vendored Swagger 2.0 file', () => {
    expect(spec).to.match(/^swagger:\s*['"]?2\.0['"]?/m);
  });

  it('declares the User Manager basePath', () => {
    expect(spec).to.include('basePath: /enterprise/users/api');
  });

  // The spec models the Semrush-native Auth-Data-Jwt header as a required param on ~187 ops.
  // The live API does NOT accept it — it authenticates on Authorization: Bearer <IMS>, which
  // Semrush accepts directly — so the corrections overlay (CR1) strips it from the generated
  // surface. The vendored contract keeps it untouched for faithful re-vendoring.
  it('carries the Semrush-native Auth-Data-Jwt header param in the vendored spec', () => {
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

describe('User Manager foundation: corrections overlay guard', () => {
  // These pin the corrections in spec/overlays/corrections.yaml against the generated
  // surface, so a future Semrush spec refresh that silently drops the overlay fails
  // loudly here instead of regressing the typed contract.
  const types = read('src/generated/types.ts');

  it('strips the Auth-Data-Jwt header from the generated types (CR1)', () => {
    // The live API authenticates on Authorization: Bearer <IMS>, accepted directly by
    // Semrush; the upstream Auth-Data-Jwt header is rejected and must not survive.
    expect(types).to.not.include('Auth-Data-Jwt');
  });

  it('types GET /v1/workspaces/{id}/status as a single object, not an array (CR2)', () => {
    // The live API returns a bare WorkspaceCheckResponse object ({ status: ... }); the
    // upstream spec wrongly wrapped it in an array. The array form must not survive.
    expect(types).to.include('components["schemas"]["handlers.WorkspaceCheckResponse"]');
    expect(types).to.not.include('components["schemas"]["handlers.WorkspaceCheckResponse"][]');
  });
});

// LLMO-5976: spec-verify gate. The vendored Semrush swagger stays byte-for-byte; a committed
// SHA-256 of it is verified here. Any re-vendor changes the bytes, so this test FAILS until a
// human reviews the diff and updates the committed checksum in the SAME PR. A re-vendor is inert
// (silent drift is impossible) until the recorded hash is bumped. To bump after a REVIEWED
// re-vendor, run `shasum -a 256 <spec>` on the vendored spec and paste the digest into
// spec/usermanager_swagger.yaml.sha256.
describe('User Manager foundation: vendored-spec checksum gate (LLMO-5976)', () => {
  const committed = read(SPEC_CHECKSUM).trim();

  it('committed checksum is a bare SHA-256 hex digest', () => {
    expect(committed).to.match(/^[0-9a-f]{64}$/);
  });

  it('vendored spec hash matches the committed checksum (fails on unreviewed re-vendor)', () => {
    const actual = sha256(readBytes(VENDORED_SPEC));
    const msg = 'vendored spec drifted from the committed checksum'
      + ' — review the re-vendor and update the .sha256';
    expect(actual, msg).to.equal(committed);
  });

  it('detects a byte-for-byte mismatch (proves the gate would fail on drift)', () => {
    // Tamper with the vendored bytes in memory only — one extra byte must change the digest,
    // so a real re-vendor cannot slip past the equality check above.
    const tampered = Buffer.concat([readBytes(VENDORED_SPEC), Buffer.from([0])]);
    expect(sha256(tampered)).to.not.equal(committed);
  });
});
