# Playbook: building a stateful, live-validated mock for a Semrush typed client

This is the **replicable recipe** behind the `spacecat-shared-project-engine-client` Counterfact
mock (PR #1665). It exists so the same thing can be done for the **`user-manager-client`** (the
sub-workspace lifecycle gateway — PRs #1708 + #1685) and any future typed client without
re-deriving the approach. Read alongside [`mock-usage.md`](./mock-usage.md) (how to run/drive it)
and [`mock-statefulness.md`](./mock-statefulness.md) (which resources get state, and why).

---

## 0. The shape of the deliverable

A typed client package has three layers; only the first **ships** (`files: ["src"]`):

| Layer | Path | Ships? | What it is |
| --- | --- | --- | --- |
| Client + types | `src/` | **yes** | `openapi-fetch` client + `src/generated/types.ts` (from the overlayed spec) |
| Mock | `mock/` | no (symlink-only) | stateful Counterfact mock: store, factories, seeds, quota, auth, handlers, runner |
| Spec | `spec/` | no | vendored swagger + `spec/overlays/corrections.yaml` (the only place the spec is corrected) |

The `./mock/*` export is present in `package.json` but the target is **not in the npm tarball**
(`files: ["src"]`) — consumers use the mock only as an in-workspace dev dependency via the symlink.

---

## 1. Spec → types pipeline (do this first)

The vendored swagger is **never hand-edited**. All corrections live as `CRn` actions in
`spec/overlays/corrections.yaml`, applied by `scripts/apply-overlay.mjs`:

```
spec:convert  → swagger2openapi → build/openapi3.json   (gitignored)
spec:overlay  → apply corrections.yaml in place
generate:ts   → openapi-typescript → src/generated/types.ts   (SHIPS)
generate:pydantic → datamodel-codegen → python/…   (tracked, not shipped; needs `uvx`)
generate      → all four
```

Overlay correction patterns we needed (each is a worked example to copy):
- **CR5** — mark always-present response fields `required` so fixtures are enforced.
- **CR6** — replace a scalar `$ref` with an array schema (a list-returning endpoint).
- **CR7** — move a success response from `200` to `201`.
- **CR8** — add a `/v2` path and remove a stale `/v1` one (route moved).
- **CR9 / CR10** — add a property the **live API returns but the vendored swagger omits**
  (`AISettings.primary_url`; benchmark `primary_url`/`root_domain`). This is the pattern you hit
  every time live validation finds an extra field — see §5.

After any overlay change: `npm run generate` (or `spec:convert && spec:overlay && generate:ts`,
plus `uvx --from datamodel-code-generator datamodel-codegen …` for the pydantic models).

---

## 2. Mock architecture (the parts, and the rules)

```
mock/
  store.js            generic InMemoryStore (collection-keyed CRUD, deep-clone on read/write, reset)
  stateful.js         pure ops over the store; STATEFUL_RESOURCES + collectionKey scoping
  factories.js        createXMock(Partial<T>) => T, typed against src/generated/types.ts
  seeds.js            buildSeed + named seeds (empty / with-data), SEED_IDS
  quota.js            AI-unit metering → the disguised-405 the live API returns for over-allocation
  auth.js             bearer guard (401 { detail: 'Not authenticated' }) like the live gateway
  inject-auth-guard.js  prepends the auth guard to every materialized handler (fail-closed assert)
  run.js              materializes routes .js→.ts into .counterfact/, launches `--serve` (no generate)
  context.js          wires store+ops+factories+quota+auth onto Counterfact's per-request `$.context`
  counterfact/routes/**  the handlers (filesystem mirrors the URL; {id} are literal dir names)
```

Non-negotiable rules (they are what keep the mock honest):
- **`// @ts-check` on every hand-authored `mock/`+`src/` `.js`.** The one exception is
  `mock/counterfact/routes/**` (they run against Counterfact's untyped `$`). `npm run test:types`
  (`tsc`) is the gate.
- **Every response entity is built through a factory**, never an inline literal — including the
  handlers (`$.context.factories.createXMock(...)`). The factory is the single tsc-checked source
  of truth for each shape; the type-tests (`test/types/*.type-test.ts`) prove it.
- **Runner serves only modelled handlers** (`--serve`, no `generate`): an unmodelled path **404s**
  (no random stub). Generate mode would append a `random()` stub to every handler (duplicate `VERB`
  declarations) and return garbage — useless for a fidelity mock.
- **Empty-body acks:** a live `202`/`204` with `content-length: 0` must be
  `return { status: 202, body: '' }` — a bare `{ status: 202 }` emits the reason phrase `"Accepted"`
  and breaks `JSON.parse`.
- **Statefulness is opt-in:** a resource gets store state **iff a flow writes it then reads/depends
  on that write**. Everything else is a thin echo/catalog handler. (See `mock-statefulness.md`.)

---

## 3. Coverage + test layout

`.nycrc.json` enforces **100% lines/statements/functions and `branches: 100`** (stricter than the
monorepo's 97%). `mock/counterfact/routes/**` and `mock/run.js` are **coverage-excluded** — they
need a live server, so the **e2e** validates them. Everything else (factories/seeds/store/stateful/
quota/auth/inject-auth-guard/context) hits 100% via unit tests.

| Suite | Command | What it guards |
| --- | --- | --- |
| Unit | `npm test -w <pkg>` | the pure mock layer at 100% incl. branches |
| Types | `npm run test:types -w <pkg>` | `tsc` over `src/`+`mock/`+`test/`; the type-tests prove the public surface + factory shapes |
| E2E | `MOCK_E2E=1 npm run test:e2e -w <pkg>` | boots the mock, drives the **real client** through every endpoint; gated out of `npm test` |

CI: a **standalone, path-gated workflow** (`.github/workflows/<pkg>-e2e.yaml`) runs the type check +
e2e on PRs *and* on push to `main` (the type-surface + live e2e aren't in `main.yaml`). It is
additional signal, never a release gate (no npm auth).

---

## 4. Live fidelity validation — testing the real API via the consumer's calls

This is the step that makes the mock trustworthy: **replay every op the consumer makes against the
real Semrush API and pin the mock to what comes back.** (Commit `4ee03f80` did this for
project-engine; the metered-write gap was later closed against a funded workspace.)

**Source of truth for request shapes:** the consumer's `rest-transport.js` on **`origin/main`** —
NOT a worktree branch. (A 12-commits-behind checkout once mislabeled live endpoints as dead.) Copy
the exact method + path + body per op.

**Targets (resolve each time — never hardcode):**
- Base URL: `vault kv get -field=SEMRUSH_PROJECTS_BASE_URL dx_mysticat/prod/api-service` (same value
  the consumer's transport resolves; or read it from api-service `.env`). It is a **prod** tenant.
- Token: `mysticat auth token --ims` (a real prod-IMS user bearer; after `mysticat login`).
- A **funded** test workspace — metered ops (`createProject`/`createTaggedPrompts`/`publish`) return
  a disguised **`405` = "payment required"** when the workspace has no AI-unit allocation; units come
  from the parent via the user-manager `resources/transfer`. Use a workspace that already has units,
  or transfer some.

**Replay recipe** (one bash script, `trap`-clean the throwaway project):
```bash
TOKEN=$(mysticat auth token --ims); BASE=…/enterprise/projects/api; WS=<funded ws>
# -D dumps response headers so you SEE an empty-body 202 (content-length: 0)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -D /tmp/h -o /tmp/b -w '%{http_code}' --data '<consumer body>' "$BASE/<path>"
```
Capture, per op: **status**, **content-length** (empty vs envelope), **body**. Then reconcile vs the
mock handler/factory:
- status mismatch → fix the handler / overlay CR (e.g. CR7 `200`→`201`).
- empty-body ack → `{ status, body: '' }`.
- a field live returns that the swagger omits → **overlay `CRn` + populate the factory** (CR9/CR10).
- a write that reshapes the request (e.g. flat body nested under `settings.ai`) → a transforming
  factory (`createProjectResponseFromRequest`, `applyProjectUpdate`).

**Safety (every time):**
- Reads are safe; **writes only with explicit user authorization**, on a single throwaway resource,
  with `trap`-based delete-on-exit. It's a **prod** workspace shared by the team — never echo the
  token, confirm 0 residue afterward.
- To verify a **delete** against real pre-existing data, **add your own throwaway row, delete only
  that id, and assert the real set is byte-identical before/after** — never delete real rows.

**Caveats live surfaced (bake these into the test design):**
- **Eventual consistency:** create-then-immediately-read can be empty/`404` (a just-created
  prompt/brand-URL isn't listed yet; a project's main-brand benchmark generates **asynchronously** —
  >60s, even after publish; a fresh benchmark's `brand_urls` GET `404`s until processed). Capture
  *populated* reads against a **settled, pre-existing** resource, not a fresh one.
- **Tenant-specific vs contract:** verify a surprising status against prod (Splunk / a funded
  tenant) before encoding it — don't bake a quirk of one workspace into the mock.

**Don't replicate time-based async in the mock.** Keep it immediately-consistent (determinism is the
point). Model the *scenarios* the async produces (absent benchmark, `404`-until-settled)
**deterministically via seed/control state**, in the consumer's e2e — see `mock-statefulness.md`
§"Replicating live async behaviour".

---

## 5. The exact checklist to repeat for `user-manager-client` (PRs #1708 / #1685)

Same architecture, **different gateway**: `user-manager-client` is the `/enterprise/users/api`
sub-workspace **lifecycle** gateway (NOT project-engine). Known consumer ops (from api-service
`rest-transport.js` / `workspace-lifecycle.js`): `createSubworkspace` (`POST /v2/workspaces/{id}/child`,
body `{ title, resources }`), `getWorkspaceStatus` (`GET …/status` — poll until `created`),
`listWorkspaceFamily` (`GET …/family` → **top-level array** `[{ id, title, status }]`),
`transferWorkspaceResources` (`POST /v2/…/resources/transfer`, body `{ resources: { ai: { projects,
prompts } } }`), `deleteWorkspace` (`DELETE /v1/workspaces/{id}` — **fail-closed**, gated by
`SERENITY_ALLOW_WORKSPACE_DELETE`, test-cleanup only).

1. **Spec:** vendor the user-manager swagger; start `corrections.yaml` empty; `npm run generate`.
2. **Statefulness decision:** which resources are write-then-read? Likely the child workspace
   (create → status/family reads it) and its allocation (transfer → reflected in family/status). The
   `family` listing is a read of created children — that is the stateful spine. Status polling
   (`not ready → created`) is a behavior to model deterministically (a control flag, not a timer).
3. **Build** store/stateful/factories/seeds/quota?/auth exactly as in §2; **`// @ts-check`** + factory
   pattern + the route-handler exception.
4. **Mirror the gateway prefix:** project-engine uses `--prefix /enterprise/projects/api`;
   user-manager is `--prefix /enterprise/users/api`. (One mock can only serve one prefix — keep the
   two clients' mocks separate, as the packages already are.)
5. **Auth + control routes + empty-202 acks + 404-on-unmodelled** — identical conventions.
6. **Tests:** unit at 100% (branches 100), `.type-test.ts` files, `MOCK_E2E=1` e2e, and a path-gated
   `user-manager-mock-e2e.yaml` (copy project-engine's, including `push:[main]`).
7. **Live-validate (§4)** against the **same funded prod workspace + its parent**: replay
   `createSubworkspace` → `getWorkspaceStatus` (poll) → `listWorkspaceFamily` → `transferWorkspaceResources`,
   and `deleteWorkspace` ONLY with `SERENITY_ALLOW_WORKSPACE_DELETE` for cleanup (it cascades — the
   child's reads `403` after). Pin statuses + empty-body acks; any live-only field → an overlay `CRn`.
   Reuse the trap-cleanup + add-own-row-then-delete safety. Watch the same eventual-consistency
   (`not ready` window after child create — that one the consumer DOES poll, so model the
   `not ready → created` transition deterministically via a control route).
8. **Docs:** write the package's own `mock-usage.md` + `mock-statefulness.md`; cross-link this
   playbook.

---

## 6. eslint / tooling note (see also §"eslint" in the team notes)

This repo uses **one root flat config** (`eslint.config.js`); **no package ships its own** eslint
config. Package-specific needs are expressed as scoped `files:` stanzas in the root config (root
lint is `npm run lint -ws`, i.e. each package runs `eslint .` from its own dir). PR #1665 added two
stanzas: a generic e2e devDependency allowance (`packages/**/test/**/*.e2e.js`) and a Counterfact
route-handler `no-unused-vars` off (`packages/spacecat-shared-project-engine-client/mock/counterfact/routes/**`).
For user-manager, prefer **generalizing the route-handler glob to `packages/**/mock/counterfact/routes/**/*.js`**
(the e2e one is already generic) so the next client mock needs **zero** new root-eslint edits.
