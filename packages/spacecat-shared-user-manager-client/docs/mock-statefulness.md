# User Manager mock — statefulness (LLMO-5616)

Which resources of the User Manager mock get real state, and why — plus the live-fidelity record
that pins the mock to the real gateway.

## The question

A faithful mock needs state only where a flow **writes then reads** that write. Everything else is a
thin echo handler. So: which sub-workspace lifecycle resources does the consumer write-then-read?

## Confirmed consumer inventory (the AC floor)

The only consumer is `spacecat-api-service` `src/support/serenity/` (`rest-transport.js` +
`workspace-lifecycle.js`, on `origin/main`). Its five User Manager ops:

| Op | Call | Reads back? |
| --- | --- | --- |
| `createSubworkspace` | `POST /v2/workspaces/{parent}/child` `{ title, resources }` | yes — via status + family |
| `getWorkspaceStatus` | `GET /v1/workspaces/{id}/status` | **polls** until `created` |
| `listWorkspaceFamily` | `GET /v1/workspaces/{parent}/family` | yes — adopt-by-title + linked-child guard |
| `transferWorkspaceResources` | `POST /v2/workspaces/{id}/resources/transfer` `{ resources: { ai } }` | indirectly (status) |
| `deleteWorkspace` | `DELETE /v1/workspaces/{id}` | reads after → 403 (cleanup-only, fail-closed) |

## Confirmed stateful set

**One resource group: `workspaces`** (a global tree, keyed by id, children linked via `parent_id`).
`createSubworkspace` writes a child → `getWorkspaceStatus` / `listWorkspaceFamily` read it →
`deleteWorkspace` removes it and cascades over its descendants. Two ride-along collections back the
deterministic controls: `workspace_pool` (parent allocations, for the 422) and `workspace_status`
(the `not ready` budget). `transferWorkspaceResources` mutates only the pool (the allocation is not
echoed onto the workspace — see the replay), so the workspace entity stays a faithful
`workspaceResponse`.

## How it plugs in

`mock/stateful.js` encodes the tree ops as pure functions over `mock/store.js`; the Counterfact
route handlers adapt them into spec-valid envelopes. `family` is a transitive descendant walk (with
a cycle guard); `delete` is a transitive cascade. The pure layer is unit-tested at 100%.

## Live-fidelity validation (replayed 2026-06-26)

Every op was replayed against the **real** gateway (`adobe-hackathon.semrush.com`,
`/enterprise/users/api` — the client's documented base URL) under a funded test parent
workspace (a real provisioned workspace id, kept in the team's `local/` handover notes, not
committed to this public repo) — one throwaway child, `trap`-cleaned, parent `family` asserted
byte-identical before/after (residue = 0). What it pinned:

- **`status` is a single object** `{ "status": "created" }`, **not** an array → validates overlay
  **CR2** (and the consumer's `status.status === 'created'` read).
- **`family` is a top-level array** of `workspaceResponse` (the parent + its descendants) — no
  `{ items }` envelope.
- **401 body is `{ "detail": "Not authenticated" }`** (the Adobe gateway shape, not the spec's
  `{ message, errors }`) → validates `mock/auth.js`.
- **unknown / deleted workspace → `403 { "message": "invalid access attempt" }`** (both the
  just-deleted id and a never-existed id) → the mock returns exactly this on a missing workspace.
- **`deleteWorkspace` → `200 { "id" }`** on a settled workspace.
- **error envelope is `{ message }`** → validates the 422/403 body shape.
- **`resources/transfer` returns the updated `workspaceResponse`, not `WorkspaceResourcesV2`** →
  drove the api-service re-grant flow with a small allocation and captured the live response: it is
  the child workspace (`{ id, title, status, parent_id, … }`), not the spec's
  `{ general, product_resources, seo }`. Fixed by overlay **CR4** + the transfer handler now returns
  the stored workspace. The consumer never reads this body, so it is fidelity-only.

This was confirmed end-to-end by driving spacecat-api-service's **real** consumer logic
(`createSerenityTransport` + `ensureSubworkspace` + `decommissionBrandWorkspace`) against both the
mock (behind a local HTTPS proxy — the transport requires `https`) and live Semrush: the full
activate → re-activate (re-grant) → deactivate lifecycle behaves identically against both, with
unit-level net-zero on the parent pool (`…/resources` `ai.prompts`/`projects` byte-identical
before/after).

**Re-replay 2026-06-29 (spacecat-shared#1745 sweep)** — three refinements to the above, all live
observations the deterministic mock intentionally collapses:

- **`POST .../child` → HTTP 200** returning the child with **`status: "not ready"`**, settling to
  `created` in ~3 s (the mock returns `created` at once; reproduce the window via the `__status`
  budget — see "Known fidelity simplifications").
- **Delete is eventually consistent with a transient `deleting` window.** `DELETE .../{id}` →
  `200 { id }`; immediately after, `GET .../status` → **`200 { "status": "deleting" }`** (a status
  value outside the documented `not ready | created | error` enum) and the child is **still in
  `family`**; within ~5 s it settles to the `403 { "message": "invalid access attempt" }` the mock
  returns at once. The transient `deleting`/200 window is unmodelled (the mock jumps straight to the
  settled `403`).
- **Live child envelope is richer than the factory** (confirms "Lean workspace envelope" below):
  live also returns `icon`, `created_at`, `last_updated_at`, `keywords_count`,
  `published_projects_count`, `pagespeed_urls_count`, `is_admin`, `users`, `is_master`,
  `subscription_tier`, `products`, `product_tiers`, `parent`, `partnership_enabled` — and notably
  does **NOT** return `role` (see the `role`-drift note below).

## Known fidelity simplifications

- **Child boots `created` immediately.** Live `createSubworkspace` returns the child as **`not
  ready`**, and it settles to `created` only after tens of seconds (the async the consumer polls).
  The mock is a deterministic test double, so a new child is `created` at once. The `not ready`
  window is reproduced **on demand** via the `POST /__status` control / a seed `pendingStatusReads`
  budget, which `getWorkspaceStatus` burns down — exercising the consumer's poll loop without a wall
  clock. The consumer reads only `.id` from the create body, so the immediate `created` is
  non-blocking.
- **No `not ready` lock on transfer/delete.** Live, a transfer/delete that **races a still-settling
  child** returns `422 { "message": "workspace not ready" }`, and `delete` is eventually-consistent
  (the `family` listing lags the `200` ack). The consumer guards against this by polling `status` to
  `created` *before* every transfer/delete, so against the deterministic mock (workspaces are
  `created`) those ops simply succeed. Modelling the lock would mean 422-ing transfer/delete while a
  status budget is pending — deferred until an api-service cross-repo e2e drives it (see below).
- **Lean workspace envelope.** Live `workspaceResponse` carries more fields than the factory
  populates (`icon`, `is_master`, `subscription_tier`, `product_tiers`, `parent`, counts). The
  consumer reads only `id` / `title` / `status` (required via overlay CR3), so the factory is a
  faithful-shape stand-in; all extra fields are optional in the schema.
- **`role` is a mock-only field (live drift).** `createWorkspaceMock` populates `role: 'owner'`, but
  the live child envelope does **not** carry `role` at all (confirmed 2026-06-29). It is a valid
  optional schema field and the consumer never reads it, so this is harmless fidelity drift — left
  as-is rather than risking a fixture/overlay change for a field nothing depends on.
- **Pool-exhaustion 422 message — now live-pinned.** The over-allocation 422 string was triggered
  live on 2026-06-29 and is **`{ message: "insufficient available units in subscription" }`** — the
  mock (`child.js` / `transfer.js`) now returns exactly this (previously the inferred
  `"insufficient available units"`). The other live 422 variant, `{ message: "workspace not ready" }`
  (transfer/delete racing a still-settling child), remains unmodelled — see the lock bullet above.
- **No tenant / ownership model; presence-only bearer.** `GET status` and `GET family` 403 an
  **unknown** workspace id (the mock has no descendants for it), but the mock otherwise serves any id
  it does know without an ownership check, and the bearer gate is **presence-only** — a garbage
  `Bearer xxx` passes (live `401`s it). Deliberate: the consumer always uses a real IMS token on
  workspaces it owns. (`GET family` on an unknown id was aligned to `status`'s 403 on 2026-06-29 —
  it previously returned `200 []`.)
- **`resources` is treated as required on child create; live tolerates its absence.** The mock reads
  `body.resources.ai` to meter the draw, so an omitted `resources` allocates nothing; live (2026-06-29)
  **200**s a child create with no `resources`, creating the child on the default tier. The consumer
  always sends `resources`, so this is fidelity-only.
- **Stuck-`not ready` zombies are not modelled.** Live, a child created against an exhausted/contended
  parent pool can stay `not ready` for hours and is **un-deletable** (`DELETE` → `422 { "workspace
  not ready" }`); the finite parent pool means rapid raw child-creates can strand zombie workspaces.
  Serenity avoids this by sizing the allocation to the market count and polling `status`→`created`
  before any transfer/delete. The mock's immediate-`created` hides this entirely (by design). (2026-06-29)

## Replicating live async behaviour (don't use timers)

Keep the mock immediately-consistent. Reproduce the async *scenarios* deterministically via
seed/control state, never a wall clock:

- **`not ready → created` settle** — already supported: seed `pendingStatusReads` or
  `POST /__status { workspaceId, pending }`, then poll `GET …/status`.
- **transfer/delete "workspace not ready" 422** (optional) — add a control that 422s those ops while
  a workspace's status budget is pending. Defer it until the api-service e2e that drives it lands
  (different repo, independent), matching the project-engine mock's async-replication decision.
