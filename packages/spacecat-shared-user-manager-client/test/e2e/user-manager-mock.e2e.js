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
 * E2E: drives the real {@link createSerenityUserManagerApiClient} against a live Counterfact mock
 * booted by `mock/run.js`. Scoped to this package — exercises the client<->mock contract directly
 * (the sub-workspace lifecycle the api-service transport calls), with no api-service routes.
 *
 * Gated behind `MOCK_E2E=1` (set by `npm run test:e2e`) and kept out of the default `npm test` glob
 * (`*.e2e.js`, not `*.test.js`), so the unit suite stays fast and the 100% coverage path takes no
 * live-server dependency. Booting Counterfact requires a one-time transpile, so the suite allows a
 * generous startup budget.
 */

import { expect } from 'chai';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSerenityUserManagerApiClient } from '../../src/index.js';
import { buildSeed, SEED_IDS } from '../../mock/seeds.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const RUNNER = join(packageRoot, 'mock', 'run.js');

const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const PARENT = SEED_IDS.parentWorkspaceId;
const CHILD = SEED_IDS.childWorkspaceId;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Binds an OS-assigned port, then releases it and hands back the number. Avoids a hardcoded port
 * that could collide with a stray server or a sibling CI job. Honour `MOCK_E2E_PORT` when set.
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
async function waitForReady(apiBase, deadline, getStderr) {
  for (;;) {
    try {
      const res = await fetch(`${apiBase}/v1/workspaces/${PARENT}/status`, {
        headers: { Authorization: 'Bearer readiness-probe' },
      });
      if (res.ok) {
        return;
      }
    } catch {
      // server not up yet
    }
    if (Date.now() > deadline) {
      const tail = (getStderr?.() ?? '').slice(-2000).trim();
      throw new Error(`mock did not become ready in time${tail ? `; server stderr:\n${tail}` : ''}`);
    }
    await sleep(250);
  }
}
/* eslint-enable no-await-in-loop */

(process.env.MOCK_E2E === '1' ? describe : describe.skip)('User Manager mock — client E2E', function suite() {
  this.timeout(READY_TIMEOUT_MS + 15_000);

  /** @type {import('node:child_process').ChildProcess} */
  let server;
  let apiBase;
  /** @type {ReturnType<typeof createSerenityUserManagerApiClient>} */
  let client;
  let serverStderr = '';
  let serverExited = false;

  before(async () => {
    const port = await pickPort();
    const origin = `http://127.0.0.1:${port}`;
    apiBase = `${origin}/enterprise/users/api`;
    serverStderr = '';
    serverExited = false;
    server = spawn(process.execPath, [RUNNER], {
      cwd: packageRoot,
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, MOCK_PORT: String(port) },
    });
    server.stderr.on('data', (chunk) => {
      serverStderr += chunk.toString();
    });
    server.once('exit', () => {
      serverExited = true;
    });
    await waitForReady(apiBase, Date.now() + READY_TIMEOUT_MS, () => serverStderr);
    // The client takes the ORIGIN and appends the /enterprise/users/api prefix itself.
    client = createSerenityUserManagerApiClient({ baseUrl: origin, authToken: 'e2e-token' });
  });

  after(async () => {
    if (!server?.pid) {
      return;
    }
    const exited = new Promise((resolve) => {
      server.once('exit', resolve);
    });
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
    await Promise.race([exited, sleep(SHUTDOWN_TIMEOUT_MS)]);
    if (!serverExited) {
      try {
        process.kill(-server.pid, 'SIGKILL');
      } catch {
        server.kill('SIGKILL');
      }
    }
  });

  // Restore the seed before each case so they are order-independent.
  beforeEach(async () => {
    if (serverExited) {
      throw new Error('mock server exited before this test ran — see its stderr above');
    }
    await fetch(`${apiBase}/__reset`, { method: 'POST' });
  });

  it('reads the seeded child status as created', async () => {
    const { data, error } = await client.GET('/v1/workspaces/{id}/status', {
      params: { path: { id: CHILD } },
    });
    expect(error).to.equal(undefined);
    expect(data.status).to.equal('created');
  });

  it('lists the family as a top-level array (parent + child)', async () => {
    const { data, error } = await client.GET('/v1/workspaces/{id}/family', {
      params: { path: { id: PARENT } },
    });
    expect(error).to.equal(undefined);
    expect(data).to.be.an('array');
    expect(data.map((w) => w.id)).to.have.members([PARENT, CHILD]);
  });

  it('creates a sub-workspace, then status + family reflect it', async () => {
    const { data: created, error } = await client.POST('/v2/workspaces/{id}/child', {
      params: { path: { id: PARENT } },
      body: { title: 'E2E Brand [e2e00001]', resources: { ai: { projects: 1, prompts: 500 } } },
    });
    expect(error).to.equal(undefined);
    expect(created.id).to.be.a('string');
    expect(created.parent_id).to.equal(PARENT);
    expect(created.status).to.equal('created');

    const { data: status } = await client.GET('/v1/workspaces/{id}/status', {
      params: { path: { id: created.id } },
    });
    expect(status.status).to.equal('created');

    const { data: family } = await client.GET('/v1/workspaces/{id}/family', {
      params: { path: { id: PARENT } },
    });
    expect(family.map((w) => w.id)).to.include(created.id);
  });

  it('polls a deterministic not-ready → created settle (__status control)', async () => {
    await fetch(`${apiBase}/__status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: CHILD, pending: 2 }),
    });
    const poll = () => client.GET('/v1/workspaces/{id}/status', { params: { path: { id: CHILD } } })
      .then((r) => r.data.status);
    expect(await poll()).to.equal('not ready');
    expect(await poll()).to.equal('not ready');
    expect(await poll()).to.equal('created');
  });

  it('transfers resources onto the child (200 returns the updated workspace — CR4)', async () => {
    const { data, error } = await client.POST('/v2/workspaces/{id}/resources/transfer', {
      params: { path: { id: CHILD } },
      body: { resources: { ai: { projects: 2, prompts: 1000 } } },
    });
    expect(error).to.equal(undefined);
    // Live returns the updated child workspaceResponse (CR4), not a WorkspaceResourcesV2 envelope.
    expect(data.id).to.equal(CHILD);
    expect(data.status).to.equal('created');
  });

  it('deletes the child (cascade) → subsequent reads 403', async () => {
    const { data, error } = await client.DELETE('/v1/workspaces/{id}', {
      params: { path: { id: CHILD } },
    });
    expect(error).to.equal(undefined);
    expect(data.id).to.equal(CHILD);

    const { error: readError, response } = await client.GET('/v1/workspaces/{id}/status', {
      params: { path: { id: CHILD } },
    });
    expect(response.status).to.equal(403);
    // Pin the live 403 envelope string (the handler is coverage-excluded — assert it here).
    expect(readError).to.deep.equal({ message: 'invalid access attempt' });
  });

  it('403s a child create under an unknown parent (no silent orphan)', async () => {
    const ghostParent = globalThis.crypto.randomUUID();
    const { error, response } = await client.POST('/v2/workspaces/{id}/child', {
      params: { path: { id: ghostParent } },
      body: { title: 'Orphan [e2e00003]', resources: { ai: { projects: 1, prompts: 500 } } },
    });
    expect(response.status).to.equal(403);
    expect(error).to.deep.equal({ message: 'invalid access attempt' });
  });

  it('draws the parent pool down on a successful create (second create exhausts it)', async () => {
    // One project of headroom; prompts left effectively unlimited so projects is the binding dim.
    await fetch(`${apiBase}/__quota`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: PARENT, projects: 1, prompts: 100000 }),
    });
    const first = await client.POST('/v2/workspaces/{id}/child', {
      params: { path: { id: PARENT } },
      body: { title: 'First [e2e00004]', resources: { ai: { projects: 1, prompts: 500 } } },
    });
    expect(first.error).to.equal(undefined);
    expect(first.data.parent_id).to.equal(PARENT);
    // The draw must have persisted: the pool now has 0 projects, so the next create 422s.
    const second = await client.POST('/v2/workspaces/{id}/child', {
      params: { path: { id: PARENT } },
      body: { title: 'Second [e2e00005]', resources: { ai: { projects: 1, prompts: 500 } } },
    });
    expect(second.response.status).to.equal(422);
    expect(second.error).to.deep.equal({ message: 'insufficient available units' });
  });

  it('rejects an unauthenticated request with 401 { detail }', async () => {
    const res = await fetch(`${apiBase}/v1/workspaces/${CHILD}/status`);
    expect(res.status).to.equal(401);
    expect(await res.json()).to.deep.equal({ detail: 'Not authenticated' });
  });

  it('422s a child create when the parent pool is exhausted (__quota control)', async () => {
    await fetch(`${apiBase}/__quota`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: PARENT, projects: 0, prompts: 0 }),
    });
    const { error, response } = await client.POST('/v2/workspaces/{id}/child', {
      params: { path: { id: PARENT } },
      body: { title: 'Over budget [e2e00002]', resources: { ai: { projects: 1, prompts: 500 } } },
    });
    expect(response.status).to.equal(422);
    // Pin the live 422 envelope string (the handler is coverage-excluded — assert it here).
    expect(error).to.deep.equal({ message: 'insufficient available units' });
  });

  it('404s an unmodelled path (serve-only — no random stubs)', async () => {
    const res = await fetch(`${apiBase}/v1/workspaces/${PARENT}/members`, {
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).to.equal(404);
  });

  it('__dump exposes the current store state', async () => {
    const res = await fetch(`${apiBase}/__dump`);
    expect(res.ok).to.equal(true);
    const state = await res.json();
    expect(state.workspaces.map((w) => w.id)).to.have.members([PARENT, CHILD]);
  });

  it('__seed loads a DB-shaped snapshot the typed client then reads back', async () => {
    const seededParent = globalThis.crypto.randomUUID();
    const seededChild = globalThis.crypto.randomUUID();
    const snapshot = buildSeed({
      workspaces: [
        { id: seededParent, title: 'Harness Parent', parentId: '' },
        { id: seededChild, title: 'Harness Child', parentId: seededParent },
      ],
    });
    const res = await fetch(`${apiBase}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    expect(res.ok).to.equal(true);

    const { data: family } = await client.GET('/v1/workspaces/{id}/family', {
      params: { path: { id: seededParent } },
    });
    expect(family.map((w) => w.id)).to.have.members([seededParent, seededChild]);

    // the previous seed's child is gone (seed replaces state).
    const { response } = await client.GET('/v1/workspaces/{id}/status', {
      params: { path: { id: CHILD } },
    });
    expect(response.status).to.equal(403);

    // restore the boot seed so this case stays order-independent.
    await fetch(`${apiBase}/__reset`, { method: 'POST' });
  });
});
