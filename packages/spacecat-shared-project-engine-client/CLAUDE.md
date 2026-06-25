# spacecat-shared-project-engine-client

Typed client + generated types for the Semrush **Project Engine** API, plus a stateful
Counterfact **mock** used by local dev and the cross-repo e2e harness.

- `src/` — the published client (`createSerenityProjectEngineApiClient`, an `openapi-fetch`
  client) + generated types (`src/generated/types.ts`). This is the ONLY thing that ships
  (`files: ["src"]`).
- `mock/` — the stateful mock (store, factories, seeds, Counterfact handlers, runner). NOT
  published; importable in-workspace via the `./mock/*` subpath export. Boot with `npm run mock`.
- `spec/` — the vendored swagger + `spec/overlays/corrections.yaml` (corrections).

## Type-checking: `// @ts-check` is mandatory

**Every hand-authored `.js` file under `src/` and `mock/` MUST start with `// @ts-check`** (right
after the license header). They are type-checked by `npm run test:types`
(`tsc -p tsconfig.json` — the same config editors use, which globs `src/`, `mock/`, `test/`; add a file, it's
covered, no list to maintain). Treat a `test:types` failure like a compile error; it is the gate
that catches fixture/JSDoc drift from the overlayed schema at build time (it has already caught
real bugs in the client's retry code).

- When you add a `.js` file under `src/` or `mock/`, add `// @ts-check` and make `tsc` pass.
- Node built-ins are typed (`types: ["node"]`); `globalThis.crypto` is typed via lib `dom`.
- Prefer fixing the JSDoc/types over `@ts-ignore`. If a cast is unavoidable, use an inline
  `/** @type {...} */ (expr)` and explain why.

**The one exception** is the Counterfact route handlers under `mock/counterfact/routes/**`: they
run against Counterfact's untyped `$` context, so they deliberately OMIT `// @ts-check` (they are
still in the tsc program, just not error-reported). Don't add `// @ts-check` there unless you also
type `$`. Test specs (`test/**/*.test.js`, `*.e2e.js`) are in the program too; the typed surface
is guarded by the `.ts` type-tests under `test/types/` rather than per-spec `@ts-check`.

## Mock fixtures: the factory pattern, never literals

Build seed/fixture entities with the typed factories in `mock/factories.js` — `createProjectMock`,
`createProjectAiModelMock`, `createAiModelMock`, `createPromptMock` — each `(Partial<T>) => T`
typed against `components['schemas'][...]` (the
[mock factory pattern](https://dev.to/davelosert/mock-factory-pattern-in-typescript-44l9)). Never
hand-write entity literals: they drift from the spec (an early seed had grown a `workspace_id` that
isn't in `ProjectResponse`). `test/types/factories.type-test.ts` proves the enforcement (the
`workspace_id` drift and a wrong field type are `@ts-expect-error` canaries). Use real UUIDs.

## Spec corrections: the overlay is the single source of truth

`spec/overlays/corrections.yaml` holds all corrections to the vendored swagger; the vendored
`spec/*.yaml` is NEVER edited. Add a `CRn` action there + regenerate (`npm run generate`; or
`npm run spec:convert && npm run spec:overlay` for just the mock's `build/openapi3.json`). CR5
marks always-present response fields `required` so fixtures are enforced — keep any `required`
claim faithful to what the live API actually returns AND what the mock's own create handlers
populate, or Counterfact response validation / the create paths will break.
