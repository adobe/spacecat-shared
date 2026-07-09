# spacecat-shared-project-engine-client

Typed client + generated types for the Semrush **Project Engine** API, plus a stateful
Counterfact **mock** used by local dev and the cross-repo e2e harness.

- `src/` — the published client (`createSerenityProjectEngineApiClient`, an `openapi-fetch`
  client) + generated types (`src/generated/types.ts`). This is the ONLY thing that ships
  (`files: ["src"]`).
- `mock/` — the stateful mock (store, factories, seeds, quota metering, bearer auth, Counterfact
  handlers, runner). NOT published (`files: ["src"]` ships only `src/`, so the `./mock/*` subpath
  export resolves via the in-workspace symlink only, never the published registry tarball —
  intended: consumers use the mock as an in-monorepo dev dependency, not off npm). Boot
  with `npm run mock`. **Usage manual: `docs/mock-usage.md`** (humans + agents — auth, full
  endpoint inventory, seeds, control routes, quota, troubleshooting). AI-unit quota (the
  disguised-405 the live API returns for an over-allocation) is in `mock/quota.js`, set via the
  `POST /__quota` control route or `buildSeed({ quota })`, enforced on project create / prompt write
  / model attach / publish. The prompt UNIT is `texts × models` per project (a model-less project's
  texts are free), so attaching a model re-meters the project's existing texts and can itself 405.
  **Bearer auth** (`mock/auth.js`) is modelled like the live gateway — every real route
  needs `Authorization: Bearer <token>` (presence, not validity) or returns `401 { detail: 'Not
  authenticated' }`; the `__*` control routes are exempt. The gate is injected onto every handler at
  the materialization seam by `injectAuthGuard` in `mock/run.js` (so no handler can forget it). A new
  file imported by `mock/context.js` is materialized automatically — `LIB_FILES` in `mock/run.js` is
  auto-derived from the `mock/*.js` files, so there is no list to maintain. For the **containerized
  HTTPS form** of the mock (a GHCR image consumed by cross-repo e2e like spacecat-api-service, which
  requires an `https:` origin), see `docs/mock-docker.md` — `Dockerfile` + `Caddyfile` (TLS
  terminator) + `docker-entrypoint.sh` + `docker-compose.yml`, published by
  `.github/workflows/project-engine-client-mock-image.yaml` on each release tag.
- `spec/` — the vendored swagger + `spec/overlays/corrections.yaml` (corrections).

**Coverage:** this package enforces **`branches: 100`** in `.nycrc.json` — stricter than the
monorepo-standard 97% (root `CLAUDE.md`) — and excludes `mock/counterfact/routes/**` and
`mock/run.js` (materialized handlers + the server launcher need a live server, validated by the
E2E). Everything else, including `mock/inject-auth-guard.js`, hits 100%.

## Type-checking: `// @ts-check` is mandatory

**Every hand-authored `.js` file under `src/` and `mock/` MUST start with `// @ts-check`** (right
after the license header). They are type-checked by `npm run test:types`
(`tsc -p tsconfig.json` — the same config editors use, which globs `src/`, `mock/`, `test/`; add a file, it's
covered, no list to maintain). Treat a `test:types` failure like a compile error; it is the gate
that catches fixture/JSDoc drift from the overlayed schema at build time (it has already caught
real bugs in the client's retry code).

- When you add a `.js` file under `src/` or `mock/`, add `// @ts-check` and make `tsc` pass.
- Node built-ins are typed (`types: ["node"]`); `globalThis.crypto` is typed via `@types/node`
  (the `tsconfig.json` `lib` is `["esnext"]`, no `dom`).
- Prefer fixing the JSDoc/types over `@ts-ignore`. If a cast is unavoidable, use an inline
  `/** @type {...} */ (expr)` and explain why.

**The one exception** is the Counterfact route handlers under `mock/counterfact/routes/**`: they
run against Counterfact's untyped `$` context, so they deliberately OMIT `// @ts-check` (they are
still in the tsc program, just not error-reported). Don't add `// @ts-check` there unless you also
type `$`. Test specs (`test/**/*.test.js`, `*.e2e.js`) are in the program too; the typed surface
is guarded by the `.ts` type-tests under `test/types/` rather than per-spec `@ts-check`.

## Mock fixtures: the factory pattern, never literals

Build seed/fixture entities with the typed factories in `mock/factories.js` — `createProjectMock`,
`createProjectAiModelMock`, `createAiModelMock`, `createPromptMock`, `createBenchmarkMock`,
`createBrandUrlMock`, `createLanguageMock`, `createTagNodeMock`, `createAIOTagMock`, `createBrandTopicMock`,
`createBasicResponseMock`, `createInitStatusMock`, `createCiCompetitorMock` — each
`(Partial<T>) => T` typed against `components['schemas'][...]` (the
[mock factory pattern](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9)). Never
hand-write entity literals: they drift from the spec (an early seed had grown a `workspace_id` that
isn't in `ProjectResponse`). `test/types/factories.type-test.ts` proves the enforcement (the
`workspace_id` drift and a wrong field type are `@ts-expect-error` canaries). Use real UUIDs.

This applies to the **Counterfact route handlers too**, not just seeds/tests. The factories are
exposed on the per-request context as `context.factories`, so a handler builds every response
entity through them — `context.factories.createBenchmarkMock({ brand_name, domain, ... })`, the
catalog handlers map their data rows through `createLanguageMock` / `createAiModelMock` /
`createBrandTopicMock` — rather than emitting an inline literal that the untyped handler (the
`@ts-check` exception) couldn't catch drifting. The factory is the single, tsc-checked source of
truth for each shape. This holds for EVERY handler that returns an entity, including the trivial
envelope shapes: `getInitStatus` builds a `createInitStatusMock` and `updateCiCompetitors` maps
through `createCiCompetitorMock` — there are no inline-literal entity exceptions left.

The empty-body action acks (publish, batch-delete, update-benchmark) are NOT entities — they
mirror the live gateway's `content-length: 0` ack, so they return `context.emptyAck(202)` from
`mock/responses.js` rather than a factory. `emptyAck` is a raw `{ status, body: '', contentType }`
envelope (like `auth.js`'s 401 and `quota.js`'s 405): the explicit `contentType` makes Counterfact
skip response content-negotiation, which otherwise **406**s an empty-body 2xx under `Accept:
application/json` (the header the real serenity transport always sends). A bare `{ status: 204 }`
delete needs no helper — Counterfact serves 204 No Content without negotiating.

## Spec corrections: the overlay is the single source of truth

`spec/overlays/corrections.yaml` holds all corrections to the vendored swagger; the vendored
`spec/*.yaml` is NEVER edited. Add a `CRn` action there + regenerate (`npm run generate`; or
`npm run spec:convert && npm run spec:overlay` for just the mock's `build/openapi3.json`). CR5
marks always-present response fields `required` so fixtures are enforced — keep any `required`
claim faithful to what the live API actually returns AND what the mock's own create handlers
populate, or Counterfact response validation / the create paths will break.
