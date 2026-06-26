# Project Engine mock — statefulness (LLMO-5460)

## The question (from the spike)
*How much true CRUD statefulness do the E2E flows need vs. scenario-based static responses?*

State (a POST a later GET reads back) is the costly part, so we make **only** the resources that
actually need it stateful and keep everything else as a thin echo/catalog handler.

> **Implementation note.** The spike framed the non-stateful endpoints as "left on Counterfact's
> auto-generated response." That is NOT how it shipped: leaving `generate` on appends a `random()`
> stub onto every materialized handler (duplicate `VERB` declarations → load failure), and a random
> stub returns spec-shaped-but-garbage data — useless for a fidelity mock. So the runner uses
> `--serve` (no `generate`): every non-stateful op is a small hand-authored echo/catalog handler,
> and an **unmodelled path 404s** (no auto-stub fallback). The decision rule below still governs
> which resources get the *store*; it no longer implies anything is auto-generated.

## Decision rule
A resource needs the in-memory store **iff a flow writes it and then reads / depends on that
write within the same logical flow.** Everything else is a thin echo/catalog handler.

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
| `POST /v2/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** (competitor-benchmark create) |
| `GET  /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** (list) |
| `PUT  /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks/{id}` | benchmarks | yes | **stateful** (in-place `updateBenchmark`) |
| `DELETE /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** |
| `POST /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** (per benchmark) |
| `GET  /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** (list) |
| `DELETE /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** |

## Confirmed stateful set
**projects (per workspace), ai_models / prompts / benchmarks (per project), brand_urls (per
benchmark).** These five are `STATEFUL_RESOURCES` in `mock/stateful.js`. This matches the
recommended first cut plus the competitor-benchmark + brand-URL sync the consumer drives
(`spacecat-api-service` `syncCompetitorBenchmarksAcrossMarkets` / `syncBrandUrlsAcrossMarkets` /
`attachBrandUrlsToProject` — each write-then-reads, so by the decision rule above they belong in
the set). The `publish` action and the `GET /v1/ai_models` / `GET /v1/languages` reference lookups
are thin hand-authored echo/catalog handlers (no store, no auto-stub). The store is generic, so
growing the stateful set
later is cheap and needs no rework — benchmarks + brand_urls were added as ops with no store
change, the live proof.

## How it plugs in
- `mock/store.js` — generic `InMemoryStore` (collection-keyed CRUD + seed/reset, deep-clone
  on every read/write).
- `mock/stateful.js` — pure operation functions mapping the stateful operations above onto
  the store (collections scoped per workspace/project). Unit-tested without a running server.
- Seed sets are `Snapshot`s loaded via `store.load(...)`; `store.reset()` restores the last seed
  and is exposed to out-of-process E2E as a test-only `POST /__reset`.
- The Counterfact runner wires these into per-path handlers (`$.context` carries the store);
  non-stateful operations are thin hand-authored echo/catalog handlers (no auto-stub fallback —
  the runner serves with `--serve`, no `generate`).

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
- **`listBrandUrls` always returns `200 { brand_urls }`; live can `404`.** Live (verified
  2026-06-25) `GET …/aio/benchmarks/{bid}/brand_urls` returns `404 { message: "not found" }` when
  `{bid}` is not the project's listable (auto-created main-brand) benchmark — even though a `POST`
  of brand URLs onto that same competitor `{bid}` succeeds. The mock returns `200 { brand_urls }`
  for any benchmark id. The consumer (`ensureOwnBrandBenchmark`) lists brand URLs on whatever
  benchmark it resolves — usually the settled **main-brand** one (`200`), but when that benchmark
  is absent it *creates its own* competitor benchmark and lists on **that**, which live `404`s until
  processed. The consumer's per-market `try/catch` (brand-urls.js) catches the `404` and skips that
  market with a warning. So the mock's always-`200` exercises the happy path but NOT the consumer's
  skip-on-`404` degraded branch. (Live, a project's main-brand benchmark is generated
  **asynchronously** — it did not appear within ~60s of create, even after a publish — and a freshly
  created competitor benchmark's `brand_urls` GET `404`s until processed.) The mock keeps writes
  immediately readable on purpose (deterministic test double); to exercise the consumer's
  absent-benchmark / `404`-skip branches, model them **deterministically via seed/control state**,
  never via time-based delays — see "Replicating live async behaviour" below.
- **Create ops report `existing_count: 0` unconditionally.** `POST .../aio/prompts/tagged` and
  `POST .../ai_models/benchmarks` always return `existing_count: 0` — the mock models no dedup
  against already-present rows, so the consumer's "some already present" branch
  (`existing_count > 0`) cannot be exercised against this mock. Deliberate: the confirmed consumer
  flows create into freshly scoped collections, and dedup fidelity adds store complexity no flow
  reads. Add a name/domain-keyed existing-count if a future flow depends on it.

## Replicating live async behaviour (don't use timers)

Live Semrush is **eventually consistent**: a just-created prompt/brand-URL isn't listed yet, and a
project's main-brand benchmark is generated asynchronously (it didn't appear within ~60s of create,
even after a publish — verified 2026-06-25). The mock is deliberately **immediately consistent**.

**Do NOT make the mock time-based** (delays, "appears after N seconds / N reads"). A test double's
value is determinism; introducing wall-clock async makes consumer tests flaky and slow, and the
consumer's own flows don't poll these resources on a timer.

Instead, replicate the **observable scenarios** the async behaviour produces, **deterministically
via seed / control state** — the consumer has resilient branches that the always-consistent mock
never exercises:

- **Absent main-brand benchmark** → seed a project with no `main_brand` benchmark. This drives the
  consumer's `ensureOwnBrandBenchmark` *create-its-own-then-relist* fallback. Already expressible
  with today's seeds; no mock change needed — just a scenario in the consumer's cross-repo e2e.
- **`listBrandUrls` `404` on an unprocessed benchmark** → the mock always returns `200
  { brand_urls: [] }`, so the consumer's per-market *catch-the-404-and-skip* branch
  (brand-urls.js) is never tested. To exercise it, add an **opt-in** control: a benchmark flagged
  (via `__seed` / a `pending` field) whose `brand_urls` GET returns `404` until "settled". Opt-in
  so the default happy path stays green.
- **`existing_count > 0`** (dedup) and the **`409` duplicate-benchmark** re-list path are the same
  shape: deterministic control state, not timing — add them only when a consumer test needs them.

Rule of thumb: model the **state** that makes the consumer take its degraded branch, never the
**clock**. These scenarios belong in the consumer's (api-service) e2e, with the mock as the double;
the mock only needs to be *able* to present the state.
