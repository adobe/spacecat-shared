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
| `POST /v2/workspaces/{id}/projects/{id}/aio/prompts/tagged` | prompts, tags | yes | **stateful** (a tag name absent from the root level mints a root tag) |
| `DELETE /v2/workspaces/{id}/projects/{id}/aio/prompts` | prompts | yes | **stateful** |
| `POST /v2/workspaces/{id}/projects/{id}/aio/tags` | tags | yes | **stateful** (project-tag create, idempotent by name) |
| `GET  /v2/workspaces/{id}/projects/{id}/aio/tags` | tags | yes | **stateful** (list — surfaces 0-prompt categories) |
| `DELETE /v2/workspaces/{id}/projects/{id}/aio/tags` | tags | yes | **stateful** (project-tag remove; prompts untouched) |
| `POST /v2/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** (competitor-benchmark create) |
| `GET  /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** (list) |
| `PUT  /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks/{id}` | benchmarks | yes | **stateful** (in-place `updateBenchmark`) |
| `DELETE /v1/workspaces/{id}/projects/{id}/ai_models/benchmarks` | benchmarks | yes | **stateful** |
| `POST /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** (per benchmark) |
| `GET  /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** (list) |
| `DELETE /v2/workspaces/{id}/projects/{id}/aio/benchmarks/{id}/brand_urls` | brand_urls | yes | **stateful** |

## Confirmed stateful set
**projects (per workspace), ai_models / prompts / benchmarks / tags (per project), brand_urls (per
benchmark).** These six are `STATEFUL_RESOURCES` in `mock/stateful.js`. This matches the
recommended first cut plus the competitor-benchmark + brand-URL sync the consumer drives
(`spacecat-api-service` `syncCompetitorBenchmarksAcrossMarkets` / `syncBrandUrlsAcrossMarkets` /
`attachBrandUrlsToProject` — each write-then-reads, so by the decision rule above they belong in
the set). `tags` joined the set for the Categories surface: the consumer registers standalone tags
per market project — a bare-named category under the `category` dimension root (one
`createProjectTags` per market — a category spans N projects, so the collection is scoped per
project, never global) — and must read them back via `GET /aio/tags` even before any prompt carries
them. The `publish` action and the `GET /v1/ai_models`
/ `GET /v1/languages` reference lookups are thin hand-authored echo/catalog handlers (no store, no
auto-stub). The store is generic, so growing the stateful set later is cheap and needs no rework —
benchmarks + brand_urls + tags were added as ops with no store change, the live proof.

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
  seed the parent projects the quota cases use. (Live evidence, 2026-06-29: GET / DELETE / publish /
  add-prompt / by_tags / list-ai_models on a non-existent `project_id` all `404 { message: "not
  found" }`. The mock now mirrors this for **DELETE project** — see the read-view section — but child
  writes still succeed against a bogus project id, on purpose.)
- **No tenant / ownership model.** PE `GET projects` returns `200 { items: [] }` for *any* workspace
  id; live `403 { invalid access attempt }`s an unknown/unowned workspace (and `200 { items: [] }`
  only for an owned-but-empty one) — the mock has no notion of ownership. Likewise the **bearer gate
  is presence-only**: a garbage `Bearer xxx` passes (live `401`s it). Both are deliberate — the
  consumer always operates on workspaces it owns, with a real IMS token. (verified 2026-06-29)
- **Two live error layers collapsed into one.** Live has a gateway/auth layer (`application/json`,
  `{detail}`/`{message}`) and a PE app/handler layer (**`text/plain`**, Go-validator/handler bodies:
  `400` field-validation, `404 {message:"not found"}`, `500 {message:"internal server error"}`,
  `409` conflict). The mock returns every error as `application/json` with a single envelope, and
  does **not** reproduce the unguarded **500s** live throws for a bad input it never validates
  (unknown `language_id`, `type:"seo"`, `GET projects` with no params / `?live=true`). The consumer
  reads status, not error bodies (`mapError` redacts upstream), so this is shape-only. (2026-06-29)
- **Pagination is asymmetric across catalogs.** `GET /v1/languages` ignores `page`/`limit` (always
  all 38, `page:1`) — the mock matches; `GET /v1/ai_models` and `GET projects` *do* paginate live —
  the mock does not honor `page`/`limit` on those (returns the full list). No consumer paginates
  these, so it is unmodelled rather than wrong. (2026-06-29)
- **`brand-topics` `prompts` is empty in the mock.** Live `GET brand-topics` returns each topic with
  a large multilingual keyword array under `prompts`; the mock's two static topics carry
  `prompts: []`, so serenity's volume-ranked `generateAndAttachPrompts` (which reads per-topic
  `prompts`) gets nothing from the mock — a fidelity gap for the prompt-generation flow only. Seed
  richer topics if a cross-repo e2e drives that path. (2026-06-29)
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
- **Create ops now model live dedup/conflict (#1745).** `POST .../aio/prompts/tagged` dedups by
  prompt **text** — a text already present is not re-created, it is counted in `existing_count` and
  gets no new id (live, 2026-06-29). `POST .../ai_models/benchmarks` instead treats a duplicate
  brand name / alias / domain as a **hard `409`** `{ message: "ai benchmark conflict: duplicate
  brand name or alias" }` (benchmarks and prompts dedup *differently* live) and creates nothing for
  the batch — including two conflicting entries **within the same batch**, not just against
  already-stored rows. Not modelled: **slice-uniqueness** (two US/en projects both succeed with distinct ids —
  PE does not enforce it; that invariant lives only in serenity's `findBySlice`/DB), matching live.

## Project read-view fidelity (#1745, live-pinned 2026-06-29)

The created/published project read-view is reconstructed by the consumer into an addressable
**market** (`spacecat-api-service` `subworkspace-projects.js`), so its `settings.ai` shape is
load-bearing. Two fields are resolved by the mock to match live, and the publish action mutates the
stored project:

- **`settings.ai.language.name` = the ISO code, NOT the English display name.** Live returns the
  ISO code (`"en"`) here on both the create response and every read-view, while `language.id` is the
  catalog UUID sent on create (the SAME UUID `GET /v1/languages` returns under the English display
  name `"English"` — only `name` differs between the two views). The consumer's `langOf` reads
  `settings.ai.language.name` directly and lowercases it as the slice code, so the create factory
  resolves `language_id` → ISO via the shared **`mock/language-catalog.js`** (`isoForLanguageId`),
  which carries an `iso` column alongside the live `id`/`name`. Only `en` is live-verified; the
  other ISO codes are standard ISO 639-1, best-effort so any market a downstream e2e exercises
  round-trips. (`GET /v1/languages` still serves just `{ id, name }` — the `iso` column is
  mock-internal.)
- **`settings.ai.country.name`** is populated from the country code via `Intl.DisplayNames` (region).
  **Documented divergence:** live returns the short informal name (`"USA"` for `us`); Intl returns
  `"United States"`. Accepted because **no consumer reads `country.name`** — `geoOf` resolves geo
  from `country.code` → `resolveLocation` — so it is fidelity-only, and a hand-maintained
  code→informal-name catalog would be unread maintenance. `location.id`/`name` are echoed from the
  request verbatim (matches live for the consumer-driven create path).
- **Publish moves the stored read-view to live.** `POST .../publish` flips the stored project's
  `publish_status` `draft` → `live` and stamps `published_at`, so a later `GET`/list reports the
  published status (the slice's `mapPublishStatus(publish_status)` reads `live`). **`is_draft` is
  left as-is** — live keeps `is_draft: true` after publish (only `publish_status`/`published_at`
  change; live's full quirk is `true` on create → `false` on GET-as-draft → `true` post-publish),
  and the consumer ignores `is_draft` entirely. The publish update is a no-op for an unknown project
  id, so the metering cases (which publish under never-created ids) are unaffected.

## Endpoint status-code quirks the mock does NOT reproduce (live errors; mock is permissive)

Live returns errors for several call *shapes* the consumer never sends; the mock answers normally.
None affects the consumer, but they are documented so a future caller doesn't assume mock parity
(live captured 2026-06-29):

| call | live | mock | why it's safe |
| --- | --- | --- | --- |
| `GET /v1/.../projects` (no params) | **500** | 200 | the consumer always sends `?type=ai` |
| `GET /v1/.../projects?live=true` | **500** | 200 | the consumer never sends `live=` |
| `GET .../aio/prompts` | **405** | (DELETE only) | reads go via `by_tags` (POST) |
| `GET .../aio/prompts/tagged` | **405** | (POST only) | create is POST |
| `GET .../ci/competitors` | **405** | (PUT only) | update is PUT |
| `POST .../publish` | 202, `content-length: 0`, **no `Content-Type`** | 202 + `Content-Type: application/json` | consumer keys off status/`response.ok`; body empty either way (Counterfact limit, see responses.js) |

## Replicating live async behaviour (don't use timers)

Live Semrush is **eventually consistent**: a just-created prompt/brand-URL isn't listed yet, and a
project's main-brand benchmark is generated asynchronously (it didn't appear within ~60s of create,
even after a publish — verified 2026-06-25). A further, distinct case (live-pinned 2026-06-29):
the project **list** (`GET projects?type=ai`) lags a new project by ~4 s, and **prompt reads**
(`POST aio/prompts/by_tags`) are **publish-gated** — a created prompt stays invisible until the
project is published, then appears (this is a published-snapshot read, not lag). The end-to-end
consumer flow closes anyway because `POST /prompts` runs `publishAffected`; a test that lists
prompts *before* that publish would diverge from the immediately-consistent mock. The mock is
deliberately **immediately consistent**.

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
