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
`npm run generate`, and review the diff. There is no automated drift detection while endpoint
access is restricted.

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

`npm run mock` starts a **stateful** Counterfact server off the corrected OAS3 artifact
(`build/openapi3.json` — run `npm run generate` first). Unmodelled paths fall back to
Counterfact's spec-driven stubs; the project spine is backed by a shared in-memory store so
reads reflect prior writes within a run.

```bash
npm run mock                       # serves on :4010
MOCK_PORT=4032 MOCK_SEED=empty-workspace npm run mock
```

Base URL: `http://localhost:<port>/enterprise/projects/api`.

| Var | Default | Purpose |
| --- | --- | --- |
| `MOCK_PORT` | `4010` | listen port |
| `MOCK_SEED` | default seed | startup fixture; unknown values fall back to the default |

Stateful endpoints (backed by the store):

| Method + path | Behaviour |
| --- | --- |
| `GET/POST /v1/workspaces/{id}/projects` | list / create |
| `GET/PATCH/DELETE /v1/workspaces/{id}/projects/{project_id}` | get / update / remove (404 when missing) |
| `GET/POST /v1/workspaces/{id}/projects/{project_id}/ai_models` | list / add |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged` | create prompts grouped by tag name |
| `POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags` | list prompts (empty `tag_ids` lists all; otherwise OR-filter) |
| `DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts` | batch-delete prompts by id |

`POST /enterprise/projects/api/__reset` restores the store to its startup seed — call it
between E2E cases for isolation. It is a test control route, not part of the Project Engine API.

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
> monorepo / e2e harness, which is why it never needs to ship.

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
