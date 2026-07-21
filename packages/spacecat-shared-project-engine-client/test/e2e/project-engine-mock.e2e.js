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
import { createBenchmarkMock } from '../../mock/factories.js';
import { AI_MODEL_CATALOG } from '../../mock/ai-model-catalog.js';
import { tagId } from '../../mock/tag-id.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..', '..');
const RUNNER = join(packageRoot, 'mock', 'run.js');

const READY_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const SEED_WORKSPACE = SEED_IDS.workspaceId;
const SEED_PROJECT = SEED_IDS.projectId;
// Every project's root level holds exactly these four dimension roots and nothing else.
const DIMENSION_ROOT_NAMES = ['category', 'intent', 'source', 'type'];

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

/**
 * Polls the mock until it answers a seeded request 200, or throws after the budget. On timeout it
 * appends the tail of the captured server stderr (via `getStderr`) so a boot/transpile failure is
 * diagnosable from the CI log rather than surfacing only as the opaque readiness error.
 */
/* eslint-disable no-await-in-loop -- sequential readiness polling is intentional. */
async function waitForReady(baseUrl, deadline, getStderr) {
  for (;;) {
    try {
      // Send a bearer token: every real route is now auth-gated, so an unauthenticated probe
      // would 401 forever (the server is up, but `res.ok` would never be true).
      const res = await fetch(`${baseUrl}/v1/workspaces/${SEED_WORKSPACE}/projects`, {
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
      throw new Error(
        `mock did not become ready in time${tail ? `; server stderr:\n${tail}` : ''}`,
      );
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

  /** Captured server stderr, surfaced in the readiness-timeout error for diagnosability. */
  let serverStderr = '';
  /** Set once the spawned server process has exited, so teardown knows whether to escalate. */
  let serverExited = false;

  // Request helpers, shared by every test below. All are lazy — `baseUrl` and `client` are only
  // assigned in before(), after this suite body has run.
  const promptsUrl = () => `${baseUrl}/v2/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts`;
  const jsonAuth = {
    Authorization: 'Bearer e2e-token',
    'content-type': 'application/json',
    Accept: 'application/json',
  };
  const listByTags = (tagIds, { draft } = {}) => client.POST(
    '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
    {
      params: {
        path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
        ...(draft ? { query: { draft: true } } : {}),
      },
      body: { tag_ids: tagIds },
    },
  );
  // One level of the tag tree: `parentId: ''` lists the dimension roots, an id lists that tag's
  // direct children. `parent_id` and `search` are both spec-required query params.
  const listTags = (parentId, search = '') => client.GET(
    '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
    {
      params: {
        path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
        query: { parent_id: parentId, search },
      },
    },
  );

  before(async () => {
    const port = await pickPort();
    baseUrl = `http://127.0.0.1:${port}/enterprise/projects/api`;
    serverStderr = '';
    serverExited = false;
    // detached so we can signal the whole process group (run.js spawns Counterfact as a child).
    // stderr is piped (not 'ignore') so a boot/transpile failure is captured and reported on a
    // readiness timeout instead of being silently discarded.
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
    // If readiness times out, `server` is already assigned, so after() still tears it down
    // (mocha runs after-hooks even when a before-hook throws).
    await waitForReady(baseUrl, Date.now() + READY_TIMEOUT_MS, () => serverStderr);
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
    // Escalate to SIGKILL if the group ignored SIGTERM within the grace window, so a wedged
    // Counterfact child can never outlive the test run.
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
      body: {
        name: 'E2E Project', type: 'ai', domain: 'acme.com', brand_name_display: 'Acme',
      },
    });
    expect(created.id).to.be.a('string');
    // The live API returns a draft ProjectResponse with the request nested under settings.ai —
    // NOT a flat echo of the request body (verified 2026-06-25).
    expect(created).to.include({ is_draft: true, publish_status: 'draft' });
    expect(created).to.not.have.any.keys('country_code', 'language_id', 'location_id');
    expect(created.settings.ai).to.include({ brand_name_display: 'Acme', primary_url: 'acme.com' });

    const { data: fetched } = await client.GET('/v1/workspaces/{id}/projects/{project_id}', {
      // `draft` is a required query param (consumer sends it); validation 400s without it.
      params: { path: { id: SEED_WORKSPACE, project_id: created.id }, query: { draft: 'true' } },
    });
    expect(fetched.name).to.equal('E2E Project');

    const { data: list } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    expect(list.total).to.equal(2);
  });

  it('round-trips a created + published market: language.name = ISO code, status flips to live (#1745)', async () => {
    const ENGLISH_ID = '5a0a33ed-7f5c-4901-befd-a042c0350da1'; // catalog "English"
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: {
        name: 'Adobe · US · en',
        type: 'ai',
        domain: 'adobe.com',
        brand_names: ['Adobe'],
        brand_name_display: 'Adobe',
        language_id: ENGLISH_ID,
        country_code: 'us',
        location_id: 2840,
        location_name: 'United States',
      },
    });
    // The created read-view carries the live shapes the consumer's langOf/geoOf reconstruct a
    // market from: language.name is the ISO code (NOT the English display name), location echoed.
    expect(created.settings.ai.language).to.deep.equal({ id: ENGLISH_ID, name: 'en' });
    expect(created.settings.ai.country).to.deep.equal({ code: 'us', name: 'United States' });
    expect(created.settings.ai.location).to.deep.equal({ id: 2840, name: 'United States' });
    expect(created).to.include({ is_draft: true, publish_status: 'draft' });

    // Publish moves the stored read-view to live: publish_status flips, published_at is stamped,
    // is_draft stays true (matches live — only publish_status/published_at change).
    const { response: pubRes } = await client.POST(
      '/v1/workspaces/{id}/projects/{project_id}/publish',
      { params: { path: { id: SEED_WORKSPACE, project_id: created.id } } },
    );
    expect(pubRes.status).to.equal(202);

    const { data: list } = await client.GET('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
    });
    const published = list.items.find((p) => p.id === created.id);
    expect(published.settings.ai.language.name).to.equal('en');
    expect(published).to.include({ publish_status: 'live', is_draft: true });
    expect(published.published_at).to.be.a('string').with.length.greaterThan(0);
    // published_at is a valid ISO 8601 timestamp (round-trips through Date).
    expect(new Date(published.published_at).toISOString()).to.equal(published.published_at);
  });

  it('patches a project: name stays top-level, brand fields nest under settings.ai (like live)', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Before', type: 'ai' },
    });
    const { data: patched } = await client.PATCH('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
      body: {
        name: 'After',
        type: 'ai',
        brand_name_display: 'Acme Renamed',
        brand_names: ['Acme', 'Acme Inc'],
      },
    });
    expect(patched.name).to.equal('After');
    // Live reflects the flat brand fields NESTED under settings.ai, never at the top level
    // (verified 2026-06-25). A shallow merge of the request body would put them at the top.
    expect(patched.settings.ai).to.include({ brand_name_display: 'Acme Renamed' });
    expect(patched.settings.ai.brand_names).to.deep.equal(['Acme', 'Acme Inc']);
    expect(patched).to.not.have.property('brand_name_display');
    expect(patched).to.not.have.property('brand_names');
  });

  // Live `PATCH .../projects/{id}` REQUIRES `type` — a typeless body 400s (Go-validator,
  // confirmed live 2026-06-29, issue #1745). The vendored spec already marks
  // ProjectUpdateRequest.type required, so Counterfact rejects it at the request-validation seam.
  // This pins that the mock does NOT hide the serenity bug where updateProject omits `type`
  // (spacecat-api-service brand-aliases.js) — the IT will surface it.
  it('400s a PATCH that omits the required `type` (does not hide the serenity omit-type bug)', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'NeedsType', type: 'ai' },
    });
    const { response } = await client.PATCH('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
      body: { brand_names: ['Acme'] },
    });
    expect(response.status).to.equal(400);
  });

  it('deletes a project (404 on subsequent read)', async () => {
    const { data: created } = await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Doomed', type: 'ai' },
    });
    await client.DELETE('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id } },
    });
    const { error, response } = await client.GET('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: created.id }, query: { draft: 'true' } },
    });
    expect(response.status).to.equal(404);
    expect(error).to.not.equal(undefined);
  });

  it('404s a DELETE of a non-existent project (live shape; serenity treats 404 as success)', async () => {
    const { response } = await client.DELETE('/v1/workspaces/{id}/projects/{project_id}', {
      params: { path: { id: SEED_WORKSPACE, project_id: 'ffffffff-0000-4000-8000-000000000000' } },
    });
    expect(response.status).to.equal(404);
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
  // (delete-only in the spec) — see mock/.../aio/prompts*.js. Body is keyed by PROMPT TEXT,
  // value = tag names (the real consumer shape: `{ [text]: tags }`). A freshly created prompt is
  // DRAFT (`is_new: true`), so this read passes `draft: true` to see it immediately — the next
  // test pins the default (published-only) gating that state feeds.
  it('creates aio prompts (tagged) and lists them back (by_tags, draft view)', async () => {
    const { data: created, error: createError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'What is X?': ['brand'], 'Tell me Y': ['brand'] } },
      },
    );
    expect(createError).to.equal(undefined);
    expect(created.ids).to.have.length(2);
    expect(created.existing_count).to.equal(0);

    // by_tags with an empty tag_ids + draft:true lists every prompt: 1 seeded (published) + 2
    // just-created (draft).
    const { data: listed, error: listError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { draft: true },
        },
        body: { tag_ids: [] },
      },
    );
    expect(listError).to.equal(undefined);
    expect(listed.total).to.equal(3);
    expect(listed.items.map((p) => p.name)).to.include.members(['What is X?', 'Tell me Y']);
  });

  // WP2 (LLMO-6288 v3 rework): the DELIVERED Semrush metadata contract — v3 create-with-metadata,
  // RFC 7396 merge-patch (single + batch + combined), dedupe-preserves-metadata, and the existing
  // v2 `by_tags` list now carrying `metadata` inline. All real, spec-vendored paths, so every case
  // below drives the generated typed client — nothing here is a mock-owned bypass any more.
  const V3_CREATE = '/v3/workspaces/{id}/projects/{project_id}/aio/prompts';
  const V3_PATCH_ONE = '/v3/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}';
  const V3_PATCH_ONE_METADATA = '/v3/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/metadata';
  const V3_PATCH_BATCH = '/v3/workspaces/{id}/projects/{project_id}/aio/prompts/metadata';

  it('v3 create stamps metadata on a new prompt and reads it back inline via by_tags', async () => {
    const { data: created, error } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: 'v3 metadata prompt?', metadata: { created_by: 'a@adobe.com', created_at: 't0' } }] },
    });
    expect(error).to.equal(undefined);
    expect(created.existing_count).to.equal(0);
    const [item] = created.items;
    expect(item).to.include({ name: 'v3 metadata prompt?', is_new: true });
    expect(item.metadata).to.deep.equal({ created_by: 'a@adobe.com', created_at: 't0' });

    // by_tags (v2, draft view) now carries the same metadata inline — no separate read endpoint.
    const { data: listed } = await listByTags([], { draft: true });
    const mine = listed.items.find((p) => p.id === item.id);
    expect(mine.metadata).to.deep.equal({ created_by: 'a@adobe.com', created_at: 't0' });
  });

  it('v3 create dedupe hit PRESERVES the existing stored metadata and reports is_new: false', async () => {
    const { data: first } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: 'dedupe target?', metadata: { created_by: 'orig@adobe.com' } }] },
    });
    const [{ id }] = first.items;

    const { data: second } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: 'dedupe target?', metadata: { created_by: 'ignored@adobe.com' } }] },
    });
    expect(second.existing_count).to.equal(1);
    expect(second.items[0]).to.deep.equal({
      id, name: 'dedupe target?', is_new: false, metadata: { created_by: 'orig@adobe.com' },
    });
  });

  it('single-prompt metadata PATCH merges (RFC 7396): absent keeps, string sets, null deletes', async () => {
    const { data: created } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: 'merge target?', metadata: { created_by: 'a@adobe.com', created_at: 't0' } }] },
    });
    const [{ id }] = created.items;

    const { response, error } = await client.PATCH(V3_PATCH_ONE_METADATA, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: id } },
      body: { updated_by: 'b@adobe.com', created_by: null },
    });
    expect(error).to.equal(undefined);
    expect(response.status).to.equal(204);

    const { data: listed } = await listByTags([], { draft: true });
    const mine = listed.items.find((p) => p.id === id);
    // created_by deleted, created_at kept (absent from the patch), updated_by set.
    expect(mine.metadata).to.deep.equal({ created_at: 't0', updated_by: 'b@adobe.com' });
  });

  it('combined PATCH .../{prompt_id}: metadata: null WIPES the whole block; name renames too', async () => {
    const { data: created } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: 'wipe target?', metadata: { created_by: 'a@adobe.com' } }] },
    });
    const [{ id }] = created.items;

    const { response } = await client.PATCH(V3_PATCH_ONE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: id } },
      body: { name: 'wiped and renamed', metadata: null },
    });
    expect(response.status).to.equal(204);

    const { data: listed } = await listByTags([], { draft: true });
    const mine = listed.items.find((p) => p.id === id);
    expect(mine.name).to.equal('wiped and renamed');
    expect(mine).to.not.have.property('metadata');
  });

  it('combined PATCH 409s on a sibling-name conflict, 400 when neither field is supplied', async () => {
    const { data: created } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: {
        items: [{ name: 'conflict a?' }, { name: 'conflict b?' }],
      },
    });
    const [a, b] = created.items;

    const { response: conflictRes, error: conflictErr } = await client.PATCH(V3_PATCH_ONE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: b.id } },
      body: { name: a.name },
    });
    expect(conflictRes.status).to.equal(409);
    expect(conflictErr).to.not.equal(undefined);

    const { response: emptyRes } = await client.PATCH(V3_PATCH_ONE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: a.id } },
      body: {},
    });
    expect(emptyRes.status).to.equal(400);
  });

  it('batch metadata PATCH is atomic: a CHECK violation (>100 chars) rolls back the WHOLE batch', async () => {
    const { data: created } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: {
        items: [{ name: 'batch a?', metadata: { created_by: 'a@adobe.com' } }, { name: 'batch b?' }],
      },
    });
    const [a, b] = created.items;
    const tooLong = 'x'.repeat(101);

    const { response: badRes } = await client.PATCH(V3_PATCH_BATCH, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: {
        items: [
          { prompt_id: a.id, metadata: { updated_by: 'edit@adobe.com' } },
          { prompt_id: b.id, metadata: { created_by: tooLong } },
        ],
      },
    });
    expect(badRes.status).to.equal(400);

    // Nothing landed — a's metadata is unchanged by the rolled-back batch.
    const { data: listed } = await listByTags([], { draft: true });
    const mineA = listed.items.find((p) => p.id === a.id);
    expect(mineA.metadata).to.deep.equal({ created_by: 'a@adobe.com' });

    // A clean batch (no violation) DOES apply to both items.
    const { response: okRes } = await client.PATCH(V3_PATCH_BATCH, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: {
        items: [
          { prompt_id: a.id, metadata: { updated_by: 'edit@adobe.com' } },
          { prompt_id: b.id, metadata: { created_by: 'b@adobe.com' } },
        ],
      },
    });
    expect(okRes.status).to.equal(204);
    const { data: listedAfter } = await listByTags([], { draft: true });
    expect(listedAfter.items.find((p) => p.id === a.id).metadata)
      .to.deep.equal({ created_by: 'a@adobe.com', updated_by: 'edit@adobe.com' });
    expect(listedAfter.items.find((p) => p.id === b.id).metadata)
      .to.deep.equal({ created_by: 'b@adobe.com' });
  });

  it('batch metadata PATCH 404s on an unknown prompt_id, rolling back the whole batch', async () => {
    const { data: created } = await client.POST(V3_CREATE, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { items: [{ name: '404 target?', metadata: { created_by: 'a@adobe.com' } }] },
    });
    const [{ id }] = created.items;

    const { response } = await client.PATCH(V3_PATCH_BATCH, {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: {
        items: [
          { prompt_id: id, metadata: { updated_by: 'edit@adobe.com' } },
          { prompt_id: 'not-a-real-prompt-id', metadata: { created_by: 'x@adobe.com' } },
        ],
      },
    });
    expect(response.status).to.equal(404);

    const { data: listed } = await listByTags([], { draft: true });
    expect(listed.items.find((p) => p.id === id).metadata).to.deep.equal({ created_by: 'a@adobe.com' });
  });

  // MysticatBot review (LLMO-6288 rework): the 401 guard was only exercised on ONE of the five new
  // v3 write routes (the batch PATCH). If the auth-guard injection or route materialization had a
  // path-specific bug, only hitting one route would leave it invisible. Every request body below
  // is schema-valid (satisfies `minItems`/required fields) so each case exercises the BEARER gate
  // specifically — Counterfact enforces request-shape validation before any handler (and
  // therefore before our auth guard) runs, so an invalid body would 400 there instead of 401.
  const A_PROMPT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const V3_UNAUTHED_ROUTES = [
    {
      label: 'POST .../aio/prompts',
      path: `/v3/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts`,
      method: 'POST',
      body: { items: [{ name: 'unauthed create?' }] },
    },
    {
      label: 'POST .../aio/prompts/tagged',
      path: `/v3/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/tagged`,
      method: 'POST',
      body: { prompts: [{ name: 'unauthed tagged create?' }] },
    },
    {
      label: 'PATCH .../aio/prompts/{prompt_id}',
      path: `/v3/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/${A_PROMPT_ID}`,
      method: 'PATCH',
      body: { name: 'unauthed rename' },
    },
    {
      label: 'PATCH .../aio/prompts/{prompt_id}/metadata',
      path: `/v3/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/${A_PROMPT_ID}/metadata`,
      method: 'PATCH',
      body: { created_by: 'unauthed@adobe.com' },
    },
    {
      label: 'PATCH .../aio/prompts/metadata (batch)',
      path: `/v3/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/metadata`,
      method: 'PATCH',
      body: { items: [{ prompt_id: A_PROMPT_ID, metadata: {} }] },
    },
  ];

  V3_UNAUTHED_ROUTES.forEach((route) => {
    it(`rejects ${route.label} without a Bearer credential (401)`, async () => {
      const res = await fetch(`${baseUrl}${route.path}`, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route.body),
      });
      expect(res.status, `${route.label} should 401 without a bearer token`).to.equal(401);
    });
  });

  // The single-serializer contract. Live returns the SAME tag object whether it is embedded on a
  // prompt or listed by the tree read — fetching one id both ways and comparing yields equality
  // (verified 2026-07-10 against prod). What varies is DEPTH: a root omits `parent_id`/`path`, a
  // descendant carries both. A mock that narrowed the prompt-embedded shape would let a consumer
  // read parentage locally and `undefined` in production; this test is what forbids that.
  it('embeds a prompt tag as the IDENTICAL object the tag tree returns for the same id', async () => {
    const { data: listed } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { draft: true },
        },
        body: { tag_ids: [] },
      },
    );
    const embedded = listed.items
      .flatMap((p) => p.tags ?? [])
      .find((t) => t.id === SEED_IDS.childCollidingTagId);
    expect(embedded, 'the sub-category `human` is carried by a seeded prompt').to.not.equal(undefined);

    // The same tag, read from the tree under its category parent.
    const { data: fromTree } = await client.GET(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { parent_id: SEED_IDS.categoryTagId, search: '' },
        },
      },
    );
    const tracked = fromTree.items.find((t) => t.id === SEED_IDS.childCollidingTagId);
    expect(embedded).to.deep.equal(tracked);

    // A DESCENDANT carries its own parentage on the prompt payload: no tag-tree join needed.
    expect(embedded.parent_id).to.equal(SEED_IDS.categoryTagId);
    expect(embedded.path[0]).to.include({ id: SEED_IDS.categoryRootTagId, name: 'category' });
  });

  // The other half of the same contract: a ROOT carried by a prompt omits both keys, so a consumer
  // reading `path[0]` for the dimension must fall back to the tag's own name.
  it('embeds a ROOT prompt tag with no parent_id and no path', async () => {
    // No SEEDED prompt carries a dimension root — every seeded tag value is a descendant — so the
    // root must be attached here for this assertion to have a subject at all.
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Rooted Q'], tag_ids: [SEED_IDS.categoryRootTagId] }),
    });
    expect(res.status).to.equal(201);

    const { data: listed } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { draft: true },
        },
        body: { tag_ids: [] },
      },
    );
    const rootTag = listed.items
      .flatMap((p) => p.tags ?? [])
      .find((t) => t.id === SEED_IDS.categoryRootTagId);
    expect(rootTag, 'the `category` root is carried by the prompt just created').to.not.equal(undefined);
    expect(rootTag).to.not.have.property('parent_id');
    expect(rootTag).to.not.have.property('path');

    // Every embedded tag is either a root (no path) or carries a root-first path whose first leaf
    // is a dimension root — there is no third shape.
    const allEmbedded = listed.items.flatMap((p) => p.tags ?? []);
    expect(allEmbedded.length).to.be.greaterThan(0);
    allEmbedded.forEach((t) => {
      if (t.path === undefined) {
        expect(t).to.not.have.property('parent_id');
      } else {
        expect(t.path[0].name).to.be.oneOf(['category', 'intent', 'source', 'type']);
        expect(t.parent_id).to.be.a('string');
      }
    });
  });

  // `prompts/tagged` is name-keyed and root-only: a name absent from the root level MINTS a root.
  // The minted tag has to become a real row in the tag tree, otherwise the prompt would reference
  // an id the tag collection does not hold and `by_tags` could only echo a bare `{ id, name }` stub
  // — a shape live never returns, and one that would slip past a serializer assertion made only
  // against seeded tags.
  it('registers the ROOT tag that `prompts/tagged` mints, and serializes it like any other', async () => {
    const res = await fetch(`${baseUrl}/v2/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/tagged`, {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ prompts: { 'Minted Q': ['Freshly Minted'] } }),
    });
    expect(res.status).to.equal(201);

    // The minted name is now a root in the tag tree, alongside the four dimension roots.
    const { data: roots } = await listTags('');
    const minted = roots.items.find((t) => t.name === 'Freshly Minted');
    expect(minted, 'the minted root is registered in the tag tree').to.not.equal(undefined);

    // …and the prompt embeds that exact object, not a stub: same id, and the full root shape.
    const { data: listed } = await listByTags([minted.id], { draft: true });
    expect(listed.items.map((p) => p.name)).to.deep.equal(['Minted Q']);
    const embedded = listed.items[0].tags.find((t) => t.id === minted.id);
    expect(embedded).to.deep.equal(minted);
    expect(embedded).to.have.property('children_count', 0);
    expect(embedded).to.have.property('prompts_count');
    expect(embedded).to.not.have.property('parent_id');
    expect(embedded).to.not.have.property('path');
  });

  // Minting resolves each name against the stored tags BEFORE writing, because `upsertMany` rejects
  // a batch ATOMICALLY on any already-stored id. A batch that names one existing root and one new
  // one would therefore register neither, and the new tag would go back to being a phantom id that
  // `by_tags` could only echo as a stub. Reusing `category` — a seeded dimension root — forces that
  // mixed batch.
  it('mints only the ABSENT root when a `prompts/tagged` batch also names an existing one', async () => {
    const res = await fetch(`${baseUrl}/v2/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/prompts/tagged`, {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ prompts: { 'Mixed Q': ['category', 'Brand New Root'] } }),
    });
    expect(res.status).to.equal(201);

    const { data: roots } = await listTags('');
    const names = roots.items.map((t) => t.name);
    expect(names).to.include('Brand New Root');
    // `category` is still one single root, not duplicated by the re-mention.
    expect(names.filter((n) => n === 'category')).to.have.length(1);

    // Both tags on the prompt serialize fully — neither is a bare `{ id, name }` stub.
    const mintedId = roots.items.find((t) => t.name === 'Brand New Root').id;
    const { data: listed } = await listByTags([mintedId], { draft: true });
    expect(listed.items.map((p) => p.name)).to.deep.equal(['Mixed Q']);
    listed.items[0].tags.forEach((t) => expect(t).to.have.property('children_count'));
  });

  // Draft/publish gating (live-verified 2026-07-02, serenity-docs#24 §3.1 gate 2 + gate 6): a
  // freshly created prompt is invisible via the default (non-draft) by_tags read until the
  // project's publish endpoint runs — mirroring the real consumer's create → publishAffected →
  // publishProject sequence (spacecat-api-service `src/support/serenity/handlers/prompts.js`).
  it('gates a freshly created prompt from by_tags until publish', async () => {
    const { data: created } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'Draft-gated question': ['brand'] } },
      },
    );
    expect(created.ids).to.have.length(1);

    // Default (no draft) read: only the seeded, already-published prompt is visible.
    const { data: beforePublish } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { tag_ids: [] },
      },
    );
    expect(beforePublish.total).to.equal(1);
    expect(beforePublish.items.map((p) => p.name)).to.not.include('Draft-gated question');

    // draft:true sees it immediately, same as live's draft tree.
    const { data: draftView } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { draft: true },
        },
        body: { tag_ids: [] },
      },
    );
    expect(draftView.items.map((p) => p.name)).to.include('Draft-gated question');

    // Publish moves it into the default (published) view.
    const { response: pubRes } = await client.POST(
      '/v1/workspaces/{id}/projects/{project_id}/publish',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(pubRes.status).to.equal(202);

    const { data: afterPublish } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { tag_ids: [] },
      },
    );
    expect(afterPublish.items.map((p) => p.name)).to.include('Draft-gated question');
  });

  // Live dedups prompts by text: re-creating an existing text yields no new id and existing_count:1
  // (#1745 second sweep). The seed already holds "What is the best running shoe?".
  it('dedups a duplicate prompt text into existing_count (no new id)', async () => {
    const { data: dup, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'What is the best running shoe?': ['brand'], 'A brand new prompt': ['brand'] } },
      },
    );
    expect(error).to.equal(undefined);
    expect(dup.ids).to.have.length(1); // only the genuinely-new text is created
    expect(dup.existing_count).to.equal(1); // the duplicate text is counted, not re-created
  });

  // The consumer's real read path (listPromptsByTags) passes non-empty tag_ids — exercise the
  // filter branch (OR semantics), not just the list-all branch. `tagged` is name-keyed and
  // ROOT-only: it derives `tagId(name)` with no parent, so a prompt tagged 'brand' is found via
  // tag_ids: [tagId('brand')]. Neither probe name is a dimension root — a bare name that IS one
  // (`category`, `intent`, `source`, `type`) would resolve to that real root's id, which is exactly
  // why no caller may reach this endpoint with dimension-root data.
  // Fresh creates are draft-gated (see the dedicated gating test above), so this read passes
  // draft:true — it's exercising the filter branch, not the publish gate.
  it('by_tags filters to prompts carrying a given tag id (non-empty tag_ids)', async () => {
    await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'Branded question': ['brand'], 'Generic question': ['generic'] } },
      },
    );
    const { data: branded, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { draft: true },
        },
        body: { tag_ids: [tagId('brand')] },
      },
    );
    expect(error).to.equal(undefined);
    // Only the 'brand'-tagged prompt matches: the seeded prompt carries dimension-root descendant
    // ids (never `tagId('brand')`), and 'Generic question' carries a different derived root id.
    expect(branded.items.map((p) => p.name)).to.deep.equal(['Branded question']);
    expect(branded.total).to.equal(1);
  });

  it('deletes aio prompts by id (by_tags reflects the removal)', async () => {
    const { data: created } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'Doomed prompt': ['brand'] } },
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

  // ───────────────────────────────────────────────────────────────────────
  // Id-based prompt writes (the nested-category migration path, serenity-docs#24):
  // POST /aio/prompts (create by tag id) + PUT /aio/prompts/tags (batch tag-ref update).
  // POST returns a list wrapper that diverges from the vendored StringIDName schema, so its
  // success/500 bodies are asserted via raw fetch (the typed client types the response as
  // StringIDName); reads go through the typed by_tags client.
  // ───────────────────────────────────────────────────────────────────────

  // POST /aio/prompts references tags by id (not name) and returns 201 with the live LIST WRAPPER
  // { page, total, items:[{id,name}], existing_count }. The created prompts embed the tag's
  // { id, name }, so a by_tags read on that id correlates them — but they're DRAFT until publish
  // (see the dedicated gating test below), so this correlation check reads via draft:true.
  it('creates prompts by tag id and reads them back via by_tags (draft view)', async () => {
    // `childTagId` (the sub-category `Trail`) carries no seeded prompts, so by_tags on it returns
    // exactly what this test creates.
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Id Q1', 'Id Q2'], tag_ids: [SEED_IDS.childTagId] }),
    });
    expect(res.status).to.equal(201);
    const created = await res.json();
    expect(created.total).to.equal(2);
    expect(created.existing_count).to.equal(0);
    expect(created.items).to.have.length(2);
    expect(created.items[0]).to.have.keys('id', 'name');
    expect(created.items.map((p) => p.name)).to.deep.equal(['Id Q1', 'Id Q2']);

    // Correlation is free: by_tags on the referenced tag id returns the two created prompts.
    const { data: byTag } = await listByTags([SEED_IDS.childTagId], { draft: true });
    expect(byTag.items.map((p) => p.name)).to.have.members(['Id Q1', 'Id Q2']);
  });

  // Draft/publish gating on the id-based create path (live-verified 2026-07-02, serenity-docs#24
  // §3.1 gate 2 + gate 6) — the same mechanism as prompts/tagged.js's create, pinned separately
  // here since this endpoint has its own response shape and atomicity contract.
  it('gates an id-based-created prompt from by_tags until publish', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Draft-gated id prompt'], tag_ids: [SEED_IDS.categoryTagId] }),
    });
    expect(res.status).to.equal(201);

    const { data: beforePublish } = await listByTags([SEED_IDS.categoryTagId]);
    expect(beforePublish.items.map((p) => p.name)).to.not.include('Draft-gated id prompt');

    const { data: draftView } = await listByTags([SEED_IDS.categoryTagId], { draft: true });
    expect(draftView.items.map((p) => p.name)).to.include('Draft-gated id prompt');

    const { response: pubRes } = await client.POST(
      '/v1/workspaces/{id}/projects/{project_id}/publish',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(pubRes.status).to.equal(202);

    const { data: afterPublish } = await listByTags([SEED_IDS.categoryTagId]);
    expect(afterPublish.items.map((p) => p.name)).to.include('Draft-gated id prompt');
  });

  // Atomic failure: any unresolvable tag id 500s and creates NOTHING (verified live 2026-07-02).
  it('500s atomically on an unknown tag id (creates no prompt)', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Should not persist'], tag_ids: ['tag-0000000000000000'] }),
    });
    expect(res.status).to.equal(500);

    // Nothing was created — by_tags still shows only the seeded prompt.
    const { data: all } = await listByTags([]);
    expect(all.total).to.equal(1);
    expect(all.items.map((p) => p.name)).to.not.include('Should not persist');
  });

  // Text-dedupe mirrors prompts/tagged.js: a text already present is folded into existing_count.
  it('text-dedupes a create-by-id into existing_count (no new id)', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({
        // the seed already holds "What is the best running shoe?"
        items: ['What is the best running shoe?', 'A genuinely new id prompt'],
        tag_ids: [SEED_IDS.categoryTagId],
      }),
    });
    const created = await res.json();
    expect(created.total).to.equal(1); // only the new text is created
    expect(created.existing_count).to.equal(1); // the duplicate is counted, not re-created
  });

  // PUT /aio/prompts/tags with replace:false MERGES references onto the prompt's existing tag set:
  // the seeded prompt keeps its original closed-dimension tags AND gains the new sub-category ref.
  it('PUT merges tag references (replace:false keeps existing tags)', async () => {
    const { response } = await client.PUT(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: {
          items: [{ id: SEED_IDS.promptId, references: [SEED_IDS.childTagId], replace: false }],
        },
      },
    );
    expect(response.status).to.equal(204);

    // gained the new ref (the `Trail` sub-category, which the seed does not attach) …
    const { data: byNew } = await listByTags([SEED_IDS.childTagId]);
    expect(byNew.items.map((p) => p.id)).to.include(SEED_IDS.promptId);
    // … and kept an original one (the `branded` value under the `type` root)
    const { data: byOld } = await listByTags([SEED_IDS.typeBrandedTagId]);
    expect(byOld.items.map((p) => p.id)).to.include(SEED_IDS.promptId);
  });

  // PUT with replace:true REPLACES the set: the prompt's tags become EXACTLY the references, so its
  // original tags are dropped.
  it('PUT replaces the tag set (replace:true drops existing tags)', async () => {
    const { response } = await client.PUT(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: {
          items: [{ id: SEED_IDS.promptId, references: [SEED_IDS.categoryTagId], replace: true }],
        },
      },
    );
    expect(response.status).to.equal(204);

    // now carries only the new ref …
    const { data: byNew } = await listByTags([SEED_IDS.categoryTagId]);
    expect(byNew.items.map((p) => p.id)).to.include(SEED_IDS.promptId);
    // … and no longer matches an original tag (the `branded` value was replaced out)
    const { data: byOld } = await listByTags([SEED_IDS.typeBrandedTagId]);
    expect(byOld.items.map((p) => p.id)).to.not.include(SEED_IDS.promptId);
  });

  // An unknown prompt id is skipped SILENTLY — the call still 204s, no "not found" error.
  it('PUT silently 204s on an unknown prompt id', async () => {
    const { response, error } = await client.PUT(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: {
          items: [{
            id: '00000000-0000-4000-8000-000000000000',
            references: [SEED_IDS.categoryTagId],
            replace: true,
          }],
        },
      },
    );
    expect(response.status).to.equal(204);
    expect(error).to.equal(undefined);
  });

  // A reference id with no matching registered tag falls back to embedding { id, name: id } — the
  // id is what by_tags matches on, so the prompt still correlates even without a name to resolve.
  it('PUT embeds an unresolvable reference id as its own name (by_tags still correlates)', async () => {
    const unknownTagId = '00000000-0000-4000-8000-0000000000ff';
    const { response } = await client.PUT(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: {
          items: [{ id: SEED_IDS.promptId, references: [unknownTagId], replace: false }],
        },
      },
    );
    expect(response.status).to.equal(204);

    const { data } = await listByTags([unknownTagId]);
    expect(data.items.map((p) => p.id)).to.include(SEED_IDS.promptId);
  });

  // ───────────────────────────────────────────────────────────────────────
  // In-place prompt rename (aio-rename-prompt, serenity-docs#63): POST
  // /aio/prompts/{prompt_id}/rename edits a prompt's text WITHOUT deleting it — the id is
  // preserved, the count is unchanged, and a text collision with a sibling prompt is a clean
  // 409 (live-verified 2026-07-14, declared via overlay CR17; exact bodies, is_updated
  // semantics, empty-name literalism and the no-body 400 all live-pinned 2026-07-15).
  // ───────────────────────────────────────────────────────────────────────

  const renamePrompt = (promptId, newName) => client.POST(
    '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename',
    {
      params: {
        path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: promptId },
      },
      body: { new_name: newName },
    },
  );

  it('renames a prompt in place — same id, count unchanged, by_tags reflects the new text', async () => {
    const { data: renamed, error } = await renamePrompt(SEED_IDS.promptId, 'What is the best trail shoe?');
    expect(error).to.equal(undefined);
    expect(renamed).to.deep.equal({
      id: SEED_IDS.promptId,
      name: 'What is the best trail shoe?',
      is_updated: true,
    });

    const { data: listed } = await listByTags([]);
    expect(listed.total).to.equal(1); // no duplicate was minted
    expect(listed.items[0]).to.include({
      id: SEED_IDS.promptId,
      name: 'What is the best trail shoe?',
    });
  });

  // The documented no-op: renaming a prompt onto its OWN current text answers is_updated: false
  // (not a 409 — the collision check is against SIBLING prompts only).
  it('answers is_updated: false for a rename onto the prompt\'s own current text', async () => {
    const { data: renamed, error } = await renamePrompt(SEED_IDS.promptId, 'What is the best running shoe?');
    expect(error).to.equal(undefined);
    expect(renamed).to.deep.equal({
      id: SEED_IDS.promptId,
      name: 'What is the best running shoe?',
      is_updated: false,
    });
  });

  // The one hazard, live-verified 2026-07-14 (serenity-docs#63 §2): renaming onto ANOTHER
  // prompt's exact text is a 409 with NOTHING mutated — no rename, no duplicate.
  it('409s a rename onto a sibling prompt\'s exact text, mutating nothing', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['A sibling prompt'], tag_ids: [SEED_IDS.categoryTagId] }),
    });
    expect(res.status).to.equal(201);
    const { items: [sibling] } = await res.json();

    const { error, response } = await renamePrompt(sibling.id, 'What is the best running shoe?');
    expect(response.status).to.equal(409);
    expect(error).to.deep.equal({
      message: 'conflict\nprompt with name "What is the best running shoe?" already exists',
    });

    // Nothing mutated: the sibling keeps its text, and the seeded prompt is untouched.
    const { data: listed } = await listByTags([], { draft: true });
    expect(listed.items.map((p) => p.name))
      .to.have.members(['What is the best running shoe?', 'A sibling prompt']);
  });

  it('404s a rename of an unknown prompt id', async () => {
    const { error, response } = await renamePrompt('00000000-0000-4000-8000-000000000000', 'Whatever');
    expect(response.status).to.equal(404);
    expect(error).to.deep.equal({ message: 'not found' });
  });

  // `is_updated` mirrors the LIVE layer, not whether the rename landed (live-pinned 2026-07-15):
  // a draft-only prompt (`is_new: true`) always answers false while the rename still applies.
  it('applies the rename but answers is_updated: false for a draft-only prompt', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Draft-only rename probe'], tag_ids: [SEED_IDS.categoryTagId] }),
    });
    expect(res.status).to.equal(201);
    const { items: [draft] } = await res.json();

    const { data: renamed, error } = await renamePrompt(draft.id, 'Draft-only rename probe v2');
    expect(error).to.equal(undefined);
    expect(renamed).to.deep.equal({
      id: draft.id,
      name: 'Draft-only rename probe v2',
      is_updated: false,
    });

    const { data: listed } = await listByTags([], { draft: true });
    expect(listed.items.map((p) => p.name)).to.include('Draft-only rename probe v2');
  });

  // Live applies `new_name` literally — an empty or omitted one renames the prompt to ''
  // with no validation error (live-pinned 2026-07-15; the request schema does not require
  // `new_name`). Only a request with NO body at all is rejected: 400 {"message":"EOF"}.
  it('renames to the empty string for an empty or omitted new_name; 400s EOF for no body', async () => {
    const res = await fetch(promptsUrl(), {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ items: ['Empty-name rename probe'], tag_ids: [SEED_IDS.categoryTagId] }),
    });
    expect(res.status).to.equal(201);
    const { items: [victim] } = await res.json();

    const { data: emptied, error: emptyErr } = await renamePrompt(victim.id, '');
    expect(emptyErr).to.equal(undefined);
    expect(emptied).to.deep.equal({ id: victim.id, name: '', is_updated: false });

    // Omitted `new_name` behaves identically (the `?? ''` fallback, matching live).
    const { data: omitted, error: omittedErr } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT, prompt_id: victim.id },
        },
        body: {},
      },
    );
    expect(omittedErr).to.equal(undefined);
    expect(omitted).to.deep.equal({ id: victim.id, name: '', is_updated: false });

    // `new_name: null` coalesces the same way — live accepts null and renames to '' (pinned
    // 2026-07-15); overlay CR18 marks the field nullable so request validation admits it.
    const nulled = await fetch(`${promptsUrl()}/${victim.id}/rename`, {
      method: 'POST',
      headers: jsonAuth,
      body: JSON.stringify({ new_name: null }),
    });
    expect(nulled.status).to.equal(200);
    expect(await nulled.json()).to.deep.equal({ id: victim.id, name: '', is_updated: false });

    const noBody = await fetch(`${promptsUrl()}/${victim.id}/rename`, {
      method: 'POST',
      headers: { Authorization: 'Bearer e2e-token', Accept: 'application/json' },
    });
    expect(noBody.status).to.equal(400);
    expect(await noBody.json()).to.deep.equal({ message: 'EOF' });
  });

  it('__reset restores the seed between mutations', async () => {
    await client.POST('/v1/workspaces/{id}/projects', {
      params: { path: { id: SEED_WORKSPACE } },
      body: { name: 'Transient', type: 'ai' },
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

  // ───────────────────────────────────────────────────────────────────────
  // Live-verified parity: the auto-generated (non-stateful) endpoints + the two
  // drift fixes. These assert that the mock's response SHAPE matches what the real
  // Semrush API returns (recorded live 2026-06-25).
  // Shapes only — no live customer content is encoded here.
  // ───────────────────────────────────────────────────────────────────────

  it('addAiModel (v2) responds 201 Created with model { id, icon, ... }, matching live (drift D2/CR7)', async () => {
    const { data, response, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        // A synthetic id absent from the catalog, to exercise the unmodelled fallback. (The seed's
        // own model is now the catalog `search-gpt`, so posting SEED_IDS.aiModelId would resolve —
        // not fall back.)
        body: { model_id: '00000000-0000-4000-8000-000000000000' },
      },
    );
    expect(error).to.equal(undefined);
    expect(response.status).to.equal(201);
    // Live resolves the catalog model's icon onto the add response (verified 2026-06-25).
    expect(data.model).to.include.keys('id', 'icon');
    // Unmodelled id → the catalog-valid factory default (search-gpt / ChatGPT) is kept, with the
    // posted id preserved.
    expect(data.model.name).to.equal('ChatGPT');
    expect(data.model.key).to.equal('search-gpt');
    expect(data.model.id).to.equal('00000000-0000-4000-8000-000000000000');
  });

  // Regression: a known catalog model_id must echo THAT model's name + icon — not the
  // createAiModelMock GPT-4o default. Before the catalog lookup, every added model read back as
  // GPT-4o, so a project tracking Perplexity/Gemini showed identical "GPT-4o" rows. Live returns
  // the catalog name + icon with an EMPTY key on the add path (verified 2026-06-25).
  it('addAiModel (v2) resolves the posted model_id to the real catalog name + icon', async () => {
    const perplexity = AI_MODEL_CATALOG.find((m) => m.key === 'perplexity');
    const { data, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { model_id: perplexity.id },
      },
    );
    expect(error).to.equal(undefined);
    expect(data.model.id).to.equal(perplexity.id);
    expect(data.model.name).to.equal('Perplexity');
    expect(data.model.icon).to.equal('perplexity');
    // Live add path returns the catalog name + icon but an empty `key`.
    expect(data.model.key).to.equal('');
  });

  it('createProjectTags returns a top-level array, matching the live API (drift D1/CR6)', async () => {
    const { data, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['Probe One', 'Probe Two'], parent_id: SEED_IDS.categoryRootTagId },
      },
    );
    expect(error).to.equal(undefined);
    // Live returns [{ id, name, children_count, keyword_count }], NOT a single object.
    expect(data).to.be.an('array');
  });

  // Under the dimension-root model a customer category is a bare-named CHILD of the `category`
  // root, never a root itself. A standalone tag created via createProjectTags must PERSIST so a
  // 0-prompt category reads back via GET /aio/tags. parent_id + search are spec-required query
  // params (the consumer sends them); parent_id = the `category` root lists the categories.
  it('persists createProjectTags and reads a new 0-prompt category back via GET /aio/tags', async () => {
    const { error: createError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['Hydration'], parent_id: SEED_IDS.categoryRootTagId },
      },
    );
    expect(createError).to.equal(undefined);

    const { data: listed, error: listError } = await listTags(SEED_IDS.categoryRootTagId);
    expect(listError).to.equal(undefined);
    // Categories: the baked `Running Shoes` + the just-created `Hydration`.
    expect(listed.total).to.equal(2);
    expect(listed.items.map((t) => t.name)).to.have.members(['Running Shoes', 'Hydration']);
    // The stored/listed shape is an AIOTag (prompts_count), not a TreeNodeResponse (keyword_count).
    const created = listed.items.find((t) => t.name === 'Hydration');
    expect(created).to.include.keys('id', 'name', 'prompts_count');
    // …and it hangs off the `category` root, carrying a one-leaf breadcrumb.
    expect(created.parent_id).to.equal(SEED_IDS.categoryRootTagId);
    expect(created.path.map((leaf) => leaf.name)).to.deep.equal(['category']);

    // The root level is untouched: still exactly the four dimension roots.
    const { data: roots } = await listTags('');
    expect(roots.items.map((t) => t.name)).to.have.members(DIMENSION_ROOT_NAMES);
  });

  // Gate 7 (verified live 2026-07-02): the create endpoint does NOT dedupe — re-creating a name
  // that already exists at the same parent level 500s, ATOMICALLY (nothing in the batch is
  // written). This pins the resolve-before-create discipline every consumer must follow; a mock
  // that silently reused would give false confidence and hide a dropped resolve-before-create in an
  // IT/e2e. The `search` query still filters stored tags by name substring.
  it('createProjectTags 500s on a same-name/same-parent duplicate (atomic); search filters', async () => {
    const post = (names) => client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names, parent_id: SEED_IDS.categoryRootTagId },
      },
    );
    const { error: firstErr } = await post(['Alpha', 'Beta']);
    expect(firstErr).to.equal(undefined);

    // A batch that re-creates the already-stored `Alpha` (even alongside a new name) 500s, and
    // writes NOTHING — resolve-before-create is the consumer's job, not the endpoint's.
    const { response: dupRes } = await post(['Alpha', 'Gamma']);
    expect(dupRes.status).to.equal(500);

    // categories: the baked `Running Shoes` + Alpha + Beta. The collided batch created neither a
    // duplicate Alpha nor the co-batched Gamma (atomic), so Gamma is absent.
    const { data: all } = await listTags(SEED_IDS.categoryRootTagId);
    expect(all.total).to.equal(3);
    expect(all.items.map((t) => t.name)).to.have.members(['Running Shoes', 'Alpha', 'Beta']);

    const { data: filtered } = await listTags(SEED_IDS.categoryRootTagId, 'beta');
    expect(filtered.items.map((t) => t.name)).to.deep.equal(['Beta']);
  });

  // `search` is scoped to ONE level and never descends (verified live) — a nested tag is unfindable
  // from the root level. Every consumer of GET /aio/tags inherits this, so the mock must mirror it:
  // the dimension-root model deliberately trades type-to-find for grouping.
  it('search never descends: a nested tag is invisible from the root level', async () => {
    // `Running Shoes` (depth 2) and `Trail` (depth 3) both exist, and neither is a root.
    const { data: fromRoot } = await listTags('', 'running');
    expect(fromRoot.items).to.have.length(0);
    const { data: fromRootTrail } = await listTags('', 'trail');
    expect(fromRootTrail.items).to.have.length(0);

    // Each is findable only at its own level.
    const { data: atCategoryRoot } = await listTags(SEED_IDS.categoryRootTagId, 'running');
    expect(atCategoryRoot.items.map((t) => t.name)).to.deep.equal(['Running Shoes']);
    const { data: atCategory } = await listTags(SEED_IDS.categoryTagId, 'trail');
    expect(atCategory.items.map((t) => t.name)).to.deep.equal(['Trail']);
  });

  // A depth-3 tag's `path[]` is the FULL ancestry, root-first, excluding itself — so `path[0]` is
  // its dimension at any depth. A breadcrumb truncated to the direct parent would resolve a
  // sub-category's dimension to its category, which every downstream consumer keys off.
  it('reads a depth-3 sub-category with a two-leaf root-first breadcrumb', async () => {
    const { data: children } = await listTags(SEED_IDS.categoryTagId);
    const trail = children.items.find((t) => t.name === 'Trail');

    expect(trail.parent_id).to.equal(SEED_IDS.categoryTagId);
    expect(trail.path.map((leaf) => leaf.name)).to.deep.equal(['category', 'Running Shoes']);
    expect(trail.path.map((leaf) => leaf.id))
      .to.deep.equal([SEED_IDS.categoryRootTagId, SEED_IDS.categoryTagId]);
    // The root leaf carries no parent; the deeper leaf carries the leaf before it.
    expect(trail.path[0]).to.not.have.property('parent_id');
    expect(trail.path[1].parent_id).to.equal(SEED_IDS.categoryRootTagId);
  });

  // A sub-category and a closed-dimension value may share a bare NAME and must stay distinct tags —
  // ids are keyed on (parent, name). This is the cross-dimension collision case the dimension-root
  // model must survive; the seed bakes it so it is exercised rather than assumed.
  it('keeps a sub-category and a same-named source value as distinct tags', async () => {
    const { data: subcategories } = await listTags(SEED_IDS.categoryTagId);
    const { data: sources } = await listTags(SEED_IDS.sourceRootTagId);

    const subHuman = subcategories.items.find((t) => t.name === 'human');
    const srcHuman = sources.items.find((t) => t.name === 'human');

    expect(subHuman.id).to.equal(SEED_IDS.childCollidingTagId);
    expect(srcHuman.id).to.equal(SEED_IDS.sourceHumanTagId);
    expect(subHuman.id).to.not.equal(srcHuman.id);
    expect(subHuman.path[0].name).to.equal('category');
    expect(srcHuman.path[0].name).to.equal('source');
  });

  // __reset restores the boot seed (the four dimension roots, no ad-hoc tags), so a created
  // standalone tag is cleared — proving the tags collection rides the seed/reset lifecycle like
  // every other stateful resource.
  it('clears created tags on __reset (tags ride the seed lifecycle)', async () => {
    await client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/tags', {
      params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
      body: { names: ['Ephemeral'], parent_id: SEED_IDS.categoryRootTagId },
    });
    await fetch(`${baseUrl}/__reset`, { method: 'POST' });

    // back to the baked baseline: the four dimension roots, and `Ephemeral` is gone
    const { data: roots } = await listTags('');
    expect(roots.total).to.equal(4);
    expect(roots.items.map((t) => t.name)).to.have.members(DIMENSION_ROOT_NAMES);
    const { data: categories } = await listTags(SEED_IDS.categoryRootTagId);
    expect(categories.items.map((t) => t.name)).to.deep.equal(['Running Shoes']);
  });

  // Nested create: a child is created with a `parent_id` and reads back under that parent, with a
  // `path[]` ancestor breadcrumb; the parent's `children_count` reflects it. Depth is uncapped, so
  // this creates a category (depth 2) and a sub-category (depth 3) under the `category` root.
  it('creates a child under a parent (parent_id) and reads it back with path + children_count', async () => {
    const { data: categories } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['Footwear'], parent_id: SEED_IDS.categoryRootTagId },
      },
    );
    const parentId = categories[0].id;

    const { data: childCreate } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['Sneakers'], parent_id: parentId },
      },
    );
    // the create echo carries the parent linkage
    expect(childCreate[0]).to.include({ name: 'Sneakers', parent_id: parentId });

    // GET with a non-empty parent_id returns that tag's children, each with a full breadcrumb
    const { data: children } = await listTags(parentId);
    expect(children.items.map((t) => t.name)).to.deep.equal(['Sneakers']);
    expect(children.items[0].parent_id).to.equal(parentId);
    expect(children.items[0].children_count).to.equal(0); // the new leaf has no children of its own
    // root-first ancestry, excluding the tag itself: the `category` root, then `Footwear`
    expect(children.items[0].path).to.deep.equal([
      { id: SEED_IDS.categoryRootTagId, name: 'category' },
      { id: parentId, name: 'Footwear', parent_id: SEED_IDS.categoryRootTagId },
    ]);

    // the parent now reports children_count 1 and hangs off the `category` root
    const { data: categoryList } = await listTags(SEED_IDS.categoryRootTagId, 'footwear');
    expect(categoryList.items[0]).to.include({ name: 'Footwear', children_count: 1 });
    expect(categoryList.items[0].parent_id).to.equal(SEED_IDS.categoryRootTagId);

    // A ROOT carries neither key: live OMITS `parent_id` and `path` entirely rather than
    // nulling them (verified 2026-07-10 against prod — `has_parent_id: false`). A tag with no
    // `path` is therefore a root, and its own name is its dimension.
    const { data: rootList } = await listTags('', 'category');
    expect(rootList.items[0]).to.include({ name: 'category' });
    expect(rootList.items[0]).to.not.have.property('parent_id');
    expect(rootList.items[0]).to.not.have.property('path');
  });

  // The boot seed bakes the dimension-root tree (`category` → `Running Shoes` → `Trail`/`human`),
  // so consumers get a populated Categories tree out of the box.
  it('reads the baked nested taxonomy from the boot seed', async () => {
    const { data: children } = await listTags(SEED_IDS.categoryTagId);
    expect(children.items.map((t) => t.name)).to.deep.equal(['Trail', 'human']);
    expect(children.items[0].path).to.deep.equal([
      { id: SEED_IDS.categoryRootTagId, name: 'category' },
      {
        id: SEED_IDS.categoryTagId,
        name: 'Running Shoes',
        parent_id: SEED_IDS.categoryRootTagId,
      },
    ]);
  });

  // PATCH (aio-update-tag) re-parents / promotes a tag in place. Promoting the baked child `Trail`
  // to a root clears its parent_id, so it leaves the parent's children and appears among the roots.
  it('re-parents a tag via PATCH (promote a child to a root)', async () => {
    const { data: patched, error: patchError, response: patchResp } = await client.PATCH(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}',
      {
        params: {
          path: {
            id: SEED_WORKSPACE, project_id: SEED_PROJECT, tag_id: SEED_IDS.childTagId,
          },
        },
        body: { name: 'Trail', parent_id: '' },
      },
    );
    expect(patchError).to.equal(undefined);
    expect(patchResp.status).to.equal(200); // live responds 200, not 201 (D1/CR11)
    expect(patched).to.include({ id: SEED_IDS.childTagId, name: 'Trail' });

    // the promoted tag now sits alongside the dimension roots — a stranded tag, exactly the failure
    // mode the reshape's post-condition ("the root listing is exactly the four dimension roots")
    // exists to catch
    const { data: rootsAfter } = await listTags('');
    expect(rootsAfter.items.map((t) => t.name))
      .to.have.members([...DIMENSION_ROOT_NAMES, 'Trail']);

    // …and it has left its category, whose remaining sub-category is untouched
    const { data: childrenAfter } = await listTags(SEED_IDS.categoryTagId);
    expect(childrenAfter.items.map((t) => t.name)).to.deep.equal(['human']);
  });

  // PATCH's `parent_id` is a live-verified 3-way switch (serenity-docs#24 §3.1 gate 1, CR15), NOT
  // a simple presence check: an explicit `null` promotes to root (asserted above via the
  // equivalent `''` live shape), an OMITTED key preserves the current parent (asserted here), and
  // a non-empty string re-parents (asserted by the rename test below). A rename-only caller that
  // never mentions `parent_id` must not silently un-parent the tag.
  it('PATCH with parent_id OMITTED preserves the tag\'s current parent (rename-only)', async () => {
    const { data: patched, error: patchError, response: patchResp } = await client.PATCH(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}',
      {
        params: {
          path: {
            id: SEED_WORKSPACE, project_id: SEED_PROJECT, tag_id: SEED_IDS.childTagId,
          },
        },
        // No parent_id key at all — a rename-only call. NB: this leaves the seed's
        // childTagId renamed to 'Ridge' for the rest of this test only (beforeEach resets state
        // between tests, so this doesn't leak into the next one).
        body: { name: 'Ridge' },
      },
    );
    expect(patchError).to.equal(undefined);
    expect(patchResp.status).to.equal(200);
    expect(patched).to.include({
      id: SEED_IDS.childTagId, name: 'Ridge', parent_id: SEED_IDS.categoryTagId,
    });

    const { data: childrenAfter } = await listTags(SEED_IDS.categoryTagId);
    expect(childrenAfter.items.map((t) => t.name)).to.deep.equal(['Ridge', 'human']);
  });

  // Same gate, the other literal: an explicit JSON `null` (not merely a falsy/empty string)
  // promotes a child to a root. CR15 makes this pass Counterfact's request validation.
  it('PATCH with an explicit null parent_id promotes a child to a root', async () => {
    const { data: patched, error: patchError, response: patchResp } = await client.PATCH(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}',
      {
        params: {
          path: {
            id: SEED_WORKSPACE, project_id: SEED_PROJECT, tag_id: SEED_IDS.childTagId,
          },
        },
        // NB: this leaves the seed's childTagId renamed to 'Trail' and promoted to a root for
        // the rest of this test only (beforeEach resets state between tests).
        body: { name: 'Trail', parent_id: null },
      },
    );
    expect(patchError).to.equal(undefined);
    expect(patchResp.status).to.equal(200);
    // parentIdField omits the key entirely for a root (same convention as the create path) rather
    // than echoing `null` — the exact omitted-vs-null shape on THIS response is unverified live
    // (CR13's null verification covers the GET/list AIOTag path, not PATCH's TreeNodeResponse), so
    // this only asserts the parent link is gone, not which of the two falsy shapes represents it.
    expect(patched.parent_id).to.not.exist;

    const { data: rootsAfter } = await listTags('');
    expect(rootsAfter.items.map((t) => t.name))
      .to.have.members([...DIMENSION_ROOT_NAMES, 'Trail']);
  });

  // PATCH also RENAMES in place: changing `name` (keeping the parent) is reflected in the 200
  // response and a subsequent GET. Exercises the full route-handler→response roundtrip for a
  // rename — the stateful unit test covers only the store layer, not the handler's response build.
  it('renames a tag via PATCH (new name reflected in the response and on read)', async () => {
    const { data: renamed, error: renameError } = await client.PATCH(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}',
      {
        params: {
          path: {
            id: SEED_WORKSPACE, project_id: SEED_PROJECT, tag_id: SEED_IDS.childTagId,
          },
        },
        body: { name: 'Hiking', parent_id: SEED_IDS.categoryTagId },
      },
    );
    expect(renameError).to.equal(undefined);
    expect(renamed).to.include({
      id: SEED_IDS.childTagId, name: 'Hiking', parent_id: SEED_IDS.categoryTagId,
    });

    // the child still sits under the same parent, now carrying the new name
    const { data: children } = await listTags(SEED_IDS.categoryTagId);
    expect(children.items.map((t) => t.name)).to.deep.equal(['Hiking', 'human']);
    expect(children.items[0].id).to.equal(SEED_IDS.childTagId);
  });

  // PATCH an unknown tag id → 404 { message: 'not found' } (verified live 2026-07-01; D2/CR12).
  it('PATCHing an unknown tag id returns 404 not found', async () => {
    const { data, error, response } = await client.PATCH(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}',
      {
        params: {
          path: {
            id: SEED_WORKSPACE,
            project_id: SEED_PROJECT,
            tag_id: '00000000-0000-4000-8000-000000000000',
          },
        },
        body: { name: 'ZZ-nope', parent_id: '' },
      },
    );
    expect(data).to.equal(undefined);
    expect(response.status).to.equal(404);
    expect(error).to.deep.equal({ message: 'not found' });
  });

  // Multi-market: one category name is registered on N market projects via N createProjectTags
  // calls; each project keeps its OWN tag collection (tags:{ws}:{pid}), never global. Creating a
  // tag on project A must not surface on project B in the same workspace.
  it('scopes tags per project (multi-market isolation)', async () => {
    const ws = globalThis.crypto.randomUUID();
    const projectA = globalThis.crypto.randomUUID();
    const projectB = globalThis.crypto.randomUUID();
    const snapshot = buildSeed({
      workspaceId: ws,
      projects: [{ id: projectA, name: 'Market A' }, { id: projectB, name: 'Market B' }],
    });
    await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    await client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/tags', {
      params: { path: { id: ws, project_id: projectA } },
      body: { names: ['category'] },
    });

    const listProjectRoots = (pid) => client.GET('/v2/workspaces/{id}/projects/{project_id}/aio/tags', {
      params: { path: { id: ws, project_id: pid }, query: { parent_id: '', search: '' } },
    });
    const { data: aTags } = await listProjectRoots(projectA);
    const { data: bTags } = await listProjectRoots(projectB);
    expect(aTags.items.map((t) => t.name)).to.deep.equal(['category']);
    expect(bTags.total).to.equal(0);

    // restore the boot seed (__seed rewrote the reset baseline) so later cases stay independent.
    await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SEEDS['workspace-with-data']),
    });
  });

  // DELETE removes the standalone project tag (so a 0-prompt orphan can be cleaned up). The prompts
  // themselves are never deleted — only the tag reference is detached from them (see the gate-4
  // test below, which exercises a tag the seeded prompt actually carries).
  it('deletes a project tag without deleting prompts', async () => {
    const { data: created } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['Doomed'], parent_id: SEED_IDS.categoryRootTagId },
      },
    );
    const { response: delRes } = await client.DELETE(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { prompt_id: '' },
        },
        body: { ids: [created[0].id] },
      },
    );
    expect(delRes.status).to.equal(204);

    // `Doomed` is gone; the baked category survives (delete targets only the id sent) …
    const { data: categoriesAfter } = await listTags(SEED_IDS.categoryRootTagId);
    expect(categoriesAfter.items.map((t) => t.name)).to.deep.equal(['Running Shoes']);
    // … and the four dimension roots are untouched.
    const { data: rootsAfter } = await listTags('');
    expect(rootsAfter.items.map((t) => t.name)).to.have.members(DIMENSION_ROOT_NAMES);

    // The seeded prompt survives — deleting a tag never deletes a prompt. `Doomed` carried none,
    // so the prompt's own tags are untouched too.
    const { data: prompts } = await listByTags([]);
    expect(prompts.total).to.equal(1);
    expect(prompts.items[0].id).to.equal(SEED_IDS.promptId);
    expect(prompts.items[0].tags.map((t) => t.id)).to.include(SEED_IDS.categoryTagId);
  });

  // Gate 4 (verified live 2026-07-02): deleting a tag DETACHES it from every carrying prompt. The
  // prompt survives without it and stops matching `by_tags` on the removed id. A mock that left the
  // tag embedded would keep answering by_tags for an id that no longer exists.
  it('detaches a deleted tag from the prompts carrying it', async () => {
    // The seeded prompt carries the `branded` value under the `type` root.
    const { data: before } = await listByTags([SEED_IDS.typeBrandedTagId]);
    expect(before.items.map((p) => p.id)).to.include(SEED_IDS.promptId);

    const { response: delRes } = await client.DELETE(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: {
          path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
          query: { prompt_id: '' },
        },
        body: { ids: [SEED_IDS.typeBrandedTagId] },
      },
    );
    expect(delRes.status).to.equal(204);

    // by_tags on the deleted id no longer matches …
    const { data: after } = await listByTags([SEED_IDS.typeBrandedTagId]);
    expect(after.items.map((p) => p.id)).to.not.include(SEED_IDS.promptId);

    // … the prompt itself survives, minus that one tag, keeping every other …
    const { data: all } = await listByTags([]);
    expect(all.total).to.equal(1);
    const [prompt] = all.items;
    expect(prompt.tags.map((t) => t.id)).to.not.include(SEED_IDS.typeBrandedTagId);
    expect(prompt.tags.map((t) => t.id)).to.have.members([
      SEED_IDS.categoryTagId,
      SEED_IDS.childCollidingTagId,
      SEED_IDS.sourceHumanTagId,
      SEED_IDS.intentCommercialTagId,
    ]);

    // … and the same-named `human` sub-category is untouched by the source value's deletion.
    const { data: subcategories } = await listTags(SEED_IDS.categoryTagId);
    expect(subcategories.items.map((t) => t.id)).to.include(SEED_IDS.childCollidingTagId);
  });

  // A prompt whose ONLY tag is deleted becomes fully unassigned — not orphaned, not deleted.
  it('leaves a prompt fully unassigned when its last tag is deleted', async () => {
    const delTags = (ids) => client.DELETE('/v2/workspaces/{id}/projects/{project_id}/aio/tags', {
      params: {
        path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
        query: { prompt_id: '' },
      },
      body: { ids },
    });
    const { response } = await delTags([
      SEED_IDS.categoryTagId,
      SEED_IDS.childCollidingTagId,
      SEED_IDS.sourceHumanTagId,
      SEED_IDS.intentCommercialTagId,
      SEED_IDS.typeBrandedTagId,
    ]);
    expect(response.status).to.equal(204);

    const { data: all } = await listByTags([]);
    expect(all.total).to.equal(1);
    expect(all.items[0].id).to.equal(SEED_IDS.promptId);
    expect(all.items[0].tags).to.deep.equal([]);
  });

  // Anchors the DELETE-orphan limitation documented in the tags.js header: deleting a parent does
  // NOT cascade to or re-parent its children (live behaviour unverified — serenity-docs#21 §7). The
  // orphaned child then drops out of BOTH listings a consumer would use — it is not among the roots
  // (its parent_id is still truthy), and reaching it as a "child" needs the deleted parent's id.
  it('leaves a child orphaned (invisible) when its parent is deleted (documented limitation)', async () => {
    const delTag = (ids) => client.DELETE('/v2/workspaces/{id}/projects/{project_id}/aio/tags', {
      params: {
        path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT },
        query: { prompt_id: '' },
      },
      body: { ids },
    });
    // delete the baked category while its sub-categories still point at it
    const { response: delRes } = await delTag([SEED_IDS.categoryTagId]);
    expect(delRes.status).to.equal(204);

    // the children are not among the roots (their parent_id is still the deleted id)
    const { data: roots } = await listTags('');
    expect(roots.items.map((t) => t.name)).to.have.members(DIMENSION_ROOT_NAMES);
    // they survive ONLY as children of the now-deleted parent id — reachable via that stale id
    const { data: orphans } = await listTags(SEED_IDS.categoryTagId);
    expect(orphans.items.map((t) => t.id))
      .to.deep.equal([SEED_IDS.childTagId, SEED_IDS.childCollidingTagId]);
  });

  // Request validation is enabled, so GET /aio/tags 400s when a required query param
  // (parent_id/search are swagger-`required`) is omitted, before the handler runs — matching the
  // live 400 and the contract the PR/docs/JSDoc claim. Mirrors the getBrandTopics 400 test: raw
  // fetch so we can omit a param the typed client would otherwise require.
  it('getProjectTags 400s when a required query param is missing (request validation)', async () => {
    const base = `${baseUrl}/v2/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/aio/tags`;
    const auth = { headers: { Authorization: 'Bearer e2e-token' } };

    const noParent = await fetch(`${base}?search=`, auth);
    expect(noParent.status).to.equal(400);
    expect(await noParent.text()).to.match(/parent_id/);

    const noSearch = await fetch(`${base}?parent_id=`, auth);
    expect(noSearch.status).to.equal(400);
    expect(await noSearch.text()).to.match(/search/);
  });

  // The catalog is the FULL live taxonomy (captured 2026-06-25), so assert the real counts +
  // a known entry, not just the envelope — the consumer resolves language code → UUID against it.
  it('listLanguages returns the full live language taxonomy (38, real UUIDs)', async () => {
    const { data, error } = await client.GET('/v1/languages', {});
    expect(error).to.equal(undefined);
    expect(data).to.include.keys(['page', 'total', 'items']);
    expect(data.total).to.equal(38);
    expect(data.items).to.be.an('array').with.length(38);
    expect(data.items[0]).to.include.keys(['id', 'name']);
    // The mock-only `iso` column (used by the project read-view resolver) is NOT served here — the
    // live catalog item is just `{ id, name }`.
    expect(data.items[0]).to.not.have.property('iso');
    expect(data.items).to.deep.include({ id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'English' });
  });

  it('listGlobalAiModels returns the full live model taxonomy (11, real keys)', async () => {
    const { data, error } = await client.GET('/v1/ai_models', {});
    expect(error).to.equal(undefined);
    expect(data).to.include.keys(['page', 'total', 'items']);
    expect(data.total).to.equal(11);
    expect(data.items).to.be.an('array').with.length(11);
    expect(data.items[0]).to.include.keys(['id', 'name', 'key', 'icon']);
    expect(data.items.map((m) => m.key)).to.include.members(['perplexity', 'gemini-2.5-flash']);
  });

  it('resolveUrl canonicalizes a raw brand URL (scheme + www stripped, path/subdomain preserved)', async () => {
    // The endpoint the consumer calls before writing a brand URL (overlay CR16, serenity-docs#25).
    const resolve = (primaryUrl) => client.GET('/v1/url/resolve', {
      params: { query: { primary_url: primaryUrl } },
    });

    const { data, error } = await resolve('https://www.lovesac.com');
    expect(error).to.equal(undefined);
    expect(data).to.deep.equal({ domain: 'lovesac.com', primary_url: 'lovesac.com', is_valid: true });

    // path preserved on primary_url, stripped on domain.
    const { data: withPath } = await resolve('http://www.lovesac.com/products');
    expect(withPath).to.deep.equal({ domain: 'lovesac.com', primary_url: 'lovesac.com/products', is_valid: true });

    // non-www subdomain preserved on primary_url, collapsed to the apex on domain.
    const { data: sub } = await resolve('https://blog.hubspot.com');
    expect(sub).to.deep.equal({ domain: 'hubspot.com', primary_url: 'blog.hubspot.com', is_valid: true });
  });

  it('resolveUrl returns is_valid:false with empty strings (HTTP 200) for garbage input', async () => {
    // The live trap (serenity-docs#25 §0): unresolvable input is a 200 with empty strings, NOT an
    // error — the consumer must check is_valid and never write the empty value.
    const { data, error, response } = await client.GET('/v1/url/resolve', {
      params: { query: { primary_url: 'not a url !!!' } },
    });
    expect(error).to.equal(undefined);
    expect(response.status).to.equal(200);
    expect(data).to.deep.equal({ domain: '', primary_url: '', is_valid: false });
  });

  // Request validation 400s a MISSING required query param before the handler runs (same mechanism
  // as getBrandTopics). Counterfact enforces presence but NOT the spec's minLength:1, so an EMPTY
  // value (`primary_url=`) falls through to the handler, returning 200 is_valid:false — a benign
  // divergence from live (which 400s empty too): empty is the same "don't write it" signal the
  // consumer already keys off is_valid. Raw fetch so we can shape a request the typed client bars.
  it('resolveUrl 400s on a missing primary_url; an empty value 200s is_valid:false', async () => {
    const auth = { headers: { Authorization: 'Bearer e2e-token' } };

    const missing = await fetch(`${baseUrl}/v1/url/resolve`, auth);
    expect(missing.status).to.equal(400);
    expect(await missing.text()).to.match(/primary_url/);

    const empty = await fetch(`${baseUrl}/v1/url/resolve?primary_url=`, auth);
    expect(empty.status).to.equal(200);
    expect(await empty.json()).to.deep.equal({ domain: '', primary_url: '', is_valid: false });
  });

  it('getBrandTopics returns a top-level array of { topic, volume, prompts }', async () => {
    const { data, error } = await client.GET('/v1/workspaces/{id}/brand-topics', {
      params: { path: { id: SEED_WORKSPACE }, query: { domain: 'example.com', country: 'us' } },
    });
    expect(error).to.equal(undefined);
    expect(data).to.be.an('array');
  });

  // Request validation is enabled, so the runner 400s a request missing a required query param
  // (domain/country on brand-topics are swagger-`required`) before the handler runs — matching the
  // live 400. Body is the validator's message; status is the contract the consumer keys on.
  // Raw fetch so we can omit a param the typed client would otherwise require.
  it('getBrandTopics 400s when a required query param is missing (request validation)', async () => {
    const base = `${baseUrl}/v1/workspaces/${SEED_WORKSPACE}/brand-topics`;
    const auth = { headers: { Authorization: 'Bearer e2e-token' } };

    const noDomain = await fetch(`${base}?country=us`, auth);
    expect(noDomain.status).to.equal(400);
    expect(await noDomain.text()).to.match(/domain/);

    const noCountry = await fetch(`${base}?domain=example.com`, auth);
    expect(noCountry.status).to.equal(400);
    expect(await noCountry.text()).to.match(/country/);
  });

  // Request validation also covers required body fields: project-create requires `type`
  // (model.ProjectRequest required: [name, type]); omitting it 400s before the handler.
  it('createProject 400s when a required body field is missing (request validation)', async () => {
    const res = await fetch(`${baseUrl}/v1/workspaces/${SEED_WORKSPACE}/projects`, {
      method: 'POST',
      headers: { Authorization: 'Bearer e2e-token', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'no-type' }),
    });
    expect(res.status).to.equal(400);
    expect(await res.text()).to.match(/type/);
  });

  it('listBenchmarks returns the seeded own-brand benchmark', async () => {
    const { data, error } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(error).to.equal(undefined);
    expect(data.aio_benchmarks).to.be.an('array').with.length(1);
    expect(data.aio_benchmarks[0]).to.include({ id: SEED_IDS.benchmarkId, main_brand: true });
    // CR10: a listed benchmark carries project_id (the path project) + primary_url/root_domain
    // (mirroring its domain), all confirmed live 2026-06-25. The GET handler stamps project_id.
    const own = data.aio_benchmarks[0];
    expect(own.project_id).to.equal(SEED_PROJECT);
    expect(own).to.have.property('primary_url', own.domain);
    expect(own).to.have.property('root_domain', own.domain);
  });

  it('listBenchmarks re-derives primary_url/root_domain off the domain (CR10)', async () => {
    // Seed a benchmark whose STORED primary_url/root_domain diverge from its domain — as a PUT that
    // changed the domain, or a pre-CR10 row, would leave them. Live always mirrors the CURRENT
    // domain, so the list handler must re-derive, not echo the stale stored value. This is the only
    // gate on that handler (it is coverage-excluded), and it fails if the handler stops re-mapping.
    const ws = globalThis.crypto.randomUUID();
    const pid = globalThis.crypto.randomUUID();
    const bid = globalThis.crypto.randomUUID();
    const snapshot = buildSeed({
      workspaceId: ws,
      projects: [{
        id: pid,
        name: 'Stale-bench',
        benchmarks: [createBenchmarkMock({
          id: bid,
          main_brand: true,
          domain: 'real.example',
          primary_url: 'stale.example',
          root_domain: 'stale.example',
        })],
      }],
    });
    await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    const { data } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path: { id: ws, project_id: pid } } },
    );
    const b = data.aio_benchmarks.find((x) => x.id === bid);
    // re-derived off domain (NOT the stale stored value); project_id stamped from the path.
    expect(b).to.include({
      domain: 'real.example',
      primary_url: 'real.example',
      root_domain: 'real.example',
      project_id: pid,
    });

    // restore the boot seed (__seed rewrote the reset baseline) so later cases stay independent.
    await fetch(`${baseUrl}/__seed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SEEDS['workspace-with-data']),
    });
  });

  // Mirrors the consumer's competitor-benchmark sync: create → list reflects → delete → gone.
  it('creates a benchmark (v2), lists it back (v1), then deletes it', async () => {
    const { data: created, error: createError } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: [{ brand_name: 'Competitor X', domain: 'competitor-x.example' }],
      },
    );
    expect(createError).to.equal(undefined);
    expect(created.ids).to.have.length(1);
    expect(created.existing_count).to.equal(0);

    const { data: listed } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    // seeded own-brand + the new competitor
    expect(listed.aio_benchmarks.map((b) => b.id)).to.include(created.ids[0]);

    // Live ack: 202 with an EMPTY body (verified 2026-06-25), not a BasicResponse. Raw fetch so the
    // empty body is asserted — the typed client swallows it, so a regression to a JSON body passes.
    // `Accept: application/json` (what the real serenity transport sends) pins the negotiation-
    // bypass fix: without the handler's content type this empty 202 would 406 (issue 1742).
    const benchUrl = `${baseUrl}/v1/workspaces/${SEED_WORKSPACE}`
      + `/projects/${SEED_PROJECT}/ai_models/benchmarks`;
    const rawBenchDel = await fetch(benchUrl, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer e2e-token',
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: created.ids }),
    });
    expect(rawBenchDel.status).to.equal(202);
    expect(await rawBenchDel.text()).to.equal('');
    const { data: after } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(after.aio_benchmarks.map((b) => b.id)).to.not.include(created.ids[0]);
  });

  // Live rejects a duplicate competitor (same brand name / alias / domain) with a hard 409, unlike
  // prompts which dedup into existing_count (#1745 second sweep).
  it('409s a duplicate benchmark (brand name or domain conflict)', async () => {
    const path = { id: SEED_WORKSPACE, project_id: SEED_PROJECT };
    const { error: firstErr } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path }, body: [{ brand_name: 'Dup Brand', domain: 'dup.example' }] },
    );
    expect(firstErr).to.equal(undefined);
    // Same domain again (different brand name) → conflict.
    const { response: dupRes, error: dupErr } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path }, body: [{ brand_name: 'Other Brand', domain: 'dup.example' }] },
    );
    expect(dupRes.status).to.equal(409);
    expect(dupErr).to.deep.equal({ message: 'ai benchmark conflict: duplicate brand name or alias' });
  });

  // The conflict set includes brand_aliases (case-insensitive); a later brand_name that matches an
  // existing alias must 409 too — exercises the alias spread/lowercase branch.
  it('409s a benchmark whose brand_name collides with an existing brand alias', async () => {
    const path = { id: SEED_WORKSPACE, project_id: SEED_PROJECT };
    const { error: firstErr } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path }, body: [{ brand_name: 'Aliased', domain: 'aliased.example', brand_aliases: ['MyAlias'] }] },
    );
    expect(firstErr).to.equal(undefined);
    const { response: dupRes } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path }, body: [{ brand_name: 'myalias', domain: 'other.example' }] },
    );
    expect(dupRes.status).to.equal(409);
  });

  // Two conflicting entries in ONE batch collide against each other (not just against stored rows).
  it('409s an intra-batch duplicate (two conflicting entries in one POST)', async () => {
    const { response } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: [
          { brand_name: 'Batch X', domain: 'batch-a.example' },
          { brand_name: 'Batch X', domain: 'batch-b.example' },
        ],
      },
    );
    expect(response.status).to.equal(409);
  });

  // The intra-batch check is generic across token types — a shared DOMAIN (distinct brand names)
  // within a single batch must 409 too, not just a shared brand name.
  it('409s an intra-batch domain collision (distinct names, same domain in one POST)', async () => {
    const { response } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: [
          { brand_name: 'Batch Y', domain: 'batch-dup.example' },
          { brand_name: 'Batch Z', domain: 'batch-dup.example' },
        ],
      },
    );
    expect(response.status).to.equal(409);
  });

  // Mirrors the consumer's updateBenchmark: PUT a brand_aliases re-sync, list reflects it.
  it('updates a benchmark in place (PUT v1) and the list reflects the change', async () => {
    // Live ack: 202 with an EMPTY body (verified 2026-06-25) — raw fetch asserts the empty body.
    // `Accept: application/json` pins the negotiation-bypass fix (406 otherwise — issue 1742).
    const benchPutUrl = `${baseUrl}/v1/workspaces/${SEED_WORKSPACE}`
      + `/projects/${SEED_PROJECT}/ai_models/benchmarks/${SEED_IDS.benchmarkId}`;
    const rawBenchPut = await fetch(benchPutUrl, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer e2e-token',
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ brand_aliases: ['Adobe Inc', 'Adobe Systems'] }),
    });
    expect(rawBenchPut.status).to.equal(202);
    expect(await rawBenchPut.text()).to.equal('');

    const { data: listed } = await client.GET(
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    const updated = listed.aio_benchmarks.find((b) => b.id === SEED_IDS.benchmarkId);
    expect(updated.brand_aliases).to.deep.equal(['Adobe Inc', 'Adobe Systems']);
  });

  it('listBrandUrls returns the seeded brand URL under the own-brand benchmark', async () => {
    const { data, error } = await client.GET(
      '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
      {
        params: {
          path: {
            id: SEED_WORKSPACE, project_id: SEED_PROJECT, benchmark_id: SEED_IDS.benchmarkId,
          },
        },
      },
    );
    expect(error).to.equal(undefined);
    expect(data.brand_urls).to.be.an('array').with.length(1);
    expect(data.brand_urls[0].id).to.equal(SEED_IDS.brandUrlId);
  });

  // Mirrors the consumer's brand-URL sync: create → list reflects → delete → gone.
  it('creates brand URLs, lists them back, then deletes them', async () => {
    const { benchmarkId } = SEED_IDS;
    const BRAND_URLS = '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls';
    const path = { id: SEED_WORKSPACE, project_id: SEED_PROJECT, benchmark_id: benchmarkId };

    const { data: created, error: createError } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: 'https://example.com/blog', type: 'own' }],
    });
    expect(createError).to.equal(undefined);
    expect(created.ids).to.have.length(1);

    const { data: listed } = await client.GET(BRAND_URLS, { params: { path } });
    // seeded url + the new one
    expect(listed.brand_urls.map((u) => u.id)).to.include(created.ids[0]);

    // Live ack: 202 with an EMPTY body (verified 2026-06-25) — raw fetch asserts the empty body.
    // `Accept: application/json` pins the negotiation-bypass fix (406 otherwise — issue 1742).
    const buUrl = `${baseUrl}/v2/workspaces/${SEED_WORKSPACE}`
      + `/projects/${SEED_PROJECT}/aio/benchmarks/${benchmarkId}/brand_urls`;
    const rawBuDel = await fetch(buUrl, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer e2e-token',
        'content-type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ids: created.ids }),
    });
    expect(rawBuDel.status).to.equal(202);
    expect(await rawBuDel.text()).to.equal('');
    const { data: after } = await client.GET(BRAND_URLS, { params: { path } });
    expect(after.brand_urls.map((u) => u.id)).to.not.include(created.ids[0]);
  });

  it('rejects a non-https brand URL with the live 400 (https:// required, #25)', async () => {
    const { benchmarkId } = SEED_IDS;
    const BRAND_URLS = '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls';
    const path = { id: SEED_WORKSPACE, project_id: SEED_PROJECT, benchmark_id: benchmarkId };

    // Scheme-less (the resolve `primary_url` form) → 400 on the go-validator `url` tag, exactly
    // as prod: the value cannot be written as a brand URL. Guards the mock against going green
    // over a write the live gateway rejects.
    const { response, error } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: 'lovesac.com', type: 'website' }],
    });
    expect(response.status).to.equal(400);
    expect(error.message).to.match(/failed on the 'url' tag/);

    // A valid but http:// URL → 400 on `startswith`.
    const { response: httpRes, error: httpErr } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: 'http://lovesac.com', type: 'website' }],
    });
    expect(httpRes.status).to.equal(400);
    expect(httpErr.message).to.match(/failed on the 'startswith' tag/);

    // An upper-case scheme → `startswith`, not an accept: go's HasPrefix is case-SENSITIVE.
    const { response: upRes, error: upErr } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: 'HTTPS://LOVESAC.COM', type: 'website' }],
    });
    expect(upRes.status).to.equal(400);
    expect(upErr.message).to.match(/failed on the 'startswith' tag/);

    // An opaque, hostless URL clears go's `url` tag and dies on `startswith`.
    const { response: mailRes, error: mailErr } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: 'mailto:hi@lovesac.com', type: 'website' }],
    });
    expect(mailRes.status).to.equal(400);
    expect(mailErr.message).to.match(/failed on the 'startswith' tag/);

    // An empty url → `required` (go's zero value), reported before `url` is ever evaluated. This
    // is the one empty-ish form that satisfies the request schema and so reaches the gate; a
    // MISSING or non-string url is 400ed earlier by request validation (asserted below).
    const { response: reqRes, error: reqErr } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: '', type: 'website' }],
    });
    expect(reqRes.status).to.equal(400);
    expect(reqErr.message).to.match(/failed on the 'required' tag/);

    // A missing url is rejected by request validation (the spec marks it required) — still a 400,
    // just not one this gate produces.
    const { response: missingRes } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ type: 'website' }],
    });
    expect(missingRes.status).to.equal(400);
  });

  it('rejects the whole batch atomically when one entry is non-https (#25)', async () => {
    const { benchmarkId } = SEED_IDS;
    const BRAND_URLS = '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls';
    const path = { id: SEED_WORKSPACE, project_id: SEED_PROJECT, benchmark_id: benchmarkId };
    const GOOD = 'https://atomicity-probe.example.net';

    // Live is atomic: a good entry alongside a bad one is NOT created (verified by write-probe).
    const { response, error } = await client.POST(BRAND_URLS, {
      params: { path },
      body: [{ url: GOOD, type: 'website' }, { url: 'lovesac.com', type: 'website' }],
    });
    expect(response.status).to.equal(400);
    // The 400 came from the validation gate, not from some other source.
    expect(error.message).to.match(/failed on the 'url' tag/);

    const { data } = await client.GET(BRAND_URLS, { params: { path } });
    expect(data.brand_urls.map((u) => u.url)).to.not.include(GOOD);
  });

  it('publishProject + getInitStatus respond with the intended mock contract', async () => {
    const { response: pubRes } = await client.POST(
      '/v1/workspaces/{id}/projects/{project_id}/publish',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(pubRes.status).to.equal(202);
    // Live action acks (publish, delete/update-benchmark, delete-brand-urls) return a 202 with an
    // EMPTY body (verified 2026-06-25), not a BasicResponse — a raw fetch confirms no body.
    // `Accept: application/json` (the serenity transport's header) pins the negotiation-bypass fix:
    // this is the exact request shape that 406'd and blocked the create/activate IT (issue 1742).
    const pubUrl = `${baseUrl}/v1/workspaces/${SEED_WORKSPACE}/projects/${SEED_PROJECT}/publish`;
    const rawPub = await fetch(pubUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer e2e-token', Accept: 'application/json' },
    });
    expect(rawPub.status).to.equal(202);
    expect(await rawPub.text()).to.equal('');

    // init_status lives on /v2 (overlay CR8) — the /v1 path 404s live.
    const { data: init, error } = await client.GET(
      '/v2/workspaces/{id}/projects/{project_id}/aio/init_status',
      { params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } } },
    );
    expect(error).to.equal(undefined);
    expect(init).to.have.property('initialized');
  });

  it('updateCiCompetitors returns { ci_competitors: [...] }', async () => {
    const { data, error } = await client.PUT(
      '/v1/workspaces/{id}/projects/{project_id}/ci/competitors',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { ci_competitors: [{ domain: 'competitor.example' }] },
      },
    );
    expect(error).to.equal(undefined);
    expect(data).to.have.property('ci_competitors');
    expect(data.ci_competitors).to.be.an('array');
  });

  // ───────────────────────────────────────────────────────────────────────
  // AI-unit quota metering. A workspace's allocation is provided via POST /__quota
  // (mirroring a user-manager transfer); project create, prompt create, and publish
  // then return the disguised 405 when the allocation is exhausted — the behaviour
  // the consumer's quota handling (republishBestEffort, "Quota exceeded") relies on.
  // ───────────────────────────────────────────────────────────────────────

  const PROJECTS = '/v1/workspaces/{id}/projects';
  const TAGGED = '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged';
  const PUBLISH = '/v1/workspaces/{id}/projects/{project_id}/publish';

  async function setQuota(workspaceId, allocation) {
    const res = await fetch(`${baseUrl}/__quota`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId, ...allocation }),
    });
    return res.json();
  }

  it('meters project create: 405 once the projects allocation is exhausted', async () => {
    const id = globalThis.crypto.randomUUID();
    await setQuota(id, { projects: 1, prompts: 100 });
    const { response: ok } = await client.POST(PROJECTS, { params: { path: { id } }, body: { name: 'P1', type: 'ai' } });
    expect(ok.status).to.equal(201);
    const { response: over, error } = await client.POST(PROJECTS, {
      params: { path: { id } }, body: { name: 'P2', type: 'ai' },
    });
    expect(over.status).to.equal(405);
    expect(error).to.not.equal(undefined);
  });

  it('meters prompt create: 405 (all-or-nothing) when a batch exceeds the prompts allocation', async () => {
    const id = globalThis.crypto.randomUUID();
    const projectId = globalThis.crypto.randomUUID();
    await setQuota(id, { projects: 5, prompts: 2 });
    const { response: ok } = await client.POST(TAGGED, {
      params: { path: { id, project_id: projectId } },
      body: { prompts: { 'prompt one': ['t'], 'prompt two': ['t'] } },
    });
    expect(ok.status).to.equal(201);
    const { response: over } = await client.POST(TAGGED, {
      params: { path: { id, project_id: projectId } },
      body: { prompts: { 'prompt three': ['t'] } },
    });
    expect(over.status).to.equal(405);
  });

  it('meters publish: 405 for an empty-units workspace, 202 when unlimited', async () => {
    const projectId = globalThis.crypto.randomUUID();
    const empty = globalThis.crypto.randomUUID();
    await setQuota(empty, { projects: 0, prompts: 0 });
    const { response: blocked } = await client.POST(PUBLISH, {
      params: { path: { id: empty, project_id: projectId } },
    });
    expect(blocked.status).to.equal(405);
    // a workspace with no allocation (limits-disabled, like the dev parent) publishes fine
    const { response: okPub } = await client.POST(PUBLISH, {
      params: { path: { id: globalThis.crypto.randomUUID(), project_id: projectId } },
    });
    expect(okPub.status).to.equal(202);
  });

  it('__quota reports limits + live usage', async () => {
    const id = globalThis.crypto.randomUUID();
    await setQuota(id, { projects: 3, prompts: 50 });
    await client.POST(PROJECTS, { params: { path: { id } }, body: { name: 'P', type: 'ai' } });
    const res = await fetch(`${baseUrl}/__quota?workspaceId=${id}`);
    const usage = await res.json();
    expect(usage.projects).to.deep.equal({ limit: 3, used: 1 });
    expect(usage.prompts).to.deep.equal({ limit: 50, used: 0 });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Bearer auth. The live gateway 401s any request lacking a usable bearer
  // credential (verified live 2026-06-25: missing header AND `Bearer <garbage>`
  // both 401). The mock mirrors that on every real route. The typed client always
  // sends `Authorization: Bearer <token>`, so the unauth paths use a raw fetch.
  // The `__*` control routes are exempt (harness plumbing, not the emulated API).
  // ───────────────────────────────────────────────────────────────────────

  const ANY_REAL_ROUTE = `/v1/workspaces/${SEED_WORKSPACE}/projects`;

  it('rejects a real route with no Authorization header (401 Not authenticated)', async () => {
    const res = await fetch(`${baseUrl}${ANY_REAL_ROUTE}`);
    expect(res.status).to.equal(401);
    expect(await res.json()).to.deep.equal({ detail: 'Not authenticated' });
  });

  it('rejects a real route with a non-Bearer Authorization header (401)', async () => {
    const res = await fetch(`${baseUrl}${ANY_REAL_ROUTE}`, {
      headers: { Authorization: 'token-without-the-bearer-scheme' },
    });
    expect(res.status).to.equal(401);
  });

  it('accepts a real route once a Bearer token is present', async () => {
    const res = await fetch(`${baseUrl}${ANY_REAL_ROUTE}`, {
      headers: { Authorization: 'Bearer any-non-empty-token' },
    });
    expect(res.status).to.equal(200);
  });

  it('exempts the __* control routes from auth (no token needed)', async () => {
    const dump = await fetch(`${baseUrl}/__dump`);
    expect(dump.status).to.equal(200);
  });
});
