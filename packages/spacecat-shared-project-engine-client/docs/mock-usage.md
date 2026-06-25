# Project Engine mock — usage manual (humans & agents)

A single, complete guide to running and driving the stateful Semrush **Project Engine** mock in
this package. For the design rationale see [`mock-statefulness.md`](./mock-statefulness.md); for
the field-by-field comparison against the live API see
[`mock-vs-live-parity.md`](./mock-vs-live-parity.md).

> **Scope.** This mock emulates the **Project Engine API** only (the `/enterprise/projects/api`
> gateway — projects, AI models, prompts, benchmarks, brand URLs, tags, catalogs, publish). The
> sub-workspace **lifecycle** calls the api-service transport also makes (`/child`, `/status`,
> `/family`, `/resources/transfer`, workspace delete) live on a **different** gateway
> (`/enterprise/users/api`) and belong to the separate `spacecat-shared-user-manager-client`
> package — they are intentionally **not** mocked here.

---

## 1. Quick start

```bash
npm run generate          # one-time: builds build/openapi3.json (the corrected spec) + types
npm run mock              # serves on http://localhost:4010
```

- **Base URL:** `http://localhost:<port>/enterprise/projects/api`
- **Default port:** `4010` (override with `MOCK_PORT`)
- Every real route requires a bearer token (see §2). Unmodelled spec paths fall back to
  Counterfact's random stubs; the modelled spine (below) is stateful.

| Env var | Default | Purpose |
| --- | --- | --- |
| `MOCK_PORT` | `4010` | listen port |
| `MOCK_SEED` | `workspace-with-data` | named startup fixture (`empty-workspace` \| `workspace-with-data`); unknown → default |
| `MOCK_SEED_FILE` | — | path to a JSON `Snapshot` to boot from; **takes precedence** over `MOCK_SEED` |

```bash
MOCK_PORT=4032 MOCK_SEED=empty-workspace npm run mock
```

---

## 2. Authentication (bearer required)

The live gateway rejects any request **without** a usable IMS bearer credential with
`401 { "detail": "Not authenticated" }` (verified live 2026-06-25: a missing `Authorization`
header **and** a malformed `Bearer <garbage>` both 401; only a valid IMS token passes). The mock
mirrors this on **every real route**:

- **Required:** `Authorization: Bearer <token>` must be present. The mock is a test double, not an
  IMS verifier — it requires the bearer to be **present**, it does not validate the token's
  contents. Any non-empty token works.
- **Missing / non-Bearer / empty** → `401 { "detail": "Not authenticated" }`.
- The **`__*` control routes** (`/__reset`, `/__seed`, `/__dump`, `/__quota`) are **exempt** —
  they are test-harness plumbing, not part of the emulated API.

```bash
# 401 — no token
curl -s -o /dev/null -w '%{http_code}\n' \
  http://localhost:4010/enterprise/projects/api/v1/workspaces/<ws>/projects
# 200 — any bearer token
curl -s -H 'Authorization: Bearer dev-token' \
  http://localhost:4010/enterprise/projects/api/v1/workspaces/<ws>/projects
```

The typed client (`createSerenityProjectEngineApiClient({ baseUrl, authToken })`) sends the header
for you on every call. Implementation: `mock/auth.js` (the guard) is injected onto every
materialized handler by `mock/run.js` — see §8.

---

## 3. Endpoint inventory (the modelled surface)

All paths are under the base URL. The "Consumer" column is the api-service `rest-transport.js`
method that calls it.

### Projects

| Method + path | Consumer | Behaviour |
| --- | --- | --- |
| `GET /v1/workspaces/{id}/projects` | `listProjects` | list → `{ items, page, total }` |
| `POST /v1/workspaces/{id}/projects` | `createProject` | create → `201`; **metered** (405 when the projects allocation is exhausted) |
| `GET /v1/workspaces/{id}/projects/{project_id}` | `getProject` | get (`404` when missing) |
| `PATCH /v1/workspaces/{id}/projects/{project_id}` | — | partial update |
| `DELETE /v1/workspaces/{id}/projects/{project_id}` | `deleteProject` | remove → `204` |
| `POST /v1/workspaces/{id}/projects/{project_id}/publish` | `publishProject` | publish → `202`; **metered** (405 for an empty-units workspace) |

### AI models

| Method + path | Consumer | Behaviour |
| --- | --- | --- |
| `GET /v1/workspaces/{id}/projects/{project_id}/ai_models` | `listAiModels` | list → `{ items, page, total }` |
| `DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models` | `deleteAiModelsByIds` | batch-delete (body `{ ids }`) → `204` |
| `POST /v2/workspaces/{id}/projects/{project_id}/ai_models` | `addAiModel` | add (body `{ model_id }`) → `201`; writes the same store collection the v1 list/delete read |
| `GET /v1/ai_models` | `listGlobalAiModels` | global catalog → `{ page, total, items }` |

### Benchmarks & brand URLs

| Method + path | Consumer | Behaviour |
| --- | --- | --- |
| `GET /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks` | `listBenchmarks` | list → `{ aio_benchmarks }` |
| `DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks` | `deleteBenchmarks` | batch-delete (body `{ ids }`) → `202` |
| `PUT /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}` | `updateBenchmark` | update in place → `202` |
| `POST /v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks` | `createBenchmarks` | batch-create (body = array) → `200 { ids, existing_count }` |
| `GET /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls` | `listBrandUrls` | list → `{ brand_urls }` |
| `POST …/aio/benchmarks/{benchmark_id}/brand_urls` | `createBrandUrls` | batch-create (body = array) → `200 { ids, existing_count }` |
| `DELETE …/aio/benchmarks/{benchmark_id}/brand_urls` | `deleteBrandUrls` | batch-delete (body `{ ids }`) → `202` |

### Prompts & tags

| Method + path | Consumer | Behaviour |
| --- | --- | --- |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged` | `createTaggedPrompts` | create; body `{ prompts: { [promptText]: [tagName, …] } }` → `201 { ids, existing_count }`; **metered** (all-or-nothing 405 on the prompts allocation) |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags` | `listPromptsByTags` | list → `{ items, page, total, unassigned }` (empty `tag_ids` lists all; else OR-filter) |
| `DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts` | `deletePromptsByIds` | batch-delete (body `{ ids }`) → `204` |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/tags` | `createProjectTags` | create tags (body `{ names }`) → `201` top-level array |

### Catalogs, CI competitors, init status

| Method + path | Consumer | Behaviour |
| --- | --- | --- |
| `GET /v1/languages` | `listLanguages` | language catalog → `{ page, total, items }` |
| `GET /v1/workspaces/{id}/brand-topics` | `getBrandTopics` | top-level array `[{ topic, volume, prompts }]` |
| `PUT /v1/workspaces/{id}/projects/{project_id}/ci/competitors` | `updateCiCompetitors` | full replace → `{ ci_competitors }` |
| `GET /v2/workspaces/{id}/projects/{project_id}/aio/init_status` | `getInitStatus` | `{ initialized }`. **Live route is `/v2`** — the vendored swagger's `/v1` path 404s (overlay CR8). The api-service consumer still calls `/v1` today; see [parity §4](./mock-vs-live-parity.md). |

---

## 4. Seeds

Two named seeds ship in `mock/seeds.js`:

- **`empty-workspace`** — the seed workspace with no projects.
- **`workspace-with-data`** (default) — one project under the seed workspace, with an AI model, a
  prompt, an own-brand benchmark, and a brand URL. Canonical ids are exported as `SEED_IDS`
  (`workspaceId`, `projectId`, `aiModelId`, `promptId`, `benchmarkId`, `brandUrlId`).

Boot from a custom state with `MOCK_SEED_FILE=/path/to/snapshot.json` or replace state at runtime
with `POST /__seed` (§5). A `Snapshot` is a plain JSON object keyed `<resource>:<scope>`:

```jsonc
{
  "projects:<ws>":            [ { "id": "<pid>", "name": "Acme" } ],
  "ai_models:<ws>:<pid>":     [ { "id": "<id>", "model": { "id": "<mid>", "key": "gpt-4o", "name": "GPT-4o" }, "prompts_count": 0 } ],
  "prompts:<ws>:<pid>":       [ { "id": "<id>", "name": "What is Acme?", "is_new": false, "tags": [] } ],
  "benchmarks:<ws>:<pid>":    [ { "id": "<bid>", "main_brand": true, "brand_name": "Acme", "domain": "acme.com", "brand_aliases": [], "rejected_brand_aliases": [], "color": "", "favorite": false, "products_count": 0 } ],
  "brand_urls:<ws>:<pid>:<bid>": [ { "id": "<id>", "url": "https://acme.com/about", "type": "own" } ],
  "quota":                    [ { "id": "<ws>", "projects": 3, "prompts": 1500 } ]
}
```

Use the **same UUIDs** you load into Postgres (`semrush_workspace_id` / project id) so the mock and
your DB line up. Don't hand-write rows — use the **typed factories** + `buildSeed` (§7).

---

## 5. Control routes (test harness)

Under the base URL, e.g. `…/enterprise/projects/api/__dump`. **Auth-exempt.**

| Route | Purpose |
| --- | --- |
| `POST /__reset` | restore the store to its boot seed (or the last `/__seed`) — call between cases for isolation |
| `POST /__seed` | replace the store with the posted `Snapshot` and make it the new reset baseline |
| `GET /__dump` | **look inside the mock DB** — returns the current store state as JSON |
| `POST /__quota` | set a workspace's AI-unit allocation: `{ workspaceId, projects?, prompts? }` |
| `GET /__quota?workspaceId=<ws>` | read a workspace's limits + live usage |

```bash
curl -s http://localhost:4010/enterprise/projects/api/__dump | jq
```

---

## 6. AI-unit quota (the disguised 405)

The live API meters AI units per (sub-)workspace; a metered op against an exhausted allocation
returns a **405** that the consumer treats as a quota rejection (`republishBestEffort` swallows it,
provisioning reports "Quota exceeded"). The mock models this:

- **Default = unlimited.** A workspace with no allocation (like the dev parent, limits-disabled)
  never 405s. The existing seeds therefore behave normally.
- **Grant an allocation** via `POST /__quota` (mirrors a user-manager resource transfer) or a
  `quota` row in a seed `Snapshot`. Usage is derived **live** from the store, so deleting a
  project/prompt frees its unit.
- **Metered ops:** project create (`projects` limit), prompt write (`prompts` limit, all-or-nothing
  per batch), and publish (405 for an `prompts: 0` empty-units workspace).

```bash
# grant 1 project + 2 prompts
curl -s -XPOST http://localhost:4010/enterprise/projects/api/__quota \
  -d '{"workspaceId":"<ws>","projects":1,"prompts":2}'
# now: a 2nd project create, a 3rd prompt, or publishing an empty-units child → 405
curl -s http://localhost:4010/enterprise/projects/api/__quota?workspaceId=<ws> | jq
# → { "projects": { "limit": 1, "used": 1 }, "prompts": { "limit": 2, "used": 2 } }
```

---

## 7. Driving the mock from tests / an agent

### Typed client (recommended)

```js
import { createSerenityProjectEngineApiClient } from '@adobe/spacecat-shared-project-engine-client';

const client = createSerenityProjectEngineApiClient({ baseUrl, authToken: 'dev-token' });
const { data, error } = await client.GET('/v1/workspaces/{id}/projects', {
  params: { path: { id: workspaceId } },
});
```

### Seed with the typed factories

The factories + `buildSeed` are on the `./mock/*` subpath (checkout-only; not in the published
tarball). Each `createXMock(overrides?)` is typed against the overlay-corrected schemas, so
`npm run test:types` fails on drift.

```js
import { buildSeed } from '@adobe/spacecat-shared-project-engine-client/mock/seeds.js';
import {
  createProjectAiModelMock, createAiModelMock, createPromptMock,
} from '@adobe/spacecat-shared-project-engine-client/mock/factories.js';
import { randomUUID } from 'node:crypto';

const workspaceId = randomUUID();
const projectId = randomUUID();
const snapshot = buildSeed({
  workspaceId,
  projects: [{
    id: projectId,
    name: 'Acme',
    aiModels: [createProjectAiModelMock({ model: createAiModelMock({ name: 'GPT-4o' }) })],
    prompts: [createPromptMock({ name: 'What is Acme?' })],
  }],
  quota: { projects: 3, prompts: 1500 }, // omit for unlimited
});
await fetch(`${baseUrl}/__seed`, { method: 'POST', body: JSON.stringify(snapshot) });
```

A consumer that only has the **published tarball** (no `mock/`) POSTs the raw `Snapshot` JSON from
§4 instead.

### End-to-end suite

`npm run test:e2e` boots the mock (self-managed lifecycle, `__reset` between cases) and drives the
**real client** against it. Gated behind `MOCK_E2E=1`, outside the default `npm test` glob, so the
unit suite stays fast at 100% coverage. See `test/e2e/project-engine-mock.e2e.js` for the boot +
readiness + auth patterns.

---

## 8. How it runs (internals)

`mock/run.js` materializes the committed handlers from `mock/counterfact/routes/**` into a
gitignored `.counterfact/` tree (renamed to `.ts` so Counterfact's transpiler emits loadable
`.cjs`), copies the `_lib` modules (`store`, `stateful`, `factories`, `quota`, `auth`, `seeds`,
`context`), and launches Counterfact with `--serve` (no spec stubs appended onto the stateful
handlers). Response validation stays on; request validation is off.

- **Bearer auth** is injected at this seam: `injectAuthGuard` prepends
  `context.authError($.headers)` to every materialized handler method, so the gate is impossible to
  forget on a new handler. `__*` control routes are skipped.
- **Adding a new `_lib` module:** any file imported by `mock/context.js` MUST be added to
  `LIB_FILES` in `mock/run.js`, or the materialized tree breaks.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 { "detail": "Not authenticated" }` | Missing/invalid bearer. Send `Authorization: Bearer <any-non-empty>` (§2). Control routes don't need it. |
| `build/openapi3.json not found` on `npm run mock` | Run `npm run generate` first (it's a gitignored intermediate). |
| A real route returns random/garbage data | That path isn't modelled — Counterfact is serving a spec stub. The modelled surface is §3. |
| A metered op unexpectedly 405s | A `quota` allocation is set for that workspace and is exhausted. Inspect with `GET /__quota?workspaceId=`; clear by `__reset` or re-seed without a `quota` row. |
| `getInitStatus` 404 against `/v1` | Expected — the live route is `/v2` (overlay CR8). |
| A new `_lib` import "not found" at boot | Add the file to `LIB_FILES` in `mock/run.js` (§8). |
| `datamodel-codegen: command not found` during `npm run generate` | Only the pydantic step; the JS gates don't need it. Run it via `uvx --from datamodel-code-generator datamodel-codegen …` if you need the Python models. |
