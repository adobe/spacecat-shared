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
 * E2E: drives the real {@link createSerenityProjectEngineApiClient} against a live Counterfact
 * mock booted by `src/mock/run.js`. Scoped to this package — it exercises the client<->mock
 * contract directly, with no api-service routes (that wiring lands with the adoption PR).
 *
 * Gated behind `MOCK_E2E=1` (set by `npm run test:e2e`) and kept out of the default
 * `npm test` glob (`*.e2e.js`, not `*.test.js`), so the unit suite stays fast and the 100%
 * coverage path takes no live-server dependency. Booting Counterfact requires a one-time
 * transpile, so the suite allows a generous startup budget.
 */

import { expect } from 'chai';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSerenityProjectEngineApiClient } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const RUNNER = join(packageRoot, 'src', 'mock', 'run.js');

const PORT = process.env.MOCK_E2E_PORT ?? '4099';
const BASE_URL = `http://localhost:${PORT}/enterprise/projects/api`;
const READY_TIMEOUT_MS = 30_000;
const SEED_WORKSPACE = 'ws-1';
const SEED_PROJECT = 'pr-1';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Polls the mock until it answers a seeded request 200, or throws after the budget. */
/* eslint-disable no-await-in-loop -- sequential readiness polling is intentional. */
async function waitForReady(deadline) {
  for (;;) {
    try {
      const res = await fetch(`${BASE_URL}/v1/workspaces/${SEED_WORKSPACE}/projects`);
      if (res.ok) {
        return;
      }
    } catch {
      // server not up yet
    }
    if (Date.now() > deadline) {
      throw new Error('mock did not become ready in time');
    }
    await sleep(250);
  }
}
/* eslint-enable no-await-in-loop */

(process.env.MOCK_E2E === '1' ? describe : describe.skip)('Project Engine mock — client E2E', function suite() {
  this.timeout(READY_TIMEOUT_MS + 15_000);

  /** @type {import('node:child_process').ChildProcess} */
  let server;
  /** @type {ReturnType<typeof createSerenityProjectEngineApiClient>} */
  let client;

  before(async () => {
    // detached so we can signal the whole process group (run.js spawns Counterfact as a child).
    server = spawn(process.execPath, [RUNNER], {
      cwd: packageRoot,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, MOCK_PORT: PORT },
    });
    await waitForReady(Date.now() + READY_TIMEOUT_MS);
    client = createSerenityProjectEngineApiClient({ baseUrl: BASE_URL, authToken: 'e2e-token' });
  });

  after(() => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        server.kill('SIGTERM');
      }
    }
  });

  // Restore the seed before each case so they are order-independent.
  beforeEach(async () => {
    await fetch(`${BASE_URL}/__reset`, { method: 'POST' });
  });

  it('lists the seeded project', async () => {
    const { data, error } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(error).to.equal(undefined);
    expect(data.total).to.equal(1);
    expect(data.items[0].id).to.equal(SEED_PROJECT);
  });

  it('creates a project and reads it back', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'E2E Project' },
    });
    expect(created.id).to.be.a('string');

    const { data: fetched } = await client.GET('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
    });
    expect(fetched.name).to.equal('E2E Project');

    const { data: list } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(list.total).to.equal(2);
  });

  it('patches a project', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Before' },
    });
    const { data: patched } = await client.PATCH('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
      body: { name: 'After' },
    });
    expect(patched.name).to.equal('After');
  });

  it('deletes a project (404 on subsequent read)', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Doomed' },
    });
    await client.DELETE('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
    });
    const { error, response } = await client.GET('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
    });
    expect(response.status).to.equal(404);
    expect(error).to.not.equal(undefined);
  });

  it('lists and adds ai_models on the seeded project', async () => {
    const { data: before } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(before.total).to.equal(1);

    await client.POST('/v1/workspaces/{id}/projects/{project_id}/ai_models', {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { model_id: 'gpt-4o' },
    });

    const { data: after } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(after.total).to.equal(2);
  });

  it('creates aio prompts (v2)', async () => {
    const { data, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { items: ['What is X?', 'Tell me Y'] },
      },
    );
    expect(error).to.equal(undefined);
    expect(data.name).to.equal('What is X?');
  });

  it('__reset restores the seed between mutations', async () => {
    await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Transient' },
    });
    await fetch(`${BASE_URL}/__reset`, { method: 'POST' });
    const { data } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(data.total).to.equal(1);
    expect(data.items[0].id).to.equal(SEED_PROJECT);
  });
});
