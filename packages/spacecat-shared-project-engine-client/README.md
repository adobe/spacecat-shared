# @adobe/spacecat-shared-project-engine-client

Typed integration with the Semrush **Project Engine API** (`/enterprise/projects/api`):

- generated **TypeScript** (`src/generated/types.ts`) and **Pydantic v2** (`python/serenity_project_engine/`) types,
- a thin **Project Engine client** (`openapi-fetch` over the generated `paths`) — IMS Bearer auth + idempotency-aware retries (see [Client](#client)),
- a generation-time **spec-correction overlay** (`spec/overlays/corrections.yaml`) that aligns the vendored swagger with the live API,
- a **stateful Counterfact mock** for E2E tests and local dev (`npm run mock`, see below).

This package follows the `spacecat-shared` convention: **JS + ESM**, JSDoc-typed source,
`mocha` + `chai` + `c8` for tests, and `@adobe/eslint-config-helix` for lint. The scaffold's
TypeScript surface is ported to JS + JSDoc; the generated `types.ts` is a **type artifact only**,
consumed by the client via JSDoc `import(...)` and by `openapi-fetch` at type-check time.

## Client

```js
import { createSerenityProjectEngineApiClient } from '@adobe/spacecat-shared-project-engine-client';

const client = createSerenityProjectEngineApiClient({
  baseUrl: process.env.SEMRUSH_PROJECTS_BASE_URL, // origin only; the prefix is owned by the client
  authToken: () => getImsToken(),                 // a static token or a (sync/async) per-request getter
});

const { data, error } = await client.GET('/v1/countries');
```

- **Auth:** the caller's IMS JWT is forwarded verbatim as `Authorization: Bearer <token>`. The
  live API authenticates on Bearer directly — Semrush accepts the IMS token and the client mints
  or exchanges **nothing**. The token source resolves once per request, so the header always
  reflects the current caller.
- **Base URL:** the client owns the fixed `/enterprise/projects/api` prefix; you pass only the
  origin (any path/credentials are stripped). Non-`http(s)` base URLs fail fast at construction.
- **Retries:** `429` is retried for any method; `5xx`/network errors only for idempotent methods
  (so a POST is never replayed). Backoff is exponential with jitter, honours `Retry-After`, and is
  capped at 20s/attempt. Pass `onRetry` to observe the loop.
- **Shape:** this is a thin factory function rather than the `CLAUDE.md` "class + factory" client
  pattern — the wrapper has no per-instance state or behaviour beyond what `openapi-fetch` already
  provides, so a class would add ceremony without value. The typed surface IS the `openapi-fetch`
  client.

## Spec source

The spec is a **vendored file** — `spec/projectengine_swagger_public.yaml` — kept under
version control. Semrush only provides the file (no endpoint access in the near term), and
it's **Swagger 2.0** (no v3/v3.1 on offer). The vendored file is **never edited**; where it
diverges from the live API, a generation-time overlay corrects the converted artifact instead (see
[Spec corrections](#spec-corrections)). Refresh is **manual**: drop in the newer file, re-run
`npm run generate`, and review the diff. A committed checksum lock
(`spec/projectengine_swagger_public.yaml.sha256`) is verified by `npm run spec:verify` (wired into
`pretest`, so CI enforces it): any re-vendor of the spec fails the build until the hash is
explicitly regenerated with `npm run spec:lock` and reviewed. A true live-drift contract test
against Semrush remains blocked on endpoint access.

Both scripts use a **package-root-relative** path and assume the working directory is this
package root — always invoke them via `npm run spec:verify` / `npm run spec:lock`, which npm
runs from the package root, rather than calling `shasum -c` by hand from the monorepo root or a
subdirectory (that yields a confusing "no such file" error). They also assume `shasum` (Perl,
present on macOS and the `ubuntu-latest` CI runner); minimal images such as Alpine ship
`sha256sum` instead and would need the scripts adjusted.

## Pipeline

```
spec/projectengine_swagger_public.yaml  (vendored, Swagger 2.0)
        │
        └── swagger2openapi (v2 → 3.x) ──►  build/openapi3.json
                                                │
                                                ├── apply-overlay (corrections) ──► build/openapi3.json (in place)
                                                │
                                                ├── Counterfact ──►  mock   [npm run mock]
                                                ├── openapi-typescript ──► src/generated/types.ts
                                                └── datamodel-code-generator ──► python/serenity_project_engine/
```

The v2 → 3.x conversion + overlay feeds both the type generators and the Counterfact mock.
`npm run generate` must be run once (and re-run after any spec refresh) before `npm run mock` —
`build/openapi3.json` is gitignored. The overlay is applied in place so Counterfact sees the
corrected paths (including `GET /v1/ai_models`, CR1) and the mock serves under the
`/enterprise/projects/api` base path via `--prefix`.

| Command | Does |
| --- | --- |
| `npm run spec:convert` | v2 → 3.x via `swagger2openapi --patch` → `build/openapi3.json` |
| `npm run spec:overlay` | apply `spec/overlays/corrections.yaml` to `build/openapi3.json` in place |
| `npm run generate:ts` | `openapi-typescript` → `src/generated/types.ts` |
| `npm run generate:pydantic` | `datamodel-code-generator` → `python/serenity_project_engine/` package |
| `npm run generate` | all of the above, in order (run before `npm run mock`) |
| `npm run mock` | Counterfact mock on `:4010`, corrected OAS3 artifact + `--prefix /enterprise/projects/api` |

`datamodel-code-generator` is a **Python** tool, not an npm dependency. Install it once on
your `PATH` before running `generate:pydantic`:

```bash
pip install datamodel-code-generator
```

## Spec corrections

The vendored swagger diverges from the live API in three places. A small OpenAPI Overlay
(`spec/overlays/corrections.yaml`), applied to the converted OAS3 artifact at generation time by
`scripts/apply-overlay.mjs`, corrects them; the vendored `spec/projectengine_swagger_public.yaml`
is never touched.

- **CR1 — missing endpoint.** Adds `GET /v1/ai_models` (the live global model catalog), which is
  absent from the upstream swagger.
- **CR2 — auth.** The spec models a required `Auth-Data-Jwt` header, but the live API authenticates
  on `Authorization: Bearer <IMS>` only — Semrush accepts the IMS bearer directly. The overlay
  removes `Auth-Data-Jwt` from every operation and adds an `imsBearer` security scheme.
- **CR3 — drafts.** Corrects the `GET /v2/workspaces/{id}/projects` description: it also returns
  initial, never-yet-published draft projects, not only published ones.

Guard tests in `test/foundation.test.js` pin CR1 and CR2 against the generated surface, so a future
Semrush spec refresh that silently drops the overlay fails loudly instead of regressing the
generated types. `test/overlay.test.js` covers the overlay applier itself.

## Mock (stateful)

> **Full guide:** [`docs/mock-usage.md`](./docs/mock-usage.md) is the complete usage manual for
> humans and agents — auth, the full endpoint inventory, seeds, control routes, quota, and
> troubleshooting. This section is the summary.

`npm run mock` starts a **stateful** Counterfact server off the corrected OAS3 artifact
(`build/openapi3.json` — run `npm run generate` first). The runner serves only the modelled
handlers (`--serve`, no `generate`), so an unmodelled path **404s** — it does not fall back to a
spec-driven stub. The project spine is backed by a shared in-memory store so reads reflect prior
writes within a run; see [`docs/mock-usage.md`](./docs/mock-usage.md) §9 to add an endpoint.

```bash
npm run mock                       # serves on :4010
MOCK_PORT=4032 MOCK_SEED=empty-workspace npm run mock
```

Base URL: `http://localhost:<port>/enterprise/projects/api`.

**Auth:** every real route requires `Authorization: Bearer <token>` (any non-empty token — the
mock checks presence, not validity, like the live gateway). Missing/invalid → `401 { "detail":
"Not authenticated" }`. The `__*` control routes are exempt. See the manual §2.

| Var | Default | Purpose |
| --- | --- | --- |
| `MOCK_PORT` | `4010` | listen port |
| `MOCK_SEED` | default seed | named startup fixture; unknown values fall back to the default |
| `MOCK_SEED_FILE` | — | path to a JSON `Snapshot` to boot from; takes precedence over `MOCK_SEED` |

Stateful endpoints (backed by the store):

| Method + path | Behaviour |
| --- | --- |
| `GET/POST /v1/workspaces/{id}/projects` | list / create |
| `GET/PATCH/DELETE /v1/workspaces/{id}/projects/{project_id}` | get / update / remove (404 when missing) |
| `GET/DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models` | list / batch-delete |
| `POST /v2/workspaces/{id}/projects/{project_id}/ai_models` | add (the path the real consumer uses; writes the same store collection the v1 list/delete read) |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged` | create prompts grouped by tag name |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags` | list prompts (empty `tag_ids` lists all; otherwise OR-filter) |
| `DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts` | batch-delete prompts by id |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename` | in-place text edit (id stable; `409` on a sibling-text collision) |

### Test control routes (not part of the Project Engine API)

All under the base URL, e.g. `http://localhost:<port>/enterprise/projects/api/__dump`:

| Route | Purpose |
| --- | --- |
| `POST /__reset` | restore the store to its boot seed (or the last `/__seed`) — call between E2E cases for isolation |
| `POST /__seed` | replace the store with the posted `Snapshot` and make it the new reset baseline — set the mock to exactly the state a test needs |
| `GET /__dump` | **look inside the mock DB** — returns the current store state as JSON (every `projects:{ws}` / `ai_models:{ws}:{pr}` / `prompts:{ws}:{pr}` collection and its rows) |
| `POST /__quota` | set a workspace's AI-unit allocation: `{ workspaceId, projects?, prompts? }` (mirrors a user-manager transfer; `{ projects: 0, prompts: 0 }` = empty-units child). Project create / prompt write / publish then return the disguised quota **405** when exhausted |
| `GET /__quota?workspaceId=<ws>` | read a workspace's limits + live usage |

**Model AI-unit quota (the disguised 405).** A sub-workspace with no allocation is unlimited
(default). Grant one, then the metered ops 405 when exhausted — the behaviour the consumer's
quota handling relies on:

```bash
# grant 1 project + 2 prompts to a workspace
curl -s -XPOST .../__quota -d '{"workspaceId":"<ws>","projects":1,"prompts":2}'
# a 2nd project create, a 3rd prompt, or publishing an empty-units child now returns 405
```

**Inspect what's inside:**

```bash
curl -s http://localhost:4010/enterprise/projects/api/__dump | jq
```

**Seed state that matches your DB.** `/__seed` (and a `MOCK_SEED_FILE`) take a `Snapshot`: a
plain JSON object keyed by `<resource>:<scope>` whose values are entity rows. The Project Engine
API types every id as `format: uuid`, so use the same **UUIDs** you load into Postgres
(`semrush_workspace_id` / project id) so the two sides line up, and mirror the real entity
shapes (`ProjectAIModelResponse`, `AIOPromptWithStatus`). Any caller — including the cross-repo
harness consuming the published client — can POST this JSON directly:

```jsonc
// POST /__seed
{
  "projects:a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d": [
    { "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e", "name": "Acme", "workspace_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" }
  ],
  "ai_models:a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e": [
    { "id": "c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f", "model": { "id": "d4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f80", "key": "gpt-4o", "name": "GPT-4o" }, "prompts_count": 0 }
  ],
  "prompts:a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d:b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e": [
    { "id": "e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8091", "name": "What is Acme?", "is_new": false, "tags": [] }
  ]
}
```

Rather than hand-write that JSON, use the **typed mock factories** (the
[mock factory pattern](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9)):
each `createXMock(overrides?)` returns a spec-shaped entity typed against the generated
(overlay-corrected) component schemas, so fixtures stay in sync with the spec and `npm run
test:types` fails on drift (wrong/unknown/missing-required field). `buildSeed()` routes the
factory rows into the collection-keyed `Snapshot`. All are on the `./mock/*` subpath, so a
workspace caller (this repo's tests, or the cross-repo harness resolving spacecat-shared from
the checkout) imports them by package name:

```js
import { buildSeed } from '@adobe/spacecat-shared-project-engine-client/mock/seeds.js';
import {
  createProjectAiModelMock,
  createAiModelMock,
  createPromptMock,
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
});
await fetch(`${baseUrl}/__seed`, { method: 'POST', body: JSON.stringify(snapshot) });
```

The `./mock/*` subpath resolves against the **checked-out** package (the mock isn't in the
published tarball — see "Not published" below), which is the same source the harness boots the
mock from, so it adds no new coupling. A consumer that only has the *published* tarball has no
`buildSeed`; it POSTs the raw `Snapshot` JSON above instead.

`npm run test:e2e` drives the **real client** against a freshly booted mock (self-managed
lifecycle, `__reset` between cases). It is gated behind `MOCK_E2E=1` and lives outside the
default `npm test` glob, so the unit suite stays fast and keeps 100% coverage with no
live-server dependency. CI runs it as a dedicated `E2E (project-engine mock)` job.

> **How it runs:** the runner materializes the committed handlers from `mock/` into a
> gitignored `.counterfact/` tree (as `.ts`, so Counterfact's transpiler emits loadable `.cjs`)
> and launches with `--serve` so no spec stubs are appended onto the stateful handlers. The
> store, seeds, and resource ops are plain unit-tested JS in `mock/`; only the runner and
> the materialized handlers — which need a live server — are excluded from coverage.

> **Not published.** The `mock/` tree sits outside `src/` and outside the package's `files`
> allowlist, so nothing mock-related is in the published tarball — client consumers install
> only `src/` (the typed client + generated types), and `counterfact` stays a `devDependency`.
> The mock is booted from source via `npm run mock` (or `npm run test:e2e`) inside the
> monorepo / e2e harness, which is why it never needs to ship. The `./mock/*` entry in
> `exports` makes those source files importable by package name **when spacecat-shared is
> resolved from a checkout** (the workspace case); it intentionally has no effect for a
> tarball-only consumer, which never imports the mock.

## Committed vs generated

- **Committed:** the vendored spec (`spec/projectengine_swagger_public.yaml`).
- **Generated, committed in its own commit** and marked `linguist-generated` (see
  `.gitattributes`) so it's collapsed in review and excluded from diff counts:
  `src/generated/**`, `python/serenity_project_engine/**`.

  `datamodel-code-generator` emits a **package** (`model.py`, `aiseo.py`, `http_server.py`,
  `__init__.py`) rather than a single `models.py`: the vendored spec's Go-style dotted schema
  names (`model.X`, `aiseo.X`, `http_server.X`) are modular references, which the generator maps
  to one module per prefix. This is a tool-driven layout choice, not a spec edit.
- **Gitignored intermediate:** `build/openapi3.json`, `.counterfact/`.

## Notes

- The package is `@adobe/spacecat-shared-*` and lives under the monorepo `packages/` layout.
- Pydantic v2 is the default target; switch the `--output-model-type` flag in
  `generate:pydantic` if a consumer needs v1.
- Known spec-hygiene quirks the tooling surfaces (vendored as-is, not patched): a duplicated
  parameter block on `GET .../issue_rules`, `id`-in-query-vs-path inconsistencies on some AIO
  category/tag endpoints, and deprecated `keywords`/`tags` endpoints plus a deprecated v1
  benchmarks `POST`.
