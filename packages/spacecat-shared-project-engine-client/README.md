# @adobe/spacecat-shared-project-engine-client

Typed integration with the Semrush **Project Engine API** (`/enterprise/projects/api`):

- generated **TypeScript** (`src/generated/types.ts`) and **Pydantic v2** (`python/serenity_project_engine/`) types,
- a thin **Project Engine client** (`openapi-fetch` over the generated `paths`) — IMS Bearer auth + idempotency-aware retries (see [Client](#client)),
- a generation-time **spec-correction overlay** (`spec/overlays/corrections.yaml`) that aligns the vendored swagger with the live API,
- a **Counterfact mock** for E2E tests and local dev (`npm run mock`); the stateful mock store lands in a follow-up (LLMO-5460).

> **Scope:** this PR vendors the spec, wires the conversion-and-type-generation
> pipeline plus the correction overlay, and adds the typed client. The IMS handler
> move and the stateful mock store land in follow-up PRs (see LLMO-5461 / LLMO-5460).

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
