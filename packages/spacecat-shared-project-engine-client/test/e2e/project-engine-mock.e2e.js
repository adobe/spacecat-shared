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
  // value = tag names (the real consumer shape: `{ [text]: tags }`).
  it('creates aio prompts (tagged) and lists them back (by_tags)', async () => {
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
  // filter branch (OR semantics), not just the list-all branch. `tagged` stores a deterministic
  // tag id `tag-<name>`, so a prompt tagged 'brand' is found via tag_ids: ['tag-brand'].
  it('by_tags filters to prompts carrying a given tag id (non-empty tag_ids)', async () => {
    await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { prompts: { 'Branded question': ['brand'], 'Generic question': ['category'] } },
      },
    );
    const { data: branded, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { tag_ids: ['tag-brand'] },
      },
    );
    expect(error).to.equal(undefined);
    // Only the 'brand'-tagged prompt matches: the seeded prompt has no tags, the 'category' one
    // carries a different tag id.
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
        body: { model_id: SEED_IDS.aiModelId },
      },
    );
    expect(error).to.equal(undefined);
    expect(response.status).to.equal(201);
    // Live resolves the catalog model's icon onto the add response (verified 2026-06-25).
    expect(data.model).to.include.keys('id', 'icon');
  });

  it('createProjectTags returns a top-level array, matching the live API (drift D1/CR6)', async () => {
    const { data, error } = await client.POST(
      '/v2/workspaces/{id}/projects/{project_id}/aio/tags',
      {
        params: { path: { id: SEED_WORKSPACE, project_id: SEED_PROJECT } },
        body: { names: ['type:branded', 'topic:Probe'] },
      },
    );
    expect(error).to.equal(undefined);
    // Live returns [{ id, name, children_count, keyword_count }], NOT a single object.
    expect(data).to.be.an('array');
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
