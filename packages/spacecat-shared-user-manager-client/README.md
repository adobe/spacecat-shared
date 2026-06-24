# @adobe/spacecat-shared-user-manager-client

Typed integration with the Semrush **User Manager API** (`/enterprise/users/api`):

- a thin, typed **client wrapper** (`createSerenityUserManagerApiClient`) over the generated `paths` — owns the base URL, IMS-Bearer auth, and retries (see [Client](#client)),
- generated **TypeScript** (`src/generated/types.ts`) and **Pydantic v2** (`python/serenity_user_manager/`) types,
- a generation-time **spec-correction overlay** (`spec/overlays/corrections.yaml`) that aligns the vendored swagger with the live API (see [Spec corrections](#spec-corrections)),
- a **Counterfact mock** for E2E tests and local dev (`npm run mock`).

## Client

`createSerenityUserManagerApiClient(options)` returns an [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/)
client fully typed over the generated `paths`. It owns the fixed `/enterprise/users/api` prefix,
forwards the caller's IMS JWT as `Authorization: Bearer <token>` (no minting or exchange — Semrush
accepts the IMS bearer directly), and retries `429` / retryable `5xx` / network errors with
jittered exponential backoff that honours `Retry-After`.

```js
import { createSerenityUserManagerApiClient } from '@adobe/spacecat-shared-user-manager-client';

const client = createSerenityUserManagerApiClient({
  // origin only — the client appends `/enterprise/users/api` itself. The host is shared with
  // Project Engine (`SEMRUSH_PROJECTS_BASE_URL`), or the Counterfact mock's origin for E2E.
  baseUrl: 'https://adobe-hackathon.semrush.com',
  // a raw IMS JWT, or a (sync/async) getter resolved per request
  authToken: () => getCurrentImsToken(),
});

const { data, error, response } = await client.GET('/v1/countries');
```

Options: `baseUrl` and `authToken` are required; `maxRetries` (default `2`), `retryBaseDelayMs`
(default `200`), `onRetry` (best-effort observability hook), and `fetch` (injectable, for tests)
are optional. Request/response shapes come straight from the generated types — see `src/index.d.ts`.

This package follows the Project Engine client (LLMO-5461) applied to a second, larger API
(LLMO-5558).

This package follows the `spacecat-shared` convention: **JS + ESM**, JSDoc-typed source,
`mocha` + `chai` + `c8` for tests, and `@adobe/eslint-config-helix` for lint. The scaffold's
TypeScript surface is ported to JS + JSDoc; the generated `types.ts` is a **type artifact only**,
consumed by the client via JSDoc `import(...)` and by `openapi-fetch` at type-check time.

## Spec source

The spec is a **vendored file** — `spec/usermanager_swagger.yaml` — kept under version
control. Semrush only provides the file (no endpoint access in the near term), and it's
**Swagger 2.0** (no v3/v3.1 on offer). It is large: ~234 paths / ~284 operations across
~30 tags (Admin, Users, Workspaces, Projects, Keywords, Limits, Service Units,
ActivationPanel, …), ~187 user-facing operations and ~97 admin/internal operations.

The vendored file is **never edited**; where it diverges from the live API, a generation-time
overlay corrects the converted artifact instead (see [Spec corrections](#spec-corrections)).
Refresh is **manual**: drop in the newer file, re-run `npm run generate`, and review the diff.
There is no automated drift detection while endpoint access is restricted.

## Pipeline

```
spec/usermanager_swagger.yaml  (vendored, Swagger 2.0)
        │
        ├── Counterfact ── reads v2 directly ──►  mock (no conversion)   [npm run mock]
        │
        └── swagger2openapi (v2 → 3.x) ──►  build/openapi3.json
                                                │
                                                ├── apply-overlay (corrections) ──► build/openapi3.json (in place)
                                                │
                                                ├── openapi-typescript ──► src/generated/types.ts
                                                └── datamodel-code-generator ──► python/serenity_user_manager/
```

The v2 → 3.x conversion exists **only** to feed the type generators (`openapi-typescript`
is v3-only, and 3.x yields cleaner TS/Pydantic); the overlay then corrects that converted
artifact before the generators run. **Counterfact reads the raw v2 file directly**, so the mock
path never touches the converted artifact (and so does not see the corrections — a known gap the
client wrapper's follow-up addresses).

| Command | Does |
| --- | --- |
| `npm run spec:convert` | v2 → 3.x via `swagger2openapi --patch` → `build/openapi3.json` |
| `npm run spec:overlay` | apply `spec/overlays/corrections.yaml` to `build/openapi3.json` in place |
| `npm run generate:ts` | `openapi-typescript` → `src/generated/types.ts` |
| `npm run generate:pydantic` | `datamodel-code-generator` → `python/serenity_user_manager/` package |
| `npm run generate` | all of the above, in order |
| `npm run mock` | Counterfact mock on `:4010`, straight off the v2 spec |

`datamodel-code-generator` is a **Python** tool, not an npm dependency. Install it once on
your `PATH` before running `generate:pydantic`:

```bash
pip install datamodel-code-generator
```

## Spec corrections

The vendored swagger diverges from the live API in two places. A small OpenAPI Overlay
(`spec/overlays/corrections.yaml`), applied to the converted OAS3 artifact at generation time by
`scripts/apply-overlay.mjs`, corrects them; the vendored `spec/usermanager_swagger.yaml` is never
touched.

- **CR1 — auth.** The spec models a required `Auth-Data-Jwt` header on ~187 operations, but the
  live API authenticates on `Authorization: Bearer <IMS>` only — Semrush accepts the IMS bearer
  directly. The overlay removes `Auth-Data-Jwt` from every operation and adds an `imsBearer`
  security scheme. (Verified rainer-friederich 2026-06-15: `Auth-Data-Jwt` alone → 401; both
  headers → 401; `Authorization: Bearer` → 200.)
- **CR2 — workspace status shape.** `GET /v1/workspaces/{id}/status` is typed as an array of
  `WorkspaceCheckResponse`, but the live API returns a single object
  (`{ status: "not ready" | "created" | "error" }`) — the deployed api-service transport reads it
  as `status.status === 'created'`. The overlay drops the array wrapper.

Guard tests in `test/foundation.test.js` pin CR1 and CR2 against the generated surface, so a
future Semrush spec refresh that silently drops the overlay fails loudly instead of regressing the
generated types. `test/overlay.test.js` covers the overlay applier itself.

## Committed vs generated

- **Committed:** the vendored spec (`spec/usermanager_swagger.yaml`).
- **Generated, committed in its own commit** and marked `linguist-generated` (see
  `.gitattributes`) so it's collapsed in review and excluded from diff counts:
  `src/generated/**`, `python/serenity_user_manager/**`.

  `datamodel-code-generator` may emit a **package** (`model.py`, `__init__.py`, plus one
  module per dotted schema-name prefix) rather than a single `models.py`, mirroring the
  vendored spec's modular schema references. This is a tool-driven layout choice, not a
  spec edit.
- **Gitignored intermediate:** `build/openapi3.json`, `.counterfact/`.

## Notes

- The package is `@adobe/spacecat-shared-*` and lives under the monorepo `packages/` layout.
- Pydantic v2 is the default target; switch the `--output-model-type` flag in
  `generate:pydantic` if a consumer needs v1.
- The base host is shared with Project Engine (`SEMRUSH_PROJECTS_BASE_URL`, e.g. the dev
  `https://adobe-hackathon.semrush.com`); only the basePath differs (`/enterprise/users/api`
  vs `/enterprise/projects/api`). The live API authenticates on `Authorization: Bearer <IMS>` —
  Semrush accepts the IMS bearer directly (see [Spec corrections](#spec-corrections)).
