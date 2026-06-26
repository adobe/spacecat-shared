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
`/enterprise/users/api`) under the funded prod parent **LLMO-Dev-2**
(`bb0f4e1c-8bb1-402e-88f2-f68618ea7397`) — one throwaway child, `trap`-cleaned, parent `family`
asserted byte-identical before/after (residue = 0). What it pinned:

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
- **Pool-exhaustion 422 message is inferred.** The 422 envelope (`{ message }`) is live-pinned, but
  the exact "insufficient available units" string was not triggered live (it would require
  over-drawing a real pool); only the "workspace not ready" 422 variant was observed. The status
  (422) is the contract the consumer keys off.

## Replicating live async behaviour (don't use timers)

Keep the mock immediately-consistent. Reproduce the async *scenarios* deterministically via
seed/control state, never a wall clock:

- **`not ready → created` settle** — already supported: seed `pendingStatusReads` or
  `POST /__status { workspaceId, pending }`, then poll `GET …/status`.
- **transfer/delete "workspace not ready" 422** (optional) — add a control that 422s those ops while
  a workspace's status budget is pending. Defer it until the api-service e2e that drives it lands
  (different repo, independent), matching the project-engine mock's async-replication decision.
