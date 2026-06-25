# Project Engine mock — statefulness (LLMO-5460)

## The question (from the spike)
*How much true CRUD statefulness do the E2E flows need vs. scenario-based static responses?*

Counterfact gives every operation a schema-valid response for free. State (a POST a later GET
reads back) is the hand-maintained part, so we make **only** the resources that actually need
it stateful and let everything else fall back to the generated schema response.

## Decision rule
A resource needs the in-memory store **iff a flow writes it and then reads / depends on that
write within the same logical flow.** Everything else stays on the auto-generated response.

## Confirmed consumer inventory (the AC floor)
Grepped both consumers (2026-06). **`spacecat-api-service` is the only Project Engine consumer
today; `llmo-data-retrieval-service` makes zero Project Engine calls.** The distinct operations
api-service calls (`src/support/serenity/handlers/*`):

| Operation | Resource group | Write-then-read | Class |
| --- | --- | --- | --- |
| `POST /v1/workspaces/{id}/projects` | projects | yes | **stateful** |
| `DELETE /v1/workspaces/{id}/projects/{id}` | projects | yes | **stateful** |
| `POST /v1/workspaces/{id}/projects/{id}/publish` | publish (action) | — | passthrough |
| `GET  /v1/workspaces/{id}/projects/{id}/ai_models` | ai_models | yes | **stateful** |
| `POST /v2/workspaces/{id}/projects/{id}/ai_models` | ai_models | yes | **stateful** (the consumer's `addAiModel` path — list/delete have no v2 variant) |
| `DELETE /v1/workspaces/{id}/projects/{id}/ai_models` | ai_models | yes | **stateful** |
| `GET  /v1/ai_models` | ai_models (catalog) | no | static |
| `GET  /v1/languages` | languages | no | static |
| `POST /v2/workspaces/{id}/projects/{id}/aio/prompts/by_tags` | prompts | no (read) | **stateful** (list) |
| `POST /v2/workspaces/{id}/projects/{id}/aio/prompts/tagged` | prompts | yes | **stateful** |
| `DELETE /v2/workspaces/{id}/projects/{id}/aio/prompts` | prompts | yes | **stateful** |

## Confirmed stateful set
**projects, ai_models (per project), prompts (aio, per project).** This matches the recommended
first cut. The `publish` action and the `GET /v1/ai_models` / `GET /v1/languages` reference
lookups stay on Counterfact's auto-generated response. The store is generic, so growing the
stateful set later is cheap and needs no rework.

## How it plugs in
- `mock/store.js` — generic `InMemoryStore` (collection-keyed CRUD + seed/reset, deep-clone
  on every read/write).
- `mock/stateful.js` — pure operation functions mapping the stateful operations above onto
  the store (collections scoped per workspace/project). Unit-tested without a running server.
- Seed sets are `Snapshot`s loaded via `store.load(...)`; `store.reset()` restores the last seed
  and is exposed to out-of-process E2E as a test-only `POST /__reset`.
- The Counterfact runner wires these into per-path handlers (`$.context` carries the store);
  non-stateful operations are left untouched.

## Known fidelity simplifications
- **Child-resource writes do not validate the parent project exists.** `POST .../ai_models`,
  `.../aio/prompts/tagged`, `.../benchmarks`, `.../brand_urls`, and `publish` write to (or meter)
  their collection without first asserting the `{project_id}` is a live project, so they succeed
  (201/202) against a project the real API would 404. This is deliberate: quota is metered at
  **workspace** granularity (a child write is gated by the workspace allocation, not by a project
  row), and the consumer never adds resources to a project it believes deleted. The quota E2E
  relies on it — those cases provision an allocation and write prompts/publish under freshly
  minted, never-created project ids to exercise metering in isolation. If a future consumer flow
  needs unknown-project 404s, add a shared `requireProject(scope)` guard to the child writers and
  seed the parent projects the quota cases use.
