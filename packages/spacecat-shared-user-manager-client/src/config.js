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
 * Env var the future User Manager client/transport will read for its base URL,
 * mirroring `SEMRUSH_PROJECTS_BASE_URL` (Project Engine). Semantics: required,
 * no default, origin-only. For local dev / E2E point it at the mock
 * (e.g. `http://localhost:4010`); the transport must allow `http` for localhost
 * since the mock is not behind TLS.
 *
 * Defined here (not only in the README) so LLMO-5615 finds it in review.
 */
export const USER_MANAGER_BASE_URL_ENV = 'SEMRUSH_USERS_BASE_URL';
