# Plan: user-manager-client — generation-time OpenAPI overlay (issue #1699)

GitHub issue: adobe/spacecat-shared#1699  
Reference implementation: PR #1661 (project-engine "Option C")  
Blocking issue: none (contract layer only — statefulness is tracked separately in #1700)

## Goal

Wire the same overlay mechanism used by `spacecat-shared-project-engine-client` into
`spacecat-shared-user-manager-client`. Keep the vendored
`spec/usermanager_swagger.yaml` byte-for-byte Semrush; encode corrections as a
generation-time overlay so they survive a spec refresh.

## Branch

New branch from `origin/main`. Do **not** base on `feat/user-manager-client` (PR
#1680, already merged) or the mock branch `feat/llmo-5616-user-manager-mock` (PR
#1685, unrelated concern).

```
git fetch origin main
git checkout -b feat/llmo-5558-user-manager-overlay origin/main
```

## Files to change

| File | Action |
|------|--------|
| `packages/spacecat-shared-user-manager-client/scripts/apply-overlay.mjs` | **Copy verbatim** from `packages/spacecat-shared-project-engine-client/scripts/apply-overlay.mjs` (already on `origin/main` since PR #1661). The script is spec-agnostic; only the overlay YAML differs between the two packages. |
| `packages/spacecat-shared-user-manager-client/spec/overlays/corrections.yaml` | **Create** — user-manager corrections (CR1–CR3, see below). |
| `packages/spacecat-shared-user-manager-client/package.json` | **Add** `spec:overlay` script; insert it between `spec:convert` and `generate:ts` in `generate`. |
| `packages/spacecat-shared-user-manager-client/src/generated/types.ts` | **Regenerate** after wiring (`npm run generate`). |
| `packages/spacecat-shared-user-manager-client/test/overlay.test.js` | **Create** — guard tests pinning CR1 and CR2 (mirrors `test/overlay.test.js` in project-engine). |
| `packages/spacecat-shared-user-manager-client/test/foundation.test.js` | **Update** — add assertion that the overlay step is present in the `generate` script. |
| `packages/spacecat-shared-user-manager-client/README.md` | **Update** — restore the `spec:overlay` step in the pipeline diagram and the "Spec corrections" section (these were removed from the foundation PR). |
| `packages/spacecat-shared-user-manager-client/package.json` devDependencies | **Add** `js-yaml` (required by `apply-overlay.mjs`). Mirror the version used in project-engine-client. |

## package.json changes

```json
"scripts": {
  "spec:convert":  "mkdir -p build && swagger2openapi spec/usermanager_swagger.yaml --patch --outfile build/openapi3.json",
  "spec:overlay":  "node scripts/apply-overlay.mjs",
  "generate:ts":   "openapi-typescript build/openapi3.json --output src/generated/types.ts",
  "generate:pydantic": "datamodel-codegen ...",
  "generate":      "npm run spec:convert && npm run spec:overlay && npm run generate:ts && npm run generate:pydantic"
}
```

## Overlay corrections (spec/overlays/corrections.yaml)

### CR1 — Auth: remove Auth-Data-Jwt, add imsBearer

The vendored spec carries `Auth-Data-Jwt` as a required header parameter on ~187
user-facing operations. The live Adobe gateway authenticates on
`Authorization: Bearer <IMS>` only (verified rainer-friederich 2026-06-15).

Actions:
1. Add `imsBearer` http/bearer security scheme to `$.components.securitySchemes`.
2. Apply `security: [{imsBearer: []}]` globally at `$`.
3. `remove: true` on `$.paths.*.*.parameters[?(@.name == 'Auth-Data-Jwt')]`.

Admin routes (operationId prefix `admin-*`) use an API-key header, not IMS — do
**not** remove `Auth-Data-Jwt` from those paths. Scope the filter to non-admin
paths only, or accept that the global remove is correct for admin too (the live
admin routes are internal and not called by the JS client).

### CR2 — workspace status response shape

`GET /v1/workspaces/{id}/status` is specced as `type: array, items: WorkspaceCheckResponse`
but the live API returns a single `WorkspaceCheckResponse` object. The stateful mock
(#1700) will return a single object; the types must match.

Action: `update` the `200` response schema for
`$.paths['/v1/workspaces/{id}/status'].get.responses['200'].schema` to
`$ref: '#/components/schemas/handlers.WorkspaceCheckResponse'` (unwrap the array).

### CR3 — sub-workspace lifecycle endpoint shapes

Verify and, if needed, correct the request/response shapes for the five endpoints
`spacecat-api-service`'s `rest-transport.js` actually calls:

- `POST /v2/workspaces/{id}/child` — request: `createWorkspaceV2Form` (already
  correct in spec); response: `workspaceResponse` (already correct).
- `GET /v1/workspaces/{id}/status` — covered by CR2.
- `POST /v2/workspaces/{id}/resources/transfer` — request: `WorkspaceResourcesTransferV2Form`
  (`resources` only, already correct); response: `WorkspaceResourcesV2` (verify
  against live; encode a correction if the live shape differs).
- `GET /v1/workspaces/{id}/family` — response: array of workspaces (verify shape).
- `DELETE /v1/workspaces/{id}` — response: 200 `{}` (verify; spec says 200 ok).

Read `spacecat-api-service/src/support/serenity/rest-transport.js` to confirm what
fields are actually consumed before writing overlays for CR3.

## Guard tests (test/overlay.test.js)

Mirror `packages/spacecat-shared-project-engine-client/test/overlay.test.js`.

Must assert:
- `build/openapi3.json` does **not** contain any `Auth-Data-Jwt` parameters after
  `npm run generate` (CR1 pinned).
- `build/openapi3.json` contains `imsBearer` in `components.securitySchemes` (CR1).
- `GET /v1/workspaces/{id}/status` `200` response schema is an object, not an array (CR2).

## Validation gates

1. `npm run spec:convert` — exits 0, produces `build/openapi3.json`.
2. `npm run spec:overlay` — exits 0; `build/openapi3.json` contains no
   `Auth-Data-Jwt` params and contains `imsBearer` in securitySchemes.
3. `npm run generate` — exits 0; `src/generated/types.ts` differs from the
   pre-overlay version (the `Auth-Data-Jwt` params are gone from the TS types).
4. `npm test` — all tests pass including `overlay.test.js` guard tests; coverage
   stays at 100% (or matches the package baseline).
5. `npm run lint` — clean.
6. Confirm hand-authored mock handlers on `feat/llmo-5616-user-manager-mock` are
   unaffected: Counterfact reads the raw Swagger v2 file directly (not
   `build/openapi3.json`), so the overlay does not touch the mock path.

## Out of scope

- Client wrapper (`openapi-fetch` layer) — separate PR.
- Making the mock stateful for the new endpoints — tracked in #1700.
