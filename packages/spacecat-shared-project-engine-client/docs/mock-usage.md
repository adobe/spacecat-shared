# Project Engine mock — usage manual (humans & agents)

A single, complete guide to running and driving the stateful Semrush **Project Engine** mock in
this package. For the design rationale see [`mock-statefulness.md`](./mock-statefulness.md).

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
- Every real route requires a bearer token (see §2). The runner serves only the modelled
  handlers (`--serve`, no `generate`) — an **unmodelled path 404s**, it does NOT fall back to a
  random stub. The modelled spine (below) is stateful; the rest are thin echo/catalog handlers.
  Adding an endpoint is §9.

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
- **Bind to localhost only.** The `__*` routes are unauthenticated and `/__dump` returns the full
  store state, so the mock must stay on a loopback interface. The E2E binds `127.0.0.1`; if you
  ever wire the mock to a shared/CI host, gate or remove the `__*` routes first.

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
| `GET /v1/workspaces/{id}/brand-topics` | `getBrandTopics` | top-level array `[{ topic, volume, prompts }]`; `domain` + `country` are `required` query params — omitting either → `400` (enforced by request validation, matching live) |
| `PUT /v1/workspaces/{id}/projects/{project_id}/ci/competitors` | `updateCiCompetitors` | full replace → `{ ci_competitors }` |
| `GET /v2/workspaces/{id}/projects/{project_id}/aio/init_status` | `getInitStatus` | `{ initialized }`. **Live route is `/v2`** — the vendored swagger's `/v1` path 404s (overlay CR8, verified live across 4 projects). The api-service consumer still calls `/v1` today (a pre-existing bug — it degrades to `initialized: null`). |

> **Response-body shapes pinned to live (verified 2026-06-25 against the test workspace).**
> The `202` action acks — `publishProject`, `deleteBenchmarks`, `updateBenchmark`, `deleteBrandUrls`
> — return an **empty body** (`content-length: 0`, matching the swagger's no-schema 202), not a
> `BasicResponse` envelope. `createProject` returns a **draft `ProjectResponse`** — the request's
> flat `brand_*`/`language_id`/`country_code`/`location_*` fields are nested under `settings.ai`,
> with `live_id`/`draft_id` mirrored and `is_draft: true`/`publish_status: 'draft'` — NOT a flat
> echo of the request body. `addAiModel` resolves the catalog model's `icon` onto the response.

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
handlers). Both response AND request validation are on: a request missing a required query param
(brand-topics `domain`/`country`) or body field (project-create `type`) gets a `400` from the
overlay-corrected spec before the handler runs, matching live. (Request validation was historically
off because the vendored spec's required `Auth-Data-Jwt` header param 400'd every request under
case-sensitive matching; CR2 removed that header, so it is safe to run.)

- **Bearer auth** is injected at this seam: `injectAuthGuard` prepends
  `context.authError($.headers)` to every materialized handler method, so the gate is impossible to
  forget on a new handler. `__*` control routes are skipped.
- **Entity shapes via factories.** Handlers don't hand-write response entities — they build them
  through `context.factories.createXMock(...)` (the typed factories from `mock/factories.js`), so
  every emitted shape has one tsc-checked source of truth and can't drift from the spec. When you
  add a create/catalog handler, route its entities through the matching factory.
- **Adding a new `_lib` module:** nothing to wire up — `LIB_FILES` in `mock/run.js` is auto-derived
  from the `mock/*.js` files, so any module imported by `mock/context.js` is materialized
  automatically.

---

## 9. Extending the mock — add an endpoint

When the consumer (`spacecat-api-service` `rest-transport.js`) starts calling a Project Engine
path this mock doesn't model yet, that path **404s** (the runner serves no auto-stubs — §8). Add a
handler:

1. **Confirm the live contract first** — don't guess the response; capture it from the real API
   (§10). The mock's whole value is fidelity, so a hand-invented shape defeats the purpose.
2. **Make sure the operation is in the spec.** Counterfact validates request + response against
   `build/openapi3.json`. If the path — or a field the live body carries — is missing from the
   vendored swagger, add a `CRn` action to `spec/overlays/corrections.yaml` and `npm run generate`.
   **Never edit the vendored `spec/*.yaml`** (e.g. CR10 added the benchmark `primary_url`/
   `root_domain`; CR8 moved the `init_status` path).
3. **Create the handler file** under `mock/counterfact/routes/**`, mirroring the URL (Counterfact
   maps filesystem → path; `{id}` segments are literal directory names). e.g.
   `GET /v2/workspaces/{id}/projects/{project_id}/aio/foo` →
   `mock/counterfact/routes/v2/workspaces/{id}/projects/{project_id}/aio/foo.js`.
4. **Author the canonical handler shape:** `export function VERB($) { … }`
   (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`). The bearer-auth guard is injected onto exactly this shape
   — an arrow `export const GET =` or an unmatched verb throws at materialization (fail-closed, see
   `inject-auth-guard.js`). Read request data off `$`: `$.path`, `$.body`, `$.query`, `$.headers`.
   These handlers are the **`// @ts-check` exception** — leave it off (they run against
   Counterfact's untyped `$`).
5. **Build every response entity through a factory**, never an inline literal:
   `$.context.factories.createXMock({ … })`. If no factory fits, add one to `mock/factories.js`
   (typed against `components['schemas'][…]`) plus a type-assert in
   `test/types/factories.type-test.ts` — that type-test is the only tsc-checked guard on an
   (untyped) handler's output shape.
6. **Stateful?** If a flow writes then reads it, use `$.context.ops.<resource>` (see
   `mock/stateful.js`); a brand-new resource group also needs an entry in `STATEFUL_RESOURCES` + a
   `collectionKey` case. A pure echo/catalog read needs neither — just return the factory-built
   shape.
7. **Match the runtime contract exactly** — status code AND empty-body acks. A live `202`/`204`
   with `content-length: 0` must be `return { status: 202, body: '' }`: a bare `{ status: 202 }`
   makes Counterfact emit the reason phrase `"Accepted"` as the body and breaks `JSON.parse`.
8. **Add an e2e case** in `test/e2e/project-engine-mock.e2e.js` driving the **real client** against
   it — handlers are coverage-excluded and untyped, so the e2e is their only safety net. For
   empty-body acks, raw-`fetch` and assert `res.status === 202 && (await res.text()) === ''` (the
   typed client swallows the body).
9. **Gate:** `npm run generate && npm run test:types && MOCK_E2E=1 npm run test:e2e`. The `_lib`
   list is auto-derived, so a new module imported by `mock/context.js` materializes automatically.

## 10. Capturing real API responses to build a faithful handler

A handler is only trustworthy if its shape came from the **live** API, not a guess. This is the
recipe used to validate every endpoint in this package (commit `4ee03f80`). Testing is done against
a **prod** Semrush workspace the team keeps for this purpose — so don't hardcode ids or URLs here
(they differ per env and rotate); resolve them each time from the sources below.

**Where the live values come from:**

- **Prod base URL** — the exact value api-service's `rest-transport` resolves, stored in Vault
  (populated for `dev`/`stage`/`prod`; validation uses **prod**). Needs `vault login -method=oidc`
  first (see the workspace `CLAUDE.md` Vault section):
  ```bash
  vault kv get -field=SEMRUSH_PROJECTS_BASE_URL dx_mysticat/prod/api-service
  ```
- **A workspace id to test against** — a Semrush sub-workspace under the Adobe brownfield parent,
  used only for testing. Get a real id from any of:
  - the **Semrush web UI** for that workspace (the UUID is in the URL);
  - the **prod DB** — `organizations.semrush_workspace_id` (the parent) or a brand's
    `brands.semrush_workspace_id`;
  - enumerate the parent's children via the **user-manager** API:
    `GET /enterprise/users/api/v1/workspaces/{parent}/family` → `[{ id, title, status }]` (note that
    is the `/enterprise/users/api` gateway, not `/projects`).
- **Token** — a real user IMS bearer for the **prod** IMS env (the tenant is prod):
  `mysticat auth token --ims` (after `mysticat login`).

```bash
TOKEN=$(mysticat auth token --ims)
BASE="$(vault kv get -field=SEMRUSH_PROJECTS_BASE_URL dx_mysticat/prod/api-service)/enterprise/projects/api"
WS=<workspace id resolved above>

# -i prints status + headers, so you SEE an empty-body 202 (content-length: 0)
curl -is -H "Authorization: Bearer $TOKEN" "$BASE/v1/workspaces/$WS/projects" | sed -n '1,/^\r\{0,1\}$/p'
curl -s  -H "Authorization: Bearer $TOKEN" "$BASE/v1/workspaces/$WS/projects" | jq   # body
```

Turning a captured response into a handler:

- **Status + headers first, body second.** `200` vs `201` vs `202`, and empty body
  (`content-length: 0`) vs an envelope, IS the contract — pin both. (Verified live 2026-06-25:
  `createProject` → `201` draft `ProjectResponse`; `createTaggedPrompts` → `201 { ids,
  existing_count }`; `createBenchmarks` / `createBrandUrls` → `200 { ids, existing_count }`;
  `publish` and the benchmark / brand-url **delete/update** acks → empty `202`; `deletePromptsByIds`
  → `204`.)
- **Nest into the factory, don't paste the literal.** Add the captured fields to the matching
  `createXMock` — or a transforming factory if it's a write that reshapes the request (live nests a
  flat `ProjectUpdateRequest` under `settings.ai`, hence `applyProjectUpdate`;
  `createProjectResponseFromRequest` does the same for create). A field the live body carries but
  the swagger omits becomes an overlay `CRn` (that is exactly how CR9's `primary_url` was found).
- **Writes need explicit authorization + cleanup — and this is a PROD workspace.** Reads are safe;
  **only** do live writes with the user's go-ahead, on a single throwaway project, with a
  `trap`-based delete-on-exit so you never leave residue on a workspace the team shares.
- **A `405` on a metered op is real — it means "payment required" (no AI units).** `createProject`,
  `createTaggedPrompts`, and `publish` return `405` when the workspace has no AI-unit allocation:
  units must be transferred from the **parent** workspace to the child before those ops succeed.
  This is the live metered-quota gate, and the mock **reproduces** it (§6 — the disguised 405). So
  to capture a *success* response, first make sure the test workspace has units allocated (or use a
  funded parent); don't treat the `405` as a quirk to paper over — it's faithful behaviour the mock
  already models.
- **Live is eventually-consistent — a create-then-immediately-read can look empty/`404`.** Verified
  2026-06-25: a just-`POST`ed prompt did not appear in `prompts/by_tags`, a just-created brand URL
  did not appear in `listBrandUrls`, and a project's **main-brand benchmark is generated
  asynchronously** (it did not appear within ~60s of create, even after a publish — and a freshly
  created competitor benchmark's `brand_urls` GET `404`s until it is processed). So to capture a
  *populated* read, drive it against a **pre-existing, settled** project, not one you just created;
  don't read an empty list / `404` right after a write as the contract. (The mock makes every write
  immediately readable — what the consumer's tests need — so this asymmetry is a capture-time
  concern only, never a mock-fidelity gap.)
- **Source the request shape from the consumer, not a guess.** Take the exact method + path + body
  from the consumer's `rest-transport.js` on **`origin/main`** — not a stale worktree branch (a
  12-commits-behind checkout once mislabeled live endpoints as dead). A metered create also needs a
  funded workspace *and* a well-formed body — e.g. `createProject` needs a real `language_id`
  (resolve from `GET /v1/languages`) and `location_id`, or it `400`s/`500`s before you see the shape.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `401 { "detail": "Not authenticated" }` | Missing/invalid bearer. Send `Authorization: Bearer <any-non-empty>` (§2). Control routes don't need it. |
| `build/openapi3.json not found` on `npm run mock` | Run `npm run generate` first (it's a gitignored intermediate). |
| A real route 404s unexpectedly | That path isn't modelled — the runner serves no auto-stubs, so unmodelled paths 404. Model it (§9). The modelled surface is §3. |
| A metered op unexpectedly 405s | A `quota` allocation is set for that workspace and is exhausted. Inspect with `GET /__quota?workspaceId=`; clear by `__reset` or re-seed without a `quota` row. |
| `getInitStatus` 404 against `/v1` | Expected — the live route is `/v2` (overlay CR8). |
| A new `_lib` import "not found" at boot | The module must sit directly under `mock/` — the runner auto-derives `LIB_FILES` from `mock/*.js`, so a file outside `mock/` (or imported under the wrong name) won't materialize. |
| `datamodel-codegen: command not found` during `npm run generate` | Only the pydantic step; the JS gates don't need it. Run it via `uvx --from datamodel-code-generator datamodel-codegen …` if you need the Python models. |
