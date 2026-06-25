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
 * mock booted by `mock/run.js`. Scoped to this package — it exercises the client<->mock
 * contract directly, with no api-service routes (that wiring lands with the adoption PR).
 *
 * Gated behind `MOCK_E2E=1` (set by `npm run test:e2e`) and kept out of the default
 * `npm test` glob (`*.e2e.js`, not `*.test.js`), so the unit suite stays fast and the 100%
 * coverage path takes no live-server dependency. Booting Counterfact requires a one-time
 * transpile, so the suite allows a generous startup budget.
 */

import { expect } from 'chai';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSerenityProjectEngineApiClient } from '../../src/index.js';
import { buildSeed, SEEDS, SEED_IDS } from '../../mock/seeds.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const RUNNER = join(packageRoot, 'mock', 'run.js');

const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const SEED_WORKSPACE = SEED_IDS.workspaceId;
const SEED_PROJECT = SEED_IDS.projectId;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Binds an OS-assigned port, then releases it and hands back the number. Avoids a hardcoded
 * port that could collide with a stray local server or a sibling CI job on the same runner.
 * The bind/close/reuse window is a small race, acceptable for a single-process test boot.
 * Honour `MOCK_E2E_PORT` when set so a developer can pin a port for manual debugging.
 */
function pickPort() {
  if (process.env.MOCK_E2E_PORT) {
    return Promise.resolve(Number(process.env.MOCK_E2E_PORT));
  }
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Polls the mock until it answers a seeded request 200, or throws after the budget. */
/* eslint-disable no-await-in-loop -- sequential readiness polling is intentional. */
async function waitForReady(baseUrl, deadline) {
  for (;;) {
    try {
      const res = await fetch(`${baseUrl}/v1/workspaces/${SEED_WORKSPACE}/projects`);
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
  /** @type {string} */
  let baseUrl;
  /** @type {ReturnType<typeof createSerenityProjectEngineApiClient>} */
  let client;

  before(async () => {
    const port = await pickPort();
    baseUrl = `http://localhost:${port}/enterprise/projects/api`;
    // detached so we can signal the whole process group (run.js spawns Counterfact as a child).
    server = spawn(process.execPath, [RUNNER], {
      cwd: packageRoot,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, MOCK_PORT: String(port) },
    });
    // If readiness times out, `server` is already assigned, so after() still tears it down
    // (mocha runs after-hooks even when a before-hook throws).
    await waitForReady(baseUrl, Date.now() + READY_TIMEOUT_MS);
    client = createSerenityProjectEngineApiClient({ baseUrl, authToken: 'e2e-token' });
  });

  after(async () => {
    if (!server?.pid) {
      return;
    }
    // Wait for actual exit so the port is freed before the process ends — prevents a leaked
    // server (and a port collision on the next run) if the test process is short-lived.
    const exited = new Promise((resolve) => {
      server.once('exit', resolve);
    });
    try {
      // Negative pid signals the whole detached group (Counterfact child included).
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
    await Promise.race([exited, sleep(SHUTDOWN_TIMEOUT_MS)]);
  });

  // Restore the seed before each case so they are order-independent.
  beforeEach(async () => {
    await fetch(`${baseUrl}/__reset`, { method: 'POST' });
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

  // Mirrors the real consumer (spacecat-api-service): add via the v2 route, list via v1.
  // The v2 POST writes to the same version-agnostic store key, so the v1 GET sees it.
  it('adds an ai_model via v2 and lists it back via v1', async () => {
    const { data: before } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(before.total).to.equal(1);

    const { error: addError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { model_id: SEED_IDS.aiModelId },
      },
    );
    expect(addError).to.equal(undefined);

    const { data: after } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(after.total).to.equal(2);
  });

  // Exercises the prompt write-then-read spine through the paths the real consumer uses
  // (spacecat-api-service): create via `tagged`, list via `by_tags`. Not `POST /aio/prompts`
  // (delete-only in the spec) — see mock/.../aio/prompts*.js.
  it('creates aio prompts (tagged) and lists them back (by_tags)', async () => {
    const { data: created, error: createError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { brand: ['What is X?', 'Tell me Y'] } },
      },
    );
    expect(createError).to.equal(undefined);
    expect(created.ids).to.have.length(2);
    expect(created.existing_count).to.equal(0);

    // by_tags with an empty tag_ids lists every prompt: 1 seeded + 2 created.
    const { data: listed, error: listError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { tag_ids: [] },
      },
    );
    expect(listError).to.equal(undefined);
    expect(listed.total).to.equal(3);
    expect(listed.items.map((p) => p.name)).to.include.members(['What is X?', 'Tell me Y']);
  });

  it('deletes aio prompts by id (by_tags reflects the removal)', async () => {
    const { data: created } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { brand: ['Doomed prompt'] } },
      },
    );
    await client.DELETE('/v2/workspaces/{id}/projects/{project_id}/aio/prompts', {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { ids: created.ids },
    });
    const { data: listed } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { tag_ids: [] },
      },
    );
    expect(listed.total).to.equal(1);
    expect(listed.items[0].id).to.equal(SEED_IDS.promptId);
  });

  it('__reset restores the seed between mutations', async () => {
    await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Transient' },
    });
    await fetch(`${baseUrl}/__reset`, { method: 'POST' });
    const { data } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(data.total).to.equal(1);
    expect(data.items[0].id).to.equal(SEED_PROJECT);
  });

  it('__dump exposes the current store state', async () => {
    const res = await fetch(`${baseUrl}/__dump`);
    expect(res.ok).to.equal(true);
    const state = await res.json();
    // The booted seed is workspace-with-data: one project under the seed workspace.
    expect(state[`projects:${SEED_WORKSPACE}`].map((p) => p.id)).to.include(SEED_PROJECT);
  });

  it('__seed loads a DB-shaped snapshot the typed client then reads back', async () => {
    // Real UUIDs, as the harness would inject to match its Postgres fixtures.
    const seededWorkspace = globalThis.crypto.randomUUID();
    const seededProject = globalThis.crypto.randomUUID();
    const snapshot = buildSeed({
      workspaceId: seededWorkspace,
      projects: [{ id: seededProject, name: 'From harness' }],
    });
    const res = await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    expect(res.ok).to.equal(true);

    const { data } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: seededWorkspace } },
    });
    expect(data.total).to.equal(1);
    expect(data.items[0].id).to.equal(seededProject);

    // the previous seed's workspace is gone (seed replaces state).
    const { data: old } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(old.total).to.equal(0);

    // __seed rewrites the reset baseline, so restore the boot seed to keep this case
    // order-independent (beforeEach __reset would otherwise restore to ws-seeded).
    await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SEEDS['workspace-with-data']),
    });
  });
});
