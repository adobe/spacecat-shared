# Mock ↔ live Project Engine parity audit

Live verification of the Counterfact mock against the **real** Semrush Project Engine
API (`https://adobe-hackathon.semrush.com/enterprise/projects/api`, the Vault
`SEMRUSH_PROJECTS_BASE_URL` for `dx_mysticat/prod/api-service`). Auth is a prod IMS
user bearer token (`mysticat auth token --ims --env prod`), sent as
`Authorization: Bearer <IMS>` directly (no gateway exchange).

- **Date:** 2026-06-25
- **Workspace under test:** `c522f571-76e9-42e5-9213-7a767f448453` (10 projects: 3 live
  Adobe market projects + draft junk).
- **Method:** every endpoint the serenity transport calls was invoked live; reads hit an
  existing live project, writes used throwaway projects that were deleted afterwards
  (all `DELETE` returned `204`; net-zero — no residue left in the workspace).
- **Recordings:** request/response captured per call (kept out of the repo — they contain
  real customer prompt/topic text; the e2e suite asserts *shapes*, never live content).

## 1. Endpoint inventory (the consumer surface)

Every Project Engine call is funneled through the single chokepoint
`spacecat-api-service` `src/support/serenity/rest-transport.js` (PR
adobe/spacecat-api-service#2643). 25 operations, all present in the vendored spec.

**Critical finding (now fixed):** the mock runs Counterfact in serve-only mode (`--serve`, no
`generate`) — it does NOT auto-stub spec paths (`generate` would append duplicate handlers onto
ours). So before this change only the 11 custom-handled endpoints were served; the other **14
returned 404** ("Could not find a method matching …"), NOT a schema stub. This change adds explicit
handlers for all 14, so every endpoint below now responds with a live-matching shape.

| # | Transport method | HTTP | Path | Handler |
|---|---|---|---|---|
| 1 | listPromptsByTags | POST | /v2/…/aio/prompts/by_tags | stateful |
| 2 | createTaggedPrompts | POST | /v2/…/aio/prompts/tagged | stateful |
| 3 | deletePromptsByIds | DELETE | /v2/…/aio/prompts | stateful |
| 4 | publishProject | POST | /v1/…/projects/{pid}/publish | echo (new) |
| 5 | listAiModels | GET | /v1/…/projects/{pid}/ai_models | stateful |
| 6 | getBrandTopics | GET | /v1/workspaces/{id}/brand-topics | catalog (new) |
| 7 | createProjectTags | POST | /v2/…/aio/tags | echo (new) |
| 8 | createProject | POST | /v1/workspaces/{id}/projects | stateful |
| 9 | deleteProject | DELETE | /v1/…/projects/{pid} | stateful |
| 10 | updateProject | PATCH | /v1/…/projects/{pid} | stateful |
| 11 | addAiModel | POST | /v2/…/projects/{pid}/ai_models | stateful |
| 12 | deleteAiModelsByIds | DELETE | /v1/…/projects/{pid}/ai_models | stateful |
| 13 | listGlobalAiModels | GET | /v1/ai_models | catalog (new) |
| 14 | listLanguages | GET | /v1/languages | catalog (new) |
| 15 | listProjects | GET | /v1/workspaces/{id}/projects | stateful |
| 16 | getProject | GET | /v1/…/projects/{pid} | stateful |
| 17 | updateCiCompetitors | PUT | /v1/…/ci/competitors | echo (new) |
| 18 | getInitStatus | GET | /v2/…/aio/init_status (was /v1 — see A1) | echo (new) |
| 19 | listBenchmarks | GET | /v1/…/ai_models/benchmarks | stateful (new) |
| 20 | createBenchmarks | POST | /v2/…/ai_models/benchmarks | stateful (new) |
| 21 | deleteBenchmarks | DELETE | /v1/…/ai_models/benchmarks | stateful (new) |
| 22 | updateBenchmark | PUT | /v1/…/benchmarks/{bid} | stateful (new) |
| 23 | listBrandUrls | GET | /v2/…/benchmarks/{bid}/brand_urls | stateful (new) |
| 24 | createBrandUrls | POST | /v2/…/benchmarks/{bid}/brand_urls | stateful (new) |
| 25 | deleteBrandUrls | DELETE | /v2/…/benchmarks/{bid}/brand_urls | stateful (new) |

## 2. Live response shapes (verified)

- **listLanguages** `200` → `{ page, total, items: [{ id, name }] }` — items carry **no**
  `key`/`icon` (that's the global-models shape, not languages). Matches `LanguageResponse`.
- **listGlobalAiModels** `200` → `{ page, total, items: [{ id, name, key, icon }] }`. Matches.
- **listProjects / getProject** `200` → `ProjectResponse` with a rich nested
  `settings.ai` (`models_stats.models[]`, `language{id,name}`, `country{code,name}`,
  `location{id,name}`, `brand_names[]`, `brand_name_display`, `primary_url`, counts) plus
  top-level `live_id`, `draft_id`, `is_draft`, `publish_status`, `published_at`,
  `updated_at`, `role`, `shared_with`.
- **listAiModels** (project) `200` → `{ page, total, items: [{ id, prompts_count, model:{ id, name, key, icon } }] }`.
- **addAiModel** (v2) `201` → `{ id, prompts_count, model:{ id, name, key, icon } }`.
- **listBenchmarks** `200` → `{ aio_benchmarks: [{ id, project_id, domain, primary_url,
  root_domain, color, favorite, main_brand, brand_name, brand_aliases,
  rejected_brand_aliases, products_count }] }`.
- **createBenchmarks** (v2) `200` → `{ ids: [uuid], existing_count }`.
- **listBrandUrls** `200` → `{ brand_urls: [BrandURL] }` (empty on the probed benchmark).
- **listPromptsByTags** `200` → `{ total, unassigned, page, items: [{ id, name, tags:[{ id,
  name, children_count, prompts_count }] }] }`.
- **createProjectTags** `201` → **top-level array** `[{ id, name, children_count, keyword_count }]`.
- **getBrandTopics** `200` → **top-level array** `[{ topic, volume, prompts:[string] }]`.
- **createProject** `201` / **updateProject** `200` → `ProjectResponse`.
- **updateCiCompetitors** `200` → `{ ci_competitors: [{ id, project_id, domain, color }] }`
  (it DID persist a row on an AIO project — see drift note below).
- **deleteProject** `204` (empty).

## 3. Drifts found (spec/overlay/mock vs live)

| ID | Endpoint | Live | Spec / mock | Action |
|----|----------|------|-------------|--------|
| D1 | createProjectTags (7) | top-level **array** of TreeNodeResponse | `aio-create-project-tags` 201 typed as a **single** `TreeNodeResponse` → Counterfact mock returns an object | **Fixed** — overlay CR6 makes the 201 an array. |
| D2 | addAiModel v2 (11) | **201** | spec declares **200**; mock handler returned 200 | **Fixed** — overlay CR7 + mock handler now 201. |
| D3 | listPromptsByTags items (1) | `is_new` **absent** (likely omit-when-false) | CR5 marked `is_new` **required** on `AIOPromptWithStatus` | **Fixed** — CR5 relaxed to `[id, name, tags]`; `is_new` stays optional. |
| D4 | listBenchmarks items (19) | extra `primary_url`, `root_domain` | `AIOBenchmarkWithCounters` omits both | Documented; consumer reads only `id/domain/main_brand/brand_aliases`, so harmless. Add if a benchmark consumer needs them. |
| D5 | benchmarks (19-22) + brand_urls (23-25) | **stateful** (create→list reflects, ids feed brand_urls) | endpoints were unmocked (404) | **Fixed** — added as stateful resource groups (`benchmarks` per project, `brand_urls` per benchmark) with custom handlers; create→list→update→delete now reflect, so the consumer's benchmark + brand-URL sync flows are end-to-end testable. |
| D6 | listProjects/getProject (15,16) | projects carry full `settings.ai` (geo/lang/country/brand_names) | mock project entities are `{ id, name }` only | Recommended follow-up — enrich the project factory/seed with a realistic `settings.ai` so the subworkspace read flow (listMarkets/resolveProject) resolves mock projects to markets. (Out of scope here; the project create/read spine is faithful, only the nested settings are thin.) |

## 4. Live anomalies — investigated and resolved

Each `405`/`404` was traced to root cause. The diagnostic that separates "edge/proxy reject"
from "app reject" is the `x-request-id` header: the app adds it to every response (incl. its own
`400`/`404`), so a `405` *without* `x-request-id` (and `content-type: text/html`) was generated
by the edge proxy (`via: 1.1 google`) before reaching the app.

- **A1 — getInitStatus → RESOLVED (path bug, fixed here).** The vendored swagger declares
  `GET /v1/…/aio/init_status`, but that path 404s; the live route is **`/v2/…/aio/init_status`**
  (`OPTIONS /v2` → `allow: GET`; `GET /v2` → `200 {"initialized":true}`). Fixed: overlay **CR8**
  relocates the path v1→v2; the mock handler moved to `/v2`. **Consumer action:** the transport's
  `getInitStatus` (`rest-transport.js`, PR #2643) must call `/v2`, not `/v1`.

- **A2 — createTaggedPrompts → the disguised QUOTA 405 (expected; not a bug).** `POST
  /v2/…/aio/prompts/tagged` returned **405 text/html, no `x-request-id`** on the test workspace
  `c522f571…`. This is NOT an nginx bug — it is the **out-of-units / quota rejection** the serenity
  code already documents and handles. A prompt write is a *metered* op; a sub-workspace with no
  allocated AI units returns a 405 "disguised quota rejection" (`workspace-lifecycle.js`:
  "anything metered (prompt writes, live publish) 405s as a disguised quota rejection";
  `brand-provisioning.js`: surfaces it as "Quota exceeded"). The test workspace / bare throwaway
  projects had **no allocation**, so every prompt write 405d. It is enforced at Semrush's edge
  metering layer — which is why the 405 lacks the app's `x-request-id` and is content-type
  sensitive (a `multipart` POST slipped past metering and reached the app, which then JSON-parse-
  failed the multipart framing). **No escalation; consumer + mock are correct.** The mock now
  MODELS this (see §6): a workspace with an exhausted prompt allocation returns the 405.

- **A3 — publishProject → the same quota 405; path is correct.** `POST /v1/…/projects/{pid}/publish`
  **works (202, with `x-request-id`)** on the content-ful live project, and `/v2` 404s — so the
  transport's `/v1` path is correct. The `405` appears only on **empty-units** projects (a bare
  throwaway with no allocation), even after adding a model + benchmark — because publish is metered
  the same way. The consumer's `republishBestEffort` deliberately swallows exactly this 405. No
  code change to the path; the mock models both the `202` success and the empty-units `405` (§6).

## 5. What the e2e suite asserts

`test/e2e/project-engine-mock.e2e.js` boots the mock (`mock/run.js`) and drives the real
typed client against it (29 cases, incl. the quota metering and bearer-auth cases). Beyond the
original stateful spine (projects / ai_models / prompts CRUD) it now covers:

- the two fixed drifts: `createProjectTags` → top-level array, `addAiModel` → 201;
- the catalog/echo reads: `listLanguages`, `listGlobalAiModels`, `getBrandTopics` (top-level
  array), `updateCiCompetitors`, `publishProject` (202) + `getInitStatus`;
- the new stateful flows: `createBenchmarks` → `listBenchmarks` reflects → `deleteBenchmarks`
  removes; `createBrandUrls` → `listBrandUrls` reflects → `deleteBrandUrls` removes; plus the
  seeded own-brand benchmark + its brand URL.

Shapes only — no live customer content is committed. The seed (`workspace-with-data`) now also
carries an own-brand benchmark and a brand URL so default reads look like production.

## 6. AI-unit quota metering (the disguised 405)

The mock models the metering the live API enforces (see A2/A3): a sub-workspace is granted an
allocation of `{ ai: { projects, prompts } }` units, and the metered ops — **project create,
prompt write, live publish** — return the disguised **405** when the allocation is exhausted.

- **Where allocations come from.** The project-engine API only *enforces* the allocation; it is
  *set* via the user-manager gateway (out of this mock). So the mock *provides* it via seed or the
  `POST /__quota` control route, mirroring the units the harness/user-manager-mock transferred to
  that sub-workspace. `mock/quota.js` holds the limits in a `quota` store collection (so they ride
  along in seed / `__reset` / `__dump`); usage is derived live from the `projects`/`prompts`
  collections, so deleting a project or prompt frees its unit.
- **Default = unlimited.** A workspace with no allocation is unlimited (the dev parent runs with
  limits disabled), so existing flows are unaffected until an allocation is set.
- **Control surface.** `POST /__quota { workspaceId, projects?, prompts? }` sets the allocation
  (`{ projects: 0, prompts: 0 }` = released/empty-units child); `GET /__quota?workspaceId=` reads
  limits + live usage. `buildSeed({ …, quota: { projects, prompts } })` embeds it in a snapshot.
- **Enforcement.** Project create 405s at the `projects` limit; a prompt batch 405s all-or-nothing
  when it would exceed the `prompts` limit; publish 405s for an empty-units (`prompts: 0`)
  workspace — matching the consumer's `republishBestEffort` swallow and the "Quota exceeded"
  surfacing. The e2e suite exercises each.

This is the one part of the audit that surfaced a separate mock-fidelity bug: the `tagged`
handler had its body mapping inverted (it read `{ [tagName]: [texts] }`); the real consumer sends
`{ [promptText]: [tagNames] }` (`prompts.js` `{ [text]: tags }`, `markets-subworkspace`'s
`promptsByText`). Fixed alongside the metering, since the prompt count drives the quota check.

## 7. Bearer auth (verified live 2026-06-25)

The live gateway authenticates every request with the caller's IMS bearer token and rejects a
request **without** a usable credential with `401 { "detail": "Not authenticated" }`. Probed live:

| Request | Live |
| --- | --- |
| no `Authorization` header | `401 { "detail": "Not authenticated" }` |
| `Authorization: Bearer <garbage>` | `401 { "detail": "Not authenticated" }` |
| valid IMS token | `200` |

The mock mirrors this on **every real route** (`mock/auth.js`, injected onto every handler by
`injectAuthGuard` in `mock/run.js`): it requires `Authorization: Bearer <token>` to be **present**
— being a test double, not an IMS verifier, it does not validate the token's contents — and returns
the exact `401 { detail: 'Not authenticated' }` otherwise. The `__*` control routes are exempt
(harness plumbing, not the emulated API). The e2e suite asserts no-token → 401, non-Bearer → 401,
Bearer → 200, and control-route exemption.

Note the consumer side already matches live for the missing-token case independently: api-service's
`rest-transport.js` `buildHeaders` throws `401` before any HTTP when the IMS token is absent.
