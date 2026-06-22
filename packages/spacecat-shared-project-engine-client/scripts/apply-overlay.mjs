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
 * Applies spec/overlays/adobe-gateway.yaml corrections to build/openapi3.json in-place.
 * Operates on the post-swagger2openapi OAS 3.0 artifact only — the vendored
 * spec/projectengine_swagger_public.yaml is never touched.
 *
 * CR1  Add GET /v1/ai_models — live endpoint absent from vendored spec.
 *      Remove when Semrush ships the path in the upstream swagger.
 * CR2  Express Authorization: Bearer as the auth scheme; remove Auth-Data-Jwt.
 *      Remove when Semrush fixes securityDefinitions upstream.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const specPath = resolve(pkgRoot, 'build/openapi3.json');

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));

// ── CR1: Add GET /v1/ai_models ────────────────────────────────────────────
// Live: 200 → { page:int, total:int, items:[AIModelResponse] }
// Verified: GET /v1/ai_models?page=1&limit=100 → 200 (rainer-friederich, 2026-06-15)
// Remove when Semrush adds the path to the upstream swagger.

spec.components ??= {};
spec.components.schemas ??= {};

spec.components.schemas['model.AIModelListResponse'] = {
  type: 'object',
  properties: {
    page: { type: 'integer' },
    total: { type: 'integer' },
    items: {
      type: 'array',
      items: { $ref: '#/components/schemas/model.AIModelResponse' },
    },
  },
};

spec.paths['/v1/ai_models'] = {
  get: {
    summary: 'List global AI model catalog',
    description:
      'Global catalog of all AI models available for tracking across any workspace. '
      + 'Not scoped to a workspace or project.',
    operationId: 'ai-list-global-models',
    tags: ['AIO'],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ],
    responses: {
      200: {
        description: 'OK',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/model.AIModelListResponse' },
          },
        },
      },
      401: {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/http_server.BasicResponse' },
          },
        },
      },
    },
    security: [{ imsBearer: [] }],
  },
};

// ── CR2: Express Authorization: Bearer as auth scheme ────────────────────
// Live gateway: Authorization: Bearer <IMS> → 200; Auth-Data-Jwt → 401.
// Verified: rainer-friederich probe 2026-06-15; rest-transport.js buildHeaders().
// Remove when Semrush fixes securityDefinitions in the upstream swagger.

spec.components.securitySchemes = {
  imsBearer: {
    type: 'http',
    scheme: 'bearer',
    description:
      'IMS user bearer token. The Adobe gateway authenticates the bearer and '
      + 'exchanges it for Semrush credentials server-side.',
  },
};

spec.security = [{ imsBearer: [] }];

// Remove the bogus Auth-Data-Jwt header param from every operation.
for (const pathItem of Object.values(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (method === 'parameters' || typeof operation !== 'object') continue;
    if (!Array.isArray(operation.parameters)) continue;
    operation.parameters = operation.parameters.filter(
      (p) => !(p.in === 'header' && p.name === 'Auth-Data-Jwt'),
    );
  }
}

writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');
console.log(`✔ overlay applied → ${specPath}`);
