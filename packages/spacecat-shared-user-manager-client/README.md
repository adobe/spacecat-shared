# @adobe/spacecat-shared-user-manager-client

Typed integration with the Semrush **User Manager API** (`/enterprise/users/api`):

- generated **TypeScript** (`src/generated/types.ts`) and **Pydantic v2** (`python/serenity_user_manager/`) types,
- a thin **User Manager client** (`openapi-fetch` over the generated `paths`) — later PR,
- a **Counterfact mock** for E2E tests and local dev — later PR.

> **This PR is the foundation slice only:** vendor the spec + wire the
> conversion-and-type-generation pipeline. The client wrapper (with auth —
> `Authorization: Bearer <IMS>` for user-facing routes, API-Key header for admin routes;
> `Auth-Data-Jwt` is a spec artifact and must not be sent per the CR2 finding below) and
> the stateful mock store land in follow-up PRs. This mirrors the Project Engine
> foundation slice (LLMO-5461) applied to a second, larger API (see LLMO-5558).

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

> **Spec auth correction (CR2 — same finding as Project Engine, rainer-friederich
> 2026-06-15):** the vendored spec models auth as a required `Auth-Data-Jwt` header
> parameter on ~187 operations. This is a **vendor spec artifact** — the live Adobe
> gateway authenticates on `Authorization: Bearer <IMS>` only. Sending `Auth-Data-Jwt`
> alone returns 401; sending both headers also returns 401. A generation-time overlay
> to strip `Auth-Data-Jwt` from all operations and add a real bearer security scheme
> (mirroring the CR2 overlay planned for Project Engine) will land in a follow-up PR. Refresh is **manual**: drop in the newer
file, re-run `npm run generate`, and review the diff. There is no automated drift detection
while endpoint access is restricted.

## Pipeline

```
spec/usermanager_swagger.yaml  (vendored, Swagger 2.0)
        │
        ├── Counterfact ── reads v2 directly ──►  mock (no conversion)   [npm run mock]
        │
        └── swagger2openapi (v2 → 3.x) ──►  build/openapi3.json
                                                │
                                                ├── openapi-typescript ──► src/generated/types.ts
                                                └── datamodel-code-generator ──► python/serenity_user_manager/
```

The v2 → 3.x conversion exists **only** to feed the type generators (`openapi-typescript`
is v3-only, and 3.x yields cleaner TS/Pydantic). **Counterfact reads the raw v2 file
directly**, so the mock path never touches the converted artifact.

| Command | Does |
| --- | --- |
| `npm run spec:convert` | v2 → 3.x via `swagger2openapi --patch` → `build/openapi3.json` |
| `npm run generate:ts` | `openapi-typescript` → `src/generated/types.ts` |
| `npm run generate:pydantic` | `datamodel-code-generator` → `python/serenity_user_manager/` package |
| `npm run generate` | all of the above, in order |
| `npm run mock` | Counterfact mock on `:4010`, straight off the v2 spec |

`datamodel-code-generator` is a **Python** tool, not an npm dependency. Install it once on
your `PATH` before running `generate:pydantic`:

```bash
pip install datamodel-code-generator
```

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
  vs `/enterprise/projects/api`). The auth split (which operations take `Auth-Data-Jwt`/IMS
  vs API-Key) is resolved against the Adobe gateway when the client wrapper lands.
