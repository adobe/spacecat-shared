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
 * Compile-only type test for the PUBLIC `ProjectEngineApiError` surface (`src/index.d.ts`). It is
 * type-checked by `npm run test:types` (tsc --noEmit); it emits nothing and is not run by mocha.
 */

import { ProjectEngineApiError } from '../../src/index.js';

// 1. It is importable from the public entry and is an Error subclass.
const err = new ProjectEngineApiError(404, 'GET', { detail: 'nope' });
const asError: Error = err;
void asError;

// 2. `status` is `number | undefined` — assignable to that union, and `undefined` is a valid arg.
const status: number | undefined = err.status;
void status;
const networkErr = new ProjectEngineApiError(undefined, 'GET', null, {
  cause: new Error('down'),
});
void networkErr;

// 3. `method` is a string.
const method: string = err.method;
void method;

// 4. `body` is `unknown` — usable only after narrowing (so it is NOT `any`).
const body: unknown = err.body;
void body;
// @ts-expect-error — `body` is `unknown`, not `any`: property access must be narrowed first.
void err.body.detail;

// 5. Canary: a bogus field must be rejected (proves the class is precisely typed, not `any`).
// @ts-expect-error — `frobnicate` is not a field of ProjectEngineApiError.
void err.frobnicate;
