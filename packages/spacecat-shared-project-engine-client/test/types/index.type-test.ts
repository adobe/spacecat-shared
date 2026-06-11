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
 * Compile-only type test for the package's PUBLIC surface (`src/index.d.ts`). The typed
 * client is this package's deliverable, and the `.d.ts` is hand-written — so it can silently
 * drift from both the implementation and the generated `paths`, handing consumers `any`. The
 * unit and E2E suites are blind to that. This fixture is type-checked by `npm run test:types`
 * (tsc --noEmit) in CI, scoped to the same path-gated job as the E2E, so drift fails the build.
 *
 * It is NOT run by mocha and emits nothing — it exists purely to be compiled.
 */

import type { Client } from 'openapi-fetch';
import {
  createSerenityProjectEngineApiClient,
} from '../../src/index.js';
import type {
  paths,
  components,
  SerenityProjectEngineApiClient,
} from '../../src/index.js';

// 1. The factory returns the declared client type.
const client: SerenityProjectEngineApiClient = createSerenityProjectEngineApiClient({
  baseUrl: 'http://localhost:4010/enterprise/projects/api',
  authToken: 'token',
});

// 2. The client is exactly `Client<paths>` — assignable in both directions.
const asGeneric: Client<paths> = client;
const asAlias: SerenityProjectEngineApiClient = asGeneric;
void asAlias;

// 3. A real generated operation resolves with typed path params (not `any`). If `paths`
//    degraded, the body/response below would lose their shape — and the bogus-path canary
//    in (4) would stop erroring.
//
//    NOTE: the generated spec marks `Auth-Data-Jwt` as a REQUIRED header param on each
//    operation, so the typed surface demands it per call even though the client injects it
//    at runtime via middleware. This fixture passes it to match today's published surface;
//    if/when the client's typed surface is narrowed to omit the injected header (a DX
//    improvement tracked separately), drop it here and this assertion still guards the rest.
async function typedCall(): Promise<void> {
  const { data } = await client.GET('/v1/workspaces/{id}/projects', {
    params: { path: { id: 'ws-1' }, header: { 'Auth-Data-Jwt': 'token' } },
  });
  void data;
}
void typedCall;

// 4. Canary for "the type surface collapsed to `any`". A bogus path MUST be rejected by the
//    typed client; if `paths` became `any`, this call would type-check and the
//    `@ts-expect-error` would itself error ("unused directive"), failing the build.
// @ts-expect-error — an unknown path is not part of the generated contract.
client.GET('/this/path/is/not/in/the/spec', {});

// 5. The re-exported contract types are present and not `any`.
//    `@ts-expect-error` here fails the build if `components` ever resolves to `any`.
// @ts-expect-error — a bogus component key must be rejected.
type _BogusComponent = components['schemas']['__does_not_exist__'];
