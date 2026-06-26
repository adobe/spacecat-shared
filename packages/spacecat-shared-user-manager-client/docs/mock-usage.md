# User Manager mock — usage manual (humans & agents)

A stateful [Counterfact](https://counterfact.dev) mock of the Semrush **User Manager** gateway
(`/enterprise/users/api`) — the sub-workspace **lifecycle** surface the api-service serenity
transport calls (`createSubworkspace` / `getWorkspaceStatus` / `listWorkspaceFamily` /
`transferWorkspaceResources` / `deleteWorkspace`). It is the sibling of the
`spacecat-shared-project-engine-client` mock (which models the *project* gateway,
`/enterprise/projects/api`); the two are deliberately separate packages, one prefix each.

The mock is an in-workspace dev dependency only — it is NOT in the npm tarball (`files: ["src"]`),
exposed via the `./mock/*` export and the `mock/` symlink. To run the mock as a containerized HTTPS
service for a cross-repo e2e suite (e.g. spacecat-api-service), see [`mock-docker.md`](./mock-docker.md).

## 1. Quick start

```bash
npm run generate -w @adobe/spacecat-shared-user-manager-client   # build/openapi3.json (once)
npm run mock     -w @adobe/spacecat-shared-user-manager-client   # boots on :4010 (MOCK_PORT to override)
```

The runner (`mock/run.js`) materializes the committed handlers into a gitignored `.counterfact/`
tree and launches Counterfact in **serve-only** mode under `--prefix /enterprise/users/api`. Only
the five modelled routes (+ the `__*` control routes) answer; **every other path 404s** (no random
stubs). Request + response validation stay **on** — the overlay-corrected spec is the contract.

## 2. Authentication (bearer required)

Every real route requires `Authorization: Bearer <token>` (presence only — the mock is not an IMS
verifier). A missing/blank credential returns the live gateway's body, **verified live 2026-06-26**:

```bash
curl -s localhost:4010/enterprise/users/api/v1/workspaces/<id>/status
# 401 { "detail": "Not authenticated" }
curl -s -H 'Authorization: Bearer anything' localhost:4010/enterprise/users/api/v1/workspaces/<id>/status
# 200 { "status": "created" }
```

The `__*` control routes are auth-exempt (test plumbing). Auth is injected onto every materialized
handler at one seam (`mock/inject-auth-guard.js`), which throws at materialization if any handler
is authored in a shape it can't guard — so no route can serve unauthenticated by accident.

## 3. Endpoint inventory (the modelled surface)

Path params are literal dir names (`{id}`); the filesystem mirrors the URL.

| Op (consumer) | Route | Result |
| --- | --- | --- |
| `createSubworkspace` | `POST /v2/workspaces/{id}/child` | `200` workspace; child linked to parent `{id}`, drawn from its pool |
| `getWorkspaceStatus` | `GET /v1/workspaces/{id}/status` | `200 { status }` (object, **not** an array — overlay CR2); `403` if unknown/deleted |
| `listWorkspaceFamily` | `GET /v1/workspaces/{id}/family` | `200` **top-level array** of the workspace + its descendants |
| `transferWorkspaceResources` | `POST /v2/workspaces/{id}/resources/transfer` | `200` the updated `workspaceResponse` (overlay CR4 — **not** the spec's `WorkspaceResourcesV2`); `403` if unknown; `422` if the parent pool can't cover it |
| `deleteWorkspace` | `DELETE /v1/workspaces/{id}` | `200 { id }`, cascades over descendants; `403` if unknown/deleted |

`GET`/`PUT` on `/v1/workspaces/{id}` exist in the spec but the consumer never calls them, so only
`DELETE` is modelled (the other verbs are unhandled → 404/405).

## 4. Seeds

State boots from a named seed (`MOCK_SEED`), or a JSON snapshot file (`MOCK_SEED_FILE`, wins).

| Seed | Contents |
| --- | --- |
| `parent-with-child` (default) | the org parent + one provisioned child (`SEED_IDS.parentWorkspaceId` / `.childWorkspaceId`) |
| `empty-parent` | the org parent only — the "create a sub-workspace from scratch" flow |

`buildSeed({ workspaces, pools })` authors a snapshot from a DB-shaped description (use the
`semrush_workspace_id` UUIDs from your fixtures so the mock and Postgres line up). Each workspace is
built through the typed `createWorkspaceMock` factory; `pendingStatusReads` seeds a deterministic
`not ready` budget, and `pools` seed finite parent allocations.

## 5. Control routes (test harness, auth-exempt)

| Route | Purpose |
| --- | --- |
| `POST /__reset` | restore the boot seed |
| `POST /__seed` | load an arbitrary collection-keyed snapshot (new reset baseline) |
| `GET /__dump` | inspect the live store (`workspaces`, `workspace_pool`, `workspace_status`) |
| `POST /__quota` `{ workspaceId, projects?, prompts? }` | set a parent's available pool (omit a dim = unlimited) |
| `POST /__status` `{ workspaceId, pending }` | next `pending` status reads return `not ready`, then settle |

## 6. Parent-pool metering (the 422)

A child create / resource transfer draws `{ ai: { projects, prompts } }` from the **parent's** pool.
Default — no pool record — is **unlimited** (the dev parent runs limits-disabled). Set a finite pool
to model exhaustion:

```bash
curl -s -XPOST localhost:4010/enterprise/users/api/__quota \
  -H 'content-type: application/json' -d '{"workspaceId":"<parent>","projects":0,"prompts":0}'
# now a createSubworkspace under <parent> → 422 { "message": "insufficient available units" }
```

The 422 **envelope** (`{ message }`) is live-confirmed (2026-06-26). Live also returns a second 422
variant — `{ "message": "workspace not ready" }` — when a transfer/delete races a still-settling
child; the mock is immediately-consistent and does not model that lock (see mock-statefulness.md).

## 7. Driving the mock from tests / an agent

Boot it, then drive the **real typed client** (it appends the `/enterprise/users/api` prefix from the
origin you pass):

```js
import { createSerenityUserManagerApiClient } from '@adobe/spacecat-shared-user-manager-client';
const client = createSerenityUserManagerApiClient({ baseUrl: 'http://127.0.0.1:4010', authToken: 't' });
const { data } = await client.GET('/v1/workspaces/{id}/status', { params: { path: { id } } });
```

See `test/e2e/user-manager-mock.e2e.js` for the full boot/teardown harness (OS-assigned port,
readiness poll, detached-group shutdown) and a worked example of every op, the deterministic
`not ready → created` poll, the 401, the 422, and the 403-after-delete.

## 8. How it runs (internals)

- `mock/store.js` — generic `InMemoryStore` (collection-keyed CRUD, deep-clone on read/write, reset).
- `mock/stateful.js` — pure ops over the `workspaces` tree (create / status / family / cascade
  delete) + the deterministic status budget.
- `mock/factories.js` — typed `createXMock(Partial<T>) => T` against `src/generated/types.ts`.
- `mock/seeds.js` / `quota.js` / `auth.js` / `context.js` — seeds, parent-pool metering, the bearer
  gate, and the per-request Context wiring it all together.
- `mock/run.js` — materializes handlers to `.counterfact/` as `.ts`, injects the auth guard, launches
  `--serve` (no `generate`) against `build/openapi3.json`.

Coverage: the pure layer is unit-tested at **100% (branches 100)**; `mock/run.js` +
`mock/counterfact/**` are coverage-excluded and validated by the e2e (`MOCK_E2E=1 npm run test:e2e`).

## 9. Capturing real API responses to build a faithful handler

Replay the consumer's call against the real gateway and pin the mock to what comes back. The
auth, base URL, and a funded test workspace come from Vault + `mysticat`:

```bash
TOKEN=$(mysticat auth token --ims)                                   # never echo it
BASE="$(vault kv get -field=SEMRUSH_PROJECTS_BASE_URL dx_mysticat/prod/api-service)/enterprise/users/api"
curl -sS -H "Authorization: Bearer $TOKEN" -D - "$BASE/v1/workspaces/<funded>/status"
```

**Writes are prod** — only with explicit authorization, on a throwaway child, `trap`-cleaned, with
a before/after `family` diff to prove residue = 0. **A just-created child is `not ready` for tens of
seconds; transfer/delete against it 422 "workspace not ready" — poll `status` to `created` first**
(delete is also eventually-consistent: the `family` listing lags the 200 ack). See the replay record
in mock-statefulness.md.

## 10. Troubleshooting

- **`build/openapi3.json not found`** → run `npm run generate` first (it is gitignored).
- **everything 404s** → wrong prefix; the surface lives under `/enterprise/users/api`.
- **every request 401s** → missing `Authorization: Bearer`.
- **a write 422s "workspace not ready"** (live only) → the target child is still settling; poll
  `status` to `created` first.
