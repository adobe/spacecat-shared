# spacecat-shared-user-manager-client

Typed client + generated types for the Semrush **User Manager** gateway (`/enterprise/users/api`),
plus a stateful Counterfact **mock** of the sub-workspace lifecycle surface, used by local dev and
the cross-repo e2e harness. Sibling of `spacecat-shared-project-engine-client` (the *project*
gateway, `/enterprise/projects/api`) — two deliberately separate packages, one prefix each.

- `src/` — the published client (`createSerenityUserManagerApiClient`, an `openapi-fetch` client)
  + generated types (`src/generated/types.ts`). This is the ONLY thing that ships
  (`files: ["src"]`).
- `mock/` — the stateful mock (store, factories, seeds, parent-pool quota metering, bearer auth,
  Counterfact handlers, runner). NOT published (`files: ["src"]` ships only `src/`, so the
  `./mock/*` subpath export resolves via the in-workspace symlink only, never the published
  registry tarball — intended: consumers use the mock as an in-monorepo dev dependency, not off
  npm). Boot with `npm run mock` (serves on `:4010` under `--prefix /enterprise/users/api`).
  **Usage manual: `docs/mock-usage.md`** (humans + agents — auth, the five-route endpoint
  inventory, seeds, control routes, quota, troubleshooting); **statefulness + live-fidelity record:
  `docs/mock-statefulness.md`**. Parent-pool quota (the `422` the live gateway returns when a child
  create / resource transfer over-draws the parent allocation) is in `mock/quota.js`, set via the
  `POST /__quota` control route or `buildSeed({ pools })`; default — no pool record — is unlimited.
  **Bearer auth** (`mock/auth.js`) is modelled like the live gateway — every real route needs
  `Authorization: Bearer <token>` (presence, not validity) or returns `401 { detail: 'Not
  authenticated' }`; the `__*` control routes are exempt. The gate is injected onto every handler at
  the materialization seam by `injectAuthGuard` (defined in `mock/inject-auth-guard.js`, called from
  `mock/run.js`), which throws if a handler is authored in a shape it can't guard (fail-closed — no
  route can serve unauthenticated by accident).
  A new file imported by `mock/context.js` is materialized automatically — `LIB_FILES` in
  `mock/run.js` is auto-derived from the `mock/*.js` files, so there is no list to maintain. For the
  **containerized HTTPS form** of the mock (a GHCR image consumed by cross-repo e2e like
  spacecat-api-service, which requires an `https:` origin), see `docs/mock-docker.md` — `Dockerfile`
  + `Caddyfile` (TLS terminator) + `docker-entrypoint.sh` + `docker-compose.yml`, published by
  `.github/workflows/user-manager-client-mock-image.yaml` on each release tag.
- `spec/` — the vendored swagger (`spec/usermanager_swagger.yaml`, NEVER edited) +
  `spec/overlays/corrections.yaml` (corrections), applied by `scripts/apply-overlay.mjs`.

**Coverage:** this package enforces **`branches: 100`** (also lines/statements) in `.nycrc.json` —
stricter than the monorepo-standard 97% (root `CLAUDE.md`) — over `src/**` + `mock/**`, and excludes
`src/generated/**`, `mock/run.js`, and `mock/counterfact/**` (generated types + the server launcher +
materialized handlers, which need a live server — validated by the E2E). Everything else, including
`mock/inject-auth-guard.js`, hits 100%.

## Type-checking: `// @ts-check` on the mock surface

**Every hand-authored `.js` file under `mock/` starts with `// @ts-check`** (right after the
license header), and so must every new `.js` file you add under `src/` or `mock/`. They are
type-checked by `npm run test:types` (`tsc -p tsconfig.json` — the same config editors use, which
globs `src/`, `mock/`, `test/`; `allowJs` + `checkJs: false` means only the `@ts-check`-annotated
files are error-reported, but adding a file still pulls it into the program). Treat a `test:types`
failure like a compile error; it is the gate that catches fixture/JSDoc drift from the overlayed
schema at build time.

- When you add a `.js` file under `src/` or `mock/`, add `// @ts-check` and make `tsc` pass.
- Node built-ins are typed (`types: ["node"]`); `globalThis.crypto` is typed via `@types/node`
  (the `tsconfig.json` `lib` is `["esnext"]`, no `dom`).
- Prefer fixing the JSDoc/types over `@ts-ignore`. If a cast is unavoidable, use an inline
  `/** @type {...} */ (expr)` and explain why.

**The one exception** is the Counterfact route handlers under `mock/counterfact/routes/**`: they
run against Counterfact's untyped `$` context, so they deliberately OMIT `// @ts-check` (they are
still in the tsc program, just not error-reported). Don't add `// @ts-check` there unless you also
type `$`. Test specs (`test/**/*.test.js`, `*.e2e.js`) are in the program too; the typed surface is
guarded by the `.ts` type-tests under `test/types/` rather than per-spec `@ts-check`.

**The pre-existing published client** (`src/client.js`, `src/index.js`, `src/internal.js`) predates
the mock and is the shipped surface — it is guarded by its hand-written `src/index.d.ts` and the
`test/*.test.js` suite, not `@ts-check`. New source you add there carries `// @ts-check`.

## Mock fixtures: the factory pattern, never literals

Build seed/fixture entities with the typed factories in `mock/factories.js` — `createWorkspaceMock`,
`createWorkspaceStatusMock`, `createWorkspaceDeleteResponseMock`, `createBasicResponseMock` — each
`(Partial<T>) => T` typed against `components['schemas'][...]` (`handlers.workspaceResponse`,
`handlers.WorkspaceCheckResponse`, `handlers.workspaceDeleteResponse`, `http_server.BasicResponse`)
— the [mock factory pattern](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9).
Never hand-write entity literals: they drift from the spec. `test/types/factories.type-test.ts`
proves the enforcement (a wrong field type and an unknown field are `@ts-expect-error` canaries).
Use real UUIDs.

This applies to the **Counterfact route handlers too**, not just seeds/tests. The factories are
exposed on the per-request context as `context.factories`, so a handler builds every response
entity through them — the child-create handler maps through `createWorkspaceMock`, the status
handler through `createWorkspaceStatusMock`, the delete handler through
`createWorkspaceDeleteResponseMock`, and the error envelopes through `createBasicResponseMock` —
rather than emitting an inline literal that the untyped handler (the `@ts-check` exception) couldn't
catch drifting. The factory is the single, tsc-checked source of truth for each shape.

## Spec corrections: the overlay is the single source of truth

`spec/overlays/corrections.yaml` holds all corrections to the vendored swagger; the vendored
`spec/usermanager_swagger.yaml` is NEVER edited. Add a `CRn` action there + regenerate
(`npm run generate`; or `npm run spec:convert && npm run spec:overlay` for just the mock's
`build/openapi3.json`). The corrections live-pinned against the real gateway (see
`docs/mock-statefulness.md`):

- **CR1** — express `Authorization: Bearer` as the security scheme; remove the vendored
  `Auth-Data-Jwt` header param.
- **CR2** — `GET /v1/workspaces/{id}/status` returns a single object `{ status }`, not the
  spec's array.
- **CR3** — mark the always-present identity fields `required` (`id`/`title`/`status` on
  `workspaceResponse`, `status` on `WorkspaceCheckResponse`) so fixtures/responses are enforced.
- **CR4** — `POST /v2/workspaces/{id}/resources/transfer` returns the updated `workspaceResponse`,
  not the spec's `WorkspaceResourcesV2` (live-confirmed via an api-service re-grant replay).

Keep any `required` claim faithful to what the live API actually returns AND what the mock's own
create handlers populate, or Counterfact response validation / the create paths will break.

**Overlay-freshness gate** (mirrors project-engine-client #1733): `scripts/apply-overlay.mjs`
exposes a testable `main()` and `test/overlay.test.js` asserts every `CRn` still applies to >0
nodes and actually changes the spec — a correction the upstream swagger has since fixed (so it
matches nothing) fails CI here instead of drifting silently. When Semrush fixes a divergence
upstream, delete the now-stale `CRn` rather than leaving a dead correction.
