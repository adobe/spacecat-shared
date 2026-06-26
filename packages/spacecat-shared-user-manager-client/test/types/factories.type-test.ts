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
 * Compile-only proof that the mock factories produce spec-shaped entities, derived from the
 * overlayed schema. Type-checked by `npm run test:types`; emits nothing. This is the guard that
 * the "mock factory pattern" actually enforces shape — if a factory or the generated types drift,
 * the build fails here. NOT run by mocha.
 */

import {
  createWorkspaceMock,
  createWorkspaceStatusMock,
  createWorkspaceDeleteResponseMock,
  createBasicResponseMock,
} from '../../mock/factories.js';
import type { components } from '../../src/index.js';

type Workspace = components['schemas']['handlers.workspaceResponse'];
type WorkspaceStatus = components['schemas']['handlers.WorkspaceCheckResponse'];
type WorkspaceDeleteResponse = components['schemas']['handlers.workspaceDeleteResponse'];
type BasicResponse = components['schemas']['http_server.BasicResponse'];

// 1. Each factory returns exactly its spec type (assignable).
const ws: Workspace = createWorkspaceMock();
const status: WorkspaceStatus = createWorkspaceStatusMock();
const del: WorkspaceDeleteResponse = createWorkspaceDeleteResponseMock();
const basic: BasicResponse = createBasicResponseMock();
void ws;
void status;
void del;
void basic;

// 2. Overrides are a typed Partial — a valid field narrows, a wrong type / unknown field fails.
createWorkspaceMock({ title: 'Brand', status: 'not ready', parent_id: 'p' });
// @ts-expect-error — status is a string, not a number.
createWorkspaceMock({ status: 123 });
// @ts-expect-error — an unknown field is rejected (excess property check).
createWorkspaceMock({ not_a_field: true });

// 3. Canary for "the schema surface collapsed to `any`".
// @ts-expect-error — a bogus component key must be rejected.
type _Bogus = components['schemas']['__does_not_exist__'];
