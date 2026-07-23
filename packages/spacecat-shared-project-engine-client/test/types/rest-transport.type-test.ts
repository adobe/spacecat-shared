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
 * Compile-only type test for the transport facade's PUBLIC surface (`src/index.d.ts`). The
 * `.d.ts` is hand-written and derives every method's params + return from the generated `paths`,
 * so it can silently drift into `any`. This fixture is type-checked by `npm run test:types`
 * (tsc --noEmit); it emits nothing and is not run by mocha.
 */

import {
  createSerenityProjectEngineTransport,
} from '../../src/index.js';
import type {
  components,
  SerenityProjectEngineTransport,
} from '../../src/index.js';

// Detects a type collapsing to `any` — `0 extends (1 & T)` is only true for `any`.
type IsAny<T> = 0 extends (1 & T) ? true : false;
// Compile error unless the argument is exactly `false` (i.e. the checked type is NOT `any`).
type AssertNotAny<T> = IsAny<T> extends false ? true : false;

// 1. The factory returns the declared transport type (same options as the raw client).
const transport: SerenityProjectEngineTransport = createSerenityProjectEngineTransport({
  baseUrl: 'http://localhost:4010',
  authToken: 'token',
});

// 2a. A GET with path params: params are typed and the return is the operation's 2xx body | null.
async function typedGet(): Promise<void> {
  const project = await transport.getProject({
    // `query.draft` is REQUIRED by the generated contract — omitting it is a compile error,
    // which itself proves the params are precisely typed (not `any`).
    params: { path: { id: 'ws-1', project_id: 'p-1' }, query: { draft: 'true' } },
  });
  // Return is precisely `model.ProjectResponse | null`, not `any`.
  const asProject: components['schemas']['model.ProjectResponse'] | null = project;
  void asProject;
}
void typedGet;
// The return type must NOT be `any` (would erase all safety).
type _GetNotAny = AssertNotAny<
  Awaited<ReturnType<SerenityProjectEngineTransport['getProject']>>
>;

// 2b. A POST with a request body: body is typed, return is the 2xx body | null.
async function typedPost(): Promise<void> {
  const created = await transport.createProject({
    params: { path: { id: 'ws-1' } },
    body: { name: 'My Project' } as components['schemas']['model.ProjectRequest'],
  });
  const asProject: components['schemas']['model.ProjectResponse'] | null = created;
  void asProject;
}
void typedPost;
type _PostNotAny = AssertNotAny<
  Awaited<ReturnType<SerenityProjectEngineTransport['createProject']>>
>;

// 2c. A DELETE: an empty-body op resolves with `null` (never `undefined`).
async function typedDelete(): Promise<void> {
  const deleted = await transport.deleteProject({
    params: { path: { id: 'ws-1', project_id: 'p-1' } },
  });
  const asNull: null = deleted;
  void asNull;
}
void typedDelete;

// 3. Canary: a bogus method name must be rejected. If the surface degraded to `any`, this
//    would type-check and the `@ts-expect-error` would itself error ("unused directive").
// @ts-expect-error — `frobnicate` is not a facade method.
void transport.frobnicate;

// 4. Canary: a required path param cannot be omitted — proves params are typed, not `any`.
// @ts-expect-error — getProject's path requires both `id` and `project_id`.
void transport.getProject({ params: { path: { id: 'ws-1' } } });

// 5. Canary: a required request body cannot be omitted on createProject.
// @ts-expect-error — POST createProject requires a `body`.
void transport.createProject({ params: { path: { id: 'ws-1' } } });

// Reference the AssertNotAny aliases so they are not flagged as unused.
type _Assertions = [_GetNotAny, _PostNotAny];
const _assertionsHold: _Assertions = [true, true];
void _assertionsHold;
