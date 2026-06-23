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

/*
 * LLMO-5616 — E2E tests for the User Manager Counterfact mock.
 *
 * Boots the mock as a child process once, exercises the stateful core chain,
 * resets between tests via the non-spec POST /__reset route, and asserts the
 * negative paths, the committed custom handlers, and the env-var constant.
 *
 * The mock logic lives in `.counterfact/**` (TypeScript compiled by Counterfact
 * at runtime), so it is exercised behaviorally here rather than via unit
 * coverage — see README "Mock architecture".
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { expect } from 'chai';

import { USER_MANAGER_BASE_URL_ENV } from '../src/config.js';

const PKG_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 4099, not the documented default 4010, so the suite never collides with a
// mock a developer is running locally (`npm run mock` uses 4010).
const PORT = 4099;
const BASE = `http://localhost:${PORT}/enterprise/users/api`;

// counterfact is hoisted to the monorepo root node_modules/.bin
function counterfactBin() {
  return path.join(PKG_ROOT, '..', '..', 'node_modules', '.bin', 'counterfact');
}

async function api(method, route, body) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

describe('User Manager mock (LLMO-5616)', () => {
  let server;

  before(async function before() {
    this.timeout(120_000);
    server = spawn(
      process.execPath,
      [
        counterfactBin(), 'spec/usermanager_swagger.yaml', '.counterfact',
        '--serve', '--port', String(PORT),
        '--prefix', '/enterprise/users/api',
        '--no-validate-request', '--no-update-check',
      ],
      { cwd: PKG_ROOT, stdio: 'ignore' },
    );
    // poll until the mock answers
    for (let i = 0; i < 90; i += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(`${BASE}/v1/workspaces`);
        if (r.ok) {
          return;
        }
      } catch { /* not up yet */ }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
    throw new Error('mock server did not start');
  });

  after(() => {
    if (server) {
      server.kill();
    }
  });

  beforeEach(async () => {
    await api('POST', '/__reset');
  });

  it('starts seeded with the fixture workspaces', async () => {
    const { status, body } = await api('GET', '/v1/workspaces');
    expect(status).to.equal(200);
    const ids = body.items.map((w) => w.id);
    expect(ids).to.include.members(['ws-root', 'ws-child']);
  });

  it('reflects a created child workspace in a subsequent GET (statefulness)', async () => {
    const created = await api('POST', '/v1/workspaces/ws-root/child', { name: 'Spawned' });
    expect(created.status).to.equal(200);
    const { id } = created.body;
    const got = await api('GET', `/v1/workspaces/${id}`);
    expect(got.status).to.equal(200);
    expect(got.body.name).to.equal('Spawned');
    expect(got.body.parent_id).to.equal('ws-root');
  });

  it('updates then deletes a workspace', async () => {
    const { body: ws } = await api('POST', '/v1/workspaces/ws-root/child', { name: 'A' });
    await api('PUT', `/v1/workspaces/${ws.id}`, { name: 'B' });
    expect((await api('GET', `/v1/workspaces/${ws.id}`)).body.name).to.equal('B');
    expect((await api('DELETE', `/v1/workspaces/${ws.id}`)).status).to.equal(200);
    expect((await api('GET', `/v1/workspaces/${ws.id}`)).status).to.be.gte(400);
  });

  it('adds a member and lists it', async () => {
    await api('POST', '/v1/workspaces/ws-root/members', { user_id: 'user-9', role: 'viewer' });
    const { body } = await api('GET', '/v1/workspaces/ws-root/members');
    expect(body.items.map((m) => m.user_id)).to.include('user-9');
  });

  it('adds members via the { members: [...] } body shape', async () => {
    await api('POST', '/v1/workspaces/ws-root/members', {
      members: [{ user_id: 'user-10', role: 'viewer' }, { user_id: 'user-11', role: 'editor' }],
    });
    const ids = (await api('GET', '/v1/workspaces/ws-root/members')).body.items.map((m) => m.user_id);
    expect(ids).to.include.members(['user-10', 'user-11']);
  });

  it('adds members via a bare array body shape', async () => {
    await api('POST', '/v1/workspaces/ws-root/members', [{ user_id: 'user-12', role: 'viewer' }]);
    const ids = (await api('GET', '/v1/workspaces/ws-root/members')).body.items.map((m) => m.user_id);
    expect(ids).to.include('user-12');
  });

  it('adding members to a missing workspace returns an error status', async () => {
    const { status } = await api('POST', '/v1/workspaces/does-not-exist/members', { user_id: 'x' });
    expect(status).to.be.gte(400);
  });

  it('deletes a member and reports the freed count (0 when absent)', async () => {
    await api('POST', '/v1/workspaces/ws-root/members', { user_id: 'user-13', role: 'viewer' });
    const removed = await api('DELETE', '/v1/workspaces/ws-root/members', { user_ids: ['user-13'] });
    expect(removed.status).to.equal(200);
    expect(removed.body.count).to.equal(1);
    // Deleting an absent member is a 200 with count 0 (mirrors the real "units freed" semantics).
    const none = await api('DELETE', '/v1/workspaces/ws-root/members', { user_ids: ['ghost'] });
    expect(none.status).to.equal(200);
    expect(none.body.count).to.equal(0);
  });

  it('updating a non-existent member returns an error status', async () => {
    const { status } = await api('PATCH', '/v1/workspaces/ws-root/members', { user_id: 'ghost', role: 'x' });
    expect(status).to.be.gte(400);
  });

  it('updates the profile (POST reflected in GET)', async () => {
    await api('POST', '/v1/profile', { first_name: 'Grace' });
    expect((await api('GET', '/v1/profile')).body.first_name).to.equal('Grace');
  });

  it('serves resources, deprecated limits alias, and service-units balance', async () => {
    expect((await api('GET', '/v1/workspaces/ws-root/resources')).body.workspace_id).to.equal('ws-root');
    expect((await api('GET', '/v1/workspaces/ws-root/limits')).body.workspace_id).to.equal('ws-root');
    expect((await api('GET', '/v1/workspaces/ws-root/service-units/balance')).body.balance).to.equal(5000);
  });

  it('resets to the seeded state between tests', async () => {
    await api('POST', '/v1/workspaces/ws-root/child', { name: 'Temp' });
    await api('POST', '/__reset');
    const ids = (await api('GET', '/v1/workspaces')).body.items.map((w) => w.id);
    expect(ids).to.deep.equal(['ws-root', 'ws-child']);
  });

  it('returns an error status for a missing workspace', async () => {
    expect((await api('GET', '/v1/workspaces/does-not-exist')).status).to.be.gte(400);
  });

  describe('sub-workspace lifecycle (LLMO-5616)', () => {
    it('POST /v2/workspaces/:id/child registers a child with a deterministic id, reachable via GET', async () => {
      const created = await api('POST', '/v2/workspaces/ws-root/child', {
        title: 'Market Mirror', resources: { ai: { units: 100 } },
      });
      expect(created.status).to.equal(200);
      expect(created.body.id).to.be.a('string').and.match(/^ws-new-/);
      expect(created.body.parent_id).to.equal('ws-root');
      expect(created.body.title).to.equal('Market Mirror');
      // the child is stored, so a subsequent workspace GET finds it
      const got = await api('GET', `/v1/workspaces/${created.body.id}`);
      expect(got.status).to.equal(200);
      expect(got.body.parent_id).to.equal('ws-root');
    });

    it('GET /v1/workspaces/:id/status returns the terminal "created" as a single object', async () => {
      const res = await api('GET', '/v1/workspaces/ws-root/status');
      expect(res.status).to.equal(200);
      // CR2: a single object, not an array
      expect(res.body).to.be.an('object');
      expect(res.body.status).to.equal('created');
    });

    it('GET /v1/workspaces/:id/status returns an error status for an unknown workspace', async () => {
      expect((await api('GET', '/v1/workspaces/no-such-ws/status')).status).to.be.gte(400);
    });

    it('GET status walks a seeded "not ready" -> "created" sequence, then stays created (poll path)', async () => {
      const seeded = await api('POST', '/__set-status-sequence', {
        id: 'ws-root', statuses: ['not ready', 'not ready', 'created'],
      });
      expect(seeded.status).to.equal(200);
      const poll = async () => (await api('GET', '/v1/workspaces/ws-root/status')).body.status;
      expect(await poll()).to.equal('not ready');
      expect(await poll()).to.equal('not ready');
      expect(await poll()).to.equal('created');
      // drained -> stays at the terminal created
      expect(await poll()).to.equal('created');
    });

    it('POST /__set-status-sequence on an unknown workspace returns an error status', async () => {
      const res = await api('POST', '/__set-status-sequence', { id: 'no-such-ws', statuses: ['created'] });
      expect(res.status).to.be.gte(400);
    });

    it('POST /v2/workspaces/:id/resources/transfer reflects the allocation in the store', async () => {
      const res = await api('POST', '/v2/workspaces/ws-child/resources/transfer', {
        resources: { projects: 5, keywords: 500 },
      });
      expect(res.status).to.equal(200);
      expect(res.body).to.include({ projects: 5, keywords: 500 });
      // reflected on a subsequent resources GET
      const got = await api('GET', '/v1/workspaces/ws-child/resources');
      expect(got.body).to.include({ projects: 5, keywords: 500 });
    });

    it('transfer to a missing workspace returns an error status', async () => {
      const res = await api('POST', '/v2/workspaces/no-such-ws/resources/transfer', {
        resources: { projects: 1 },
      });
      expect(res.status).to.be.gte(400);
    });

    it('end-to-end: child -> status -> transfer is deterministic across the chain', async () => {
      const child = await api('POST', '/v2/workspaces/ws-root/child', { title: 'Mirror' });
      const { id } = child.body;
      expect((await api('GET', `/v1/workspaces/${id}/status`)).body.status).to.equal('created');
      const transfer = await api('POST', `/v2/workspaces/${id}/resources/transfer`, {
        resources: { projects: 3 },
      });
      expect(transfer.status).to.equal(200);
      expect(transfer.body).to.include({ projects: 3 });
    });
  });

  it('uses committed custom handlers (delegate to $.context)', () => {
    const profile = fs.readFileSync(path.join(PKG_ROOT, '.counterfact/routes/v1/profile.ts'), 'utf8');
    expect(profile).to.include('$.context');
  });

  it('exposes the base-URL env-var name for the future client', () => {
    expect(USER_MANAGER_BASE_URL_ENV).to.equal('SEMRUSH_USERS_BASE_URL');
  });
});
