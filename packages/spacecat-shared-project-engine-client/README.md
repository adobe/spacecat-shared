# @adobe/spacecat-shared-project-engine-client

Typed integration with the Semrush **Project Engine API** (`/enterprise/projects/api`):

- generated **TypeScript** (`src/generated/types.ts`) and **Pydantic v2** (`python/serenity_project_engine/`) types,
- a thin **Project Engine client** (`openapi-fetch` over the generated `paths`) — later PR,
- a **stateful Counterfact mock** for E2E tests and local dev (`npm run mock`, see below).

> **This PR is the foundation slice only:** vendor the spec + wire the
> conversion-and-type-generation pipeline. The client wrapper, the IMS handler move,
> and the stateful mock store land in follow-up PRs (see LLMO-5461 / LLMO-5460).

This package follows the `spacecat-shared` convention: **JS + ESM**, JSDoc-typed source,
`mocha` + `chai` + `c8` for tests, and `@adobe/eslint-config-helix` for lint. The scaffold's
TypeScript surface is ported to JS + JSDoc; the generated `types.ts` is a **type artifact only**,
consumed by the client via JSDoc `import(...)` and by `openapi-fetch` at type-check time.

## Spec source

The spec is a **vendored file** — `spec/projectengine_swagger_public.yaml` — kept under
version control. Semrush only provides the file (no endpoint access in the near term), and
it's **Swagger 2.0** (no v3/v3.1 on offer). Refresh is **manual**: drop in the newer file,
re-run `npm run generate`, and review the diff. There is no automated drift detection while
endpoint access is restricted.

## Pipeline

```
spec/projectengine_swagger_public.yaml  (vendored, Swagger 2.0)
        │
        ├── Counterfact ── reads v2 directly ──►  mock (no conversion)   [npm run mock]
        │
        └── swagger2openapi (v2 → 3.x) ──►  build/openapi3.json
                                                │
                                                ├── openapi-typescript ──► src/generated/types.ts
                                                └── datamodel-code-generator ──► python/serenity_project_engine/
```

The v2 → 3.x conversion exists **only** to feed the type generators (`openapi-typescript`
is v3-only, and 3.x yields cleaner TS/Pydantic). **Counterfact reads the raw v2 file
directly**, so the mock path never touches the converted artifact.

| Command | Does |
| --- | --- |
| `npm run spec:convert` | v2 → 3.x via `swagger2openapi --patch` → `build/openapi3.json` |
| `npm run generate:ts` | `openapi-typescript` → `src/generated/types.ts` |
| `npm run generate:pydantic` | `datamodel-code-generator` → `python/serenity_project_engine/` package |
| `npm run generate` | all of the above, in order |
| `npm run mock` | Counterfact mock on `:4010`, straight off the v2 spec |

`datamodel-code-generator` is a **Python** tool, not an npm dependency. Install it once on
your `PATH` before running `generate:pydantic`:

```bash
pip install datamodel-code-generator
```

## Mock (stateful)

`npm run mock` starts a **stateful** Counterfact server straight off the v2 spec. Unmodelled
paths fall back to Counterfact's spec-driven stubs; the project spine is backed by a shared
in-memory store so reads reflect prior writes within a run.

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

> **How it runs:** the runner materializes the committed handlers from `src/mock/` into a
> gitignored `.counterfact/` tree (as `.ts`, so Counterfact's transpiler emits loadable `.cjs`)
> and launches with `--serve` so no spec stubs are appended onto the stateful handlers. The
> store, seeds, and resource ops are plain unit-tested JS in `src/mock/`; only the runner and
> the materialized handlers — which need a live server — are excluded from coverage.

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
