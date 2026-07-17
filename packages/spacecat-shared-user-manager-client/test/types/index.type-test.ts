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

/**
 * Compile-only proof that the public type surface stays assignable to `Client<paths>` and does not
 * silently degrade to `any` (the package's deliverable). Type-checked by `npm run test:types`
 * (tsc --noEmit); emits nothing. NOT run by mocha.
 */

import type { Client } from 'openapi-fetch';
import { createSerenityUserManagerApiClient } from '../../src/index.js';
import type { paths, components, SerenityUserManagerApiClient } from '../../src/index.js';

// 1. The factory returns a client assignable to the generic Client<paths> and the public alias.
const client = createSerenityUserManagerApiClient({ baseUrl: 'http://localhost', authToken: 't' });
const asGeneric: Client<paths> = client;
const asAlias: SerenityUserManagerApiClient = asGeneric;
void asAlias;

// 2. A real generated operation resolves with typed path params (not `any`). CR1 removed the
//    Auth-Data-Jwt header from the surface — callers do not (and cannot) pass it.
async function typedCall(): Promise<void> {
  const { data } = await client.GET('/v1/workspaces/{id}/status', {
    params: { path: { id: 'ws-1' } },
  });
  void data;
}
void typedCall;

// 3. Canary for "the type surface collapsed to `any`". A bogus path MUST be rejected by the typed
//    client; if `paths` became `any`, this would type-check and the directive itself would error.
// @ts-expect-error — an unknown path is not part of the generated contract.
client.GET('/this/path/is/not/in/the/spec', {});

// 4. The re-exported contract types are present and not `any`.
// @ts-expect-error — a bogus component key must be rejected.
type _BogusComponent = components['schemas']['__does_not_exist__'];
