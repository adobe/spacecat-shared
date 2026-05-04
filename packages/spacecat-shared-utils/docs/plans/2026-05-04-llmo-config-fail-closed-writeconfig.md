# LLMO Config: Fail-Closed `writeConfig` Validation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `llmoConfig.writeConfig` in `@adobe/spacecat-shared-utils` validate against the published Zod schema before `PutObject`. Throw a structured error on failure so no caller can silently corrupt an LLMO config in S3.

**Architecture:** Single source-level change in `packages/spacecat-shared-utils/src/llmo-config.js`. Add `llmoConfig.parse(config)` upstream of the S3 write; on validation failure throw a typed error (`LlmoConfigValidationError`) carrying the Zod issue list and site context. The function signature and import path are unchanged; runtime contract changes from fail-open to fail-closed.

**Tech Stack:** Node.js ESM, Zod (already a dependency via `schemas.js`), Mocha/Chai/Sinon for tests.

**Context:** Step 2 of [SITES-43238](https://jira.corp.adobe.com/browse/SITES-43238). Step 1 (writer-side filter in `spacecat-audit-worker`) merged 2026-05-04 in [PR #2442](https://github.com/adobe/spacecat-audit-worker/pull/2442) — commit `7793a536`. This step prevents future regressions of the same class from any caller.

**Prerequisites:**

- Step 1 has soaked ≥24h in prod with the writer-side filter active. Confirmed via Coralogix WARN signals (`Dropped non-alpha-2 region values from DRS prompts`, `Skipped DRS categories with no valid region`) and no audit-worker error-rate spike.
- Phase 1 caller audit (below) is complete and any non-DRS callers identified as emitting potentially-invalid configs have a fix-at-edge PR merged.

---

## File Map

**Modified files:**

- `packages/spacecat-shared-utils/src/llmo-config.js` — `writeConfig`: parse against schema before PutObject; throw on failure.
- `packages/spacecat-shared-utils/src/llmo-config.d.ts` (if it exists; otherwise add type for the new error) — declare the new error class export.
- `packages/spacecat-shared-utils/src/index.js` — export `LlmoConfigValidationError`.
- `packages/spacecat-shared-utils/test/llmo-config.test.js` — add fail-closed test cases for `writeConfig`.

**New files:**

- None. The error class lives next to `writeConfig` in `llmo-config.js`.

**Also rolled in (originally tracked separately as SITES-43908):**

- `readConfig` switched from raw `llmoConfig.parse` to `safeParse` and now throws `LlmoConfigValidationError` (instead of raw `ZodError`) on schema failure. Closes the read/write asymmetry surfaced in PR #1574 review so consumers have a single catch contract.

**Out of scope (this plan):**

- `customerConfigV2` read/write — different schema, separate concern.
- Repair of already-corrupted S3 configs — that's step 3.

All paths below are relative to `packages/spacecat-shared-utils/` unless stated otherwise.

---

## Phase 1: Caller Audit (pre-flight)

**Purpose:** Identify every caller of `llmoConfig.writeConfig` and confirm none silently produce configs that would fail validation. Without this, flipping the contract to fail-closed will turn pre-existing latent bugs into production exceptions.

### Task 1.1: Enumerate callers across consumer repos

- [x] Grep for `writeConfig` import + call patterns across the workspace.
- [x] Search pattern: `writeConfig\(` in `src/` of every spacecat-* consumer repo.

### Task 1.2: Classify each call site

- [x] Audit table (executed 2026-05-04 against current main of each repo):

| Repo | File:line | Source of `config` arg | Risk | Notes |
|---|---|---|---|---|
| spacecat-audit-worker | `src/drs-prompt-generation/drs-config-writer.js:200` | DRS prompts merged into config (read-then-modify) | Low | Step 1 (PR #2442, merged 2026-05-04) filters non-alpha-2 regions and skips new categories without a valid region before reaching writeConfig. Residual risk is anything else the schema rejects that the filter doesn't catch — covered by fail-closed itself. |
| spacecat-api-service | `src/controllers/llmo/llmo.js:543` | User input via PUT endpoint | None | Controller already calls `llmoConfigSchema.safeParse(newConfig)` at line 533 and returns HTTP 400 on failure before calling writeConfig. Fail-closed inside writeConfig is a no-op for this caller. |

No other production callers found across `spacecat-api-service`, `spacecat-audit-worker`, `spacecat-import-worker`, `spacecat-content-processor`, `spacecat-content-scraper`, `spacecat-fulfillment-worker`, `spacecat-task-processor`, `spacecat-autofix-worker`, `spacecat-reporting-worker`, or `spacecat-jobs-dispatcher`.

### Task 1.3: File fix-at-edge tasks if needed

- [x] None required. Both known callers either pre-validate (api-service) or pre-filter (audit-worker via step 1).

**Validation gate (Phase 1):** PASSED.

- Audit table covers 100% of `writeConfig` call sites in the consumer-repo set above.
- No fix-at-edge PRs needed before Phase 2.

---

## Phase 2: Implementation

**Purpose:** Add fail-closed validation to `writeConfig`. One function, one error class, tests.

### Task 2.1: Add `LlmoConfigValidationError` and validate in `writeConfig`

- [ ] Define `LlmoConfigValidationError` near the top of `src/llmo-config.js`:
  - Extends `Error`.
  - Constructor takes `(siteId, zodError)` and exposes `siteId` and `issues` (Zod's `error.issues`) as enumerable properties.
  - `name = 'LlmoConfigValidationError'`.
  - Message includes `siteId` and a one-line summary of issue paths/messages so log lines are diagnosable without inspecting the error object.
- [ ] In `writeConfig`, before constructing the `PutObjectCommand`, call `llmoConfig.safeParse(config)`. On failure, throw `new LlmoConfigValidationError(siteId, result.error)`.
- [ ] Update the JSDoc on `writeConfig` to document the new throw behavior and the error type.

### Task 2.2: Export the error class from the package entry point

- [ ] Re-export `LlmoConfigValidationError` from `src/index.js` (matching the pattern used for other named exports).
- [ ] If a `.d.ts` declaration exists for `llmo-config`, add the error class declaration. If not, do nothing — JS-only consumers don't need it.

### Task 2.3: Add tests in `test/llmo-config.test.js`

- [ ] Inside `describe('writeConfig', ...)`:
  - [ ] `throws LlmoConfigValidationError when category region is non-alpha-2` — config with `categories: { id: { name: 'x', region: 'en-us' } }` rejects, no PutObject call (assert via Sinon spy on `s3Client.send`).
  - [ ] `throws LlmoConfigValidationError when prompt regions contain invalid values` — `aiTopics[*].prompts[*].regions: ['global']`.
  - [ ] `throws LlmoConfigValidationError when a required field is missing` — e.g. category without `name`.
  - [ ] Error includes `siteId` and a non-empty `issues` array.
  - [ ] Existing valid-config test still passes unchanged.

**Validation gate (Phase 2):**

- `npm test -w packages/spacecat-shared-utils` is green.
- Coverage thresholds for the package hold (100% lines/statements, 97% branches per `.nycrc.json`).
- `npm run lint -w packages/spacecat-shared-utils` is clean.
- All existing `writeConfig` tests in this file still pass without modification.

---

## Phase 3: Release Coordination

**Purpose:** Ship the change to consumers in a controlled order. The contract change is runtime-breaking for any caller writing invalid configs; the audit in Phase 1 should make this a non-event in practice.

### Task 3.1: Conventional commit + semantic-release

- [ ] Commit message: `feat(llmo-config): fail-closed writeConfig validation` with a `BREAKING CHANGE:` footer documenting that `writeConfig` now throws `LlmoConfigValidationError` on schema failure. This forces a major-version bump for `@adobe/spacecat-shared-utils`.
- [ ] PR description references SITES-43238 and links the Phase 1 audit table.
- [ ] On merge to main, semantic-release publishes the new major version automatically.

### Task 3.2: Bump dependency in critical consumers

- [ ] Open dep-bump PRs (or manual updates) in the consumers identified in Phase 1 as actually using `writeConfig`. Order by risk:
  1. `spacecat-audit-worker` (DRS prompt writer; depends on step 1's filter being live)
  2. `spacecat-api-service` (LLMO config endpoints)
  3. Any other consumer flagged in Phase 1
- [ ] Each dep-bump PR runs the consumer's full test suite; failures here indicate a Phase 1 miss and must be fixed before merging the bump.

**Validation gate (Phase 3):**

- spacecat-shared-utils new major version published.
- Each consumer dep-bump PR: CI green, no test failures attributable to fail-closed validation.
- For any consumer whose CI surfaces an invalid-config write that Phase 1 missed: do not merge the bump; reopen Phase 1 for that caller, fix at edge, then retry.

---

## Phase 4: Production Verification

**Purpose:** Confirm the fail-closed behavior is live and not generating production errors in normal operation.

### Task 4.1: Watch for unexpected validation failures

- [ ] After each consumer dep-bump deploy, monitor Coralogix for `LlmoConfigValidationError` occurrences across all consumer Lambda subsystems for ≥48h.
- [ ] For each occurrence: identify the caller, the `siteId`, and the failing issue paths. Decide whether to (a) fix at source if a real bug, or (b) add a writer-side filter analogous to step 1 if the upstream data is the problem.

### Task 4.2: Re-run the SITES-43238 reproducer

- [ ] After step 3 (repair) completes for site `78d59744-e06c-4d14-a77a-9490c1464116`, confirm `GET /api/v1/sites/78d59744-e06c-4d14-a77a-9490c1464116/llmo/config` returns 200 (or the expected response shape — not 400 from a Zod failure on read).
- [ ] No correctness regression for sites that were healthy before this change.

**Validation gate (Phase 4):**

- Zero `LlmoConfigValidationError` occurrences in prod logs over ≥48h, OR each occurrence has a documented root cause and an open ticket / merged fix.
- The SITES-43238 reproducer no longer 400s on read for the originally-affected site (this gate may be satisfied by step 3's repair rather than this step alone).
- Step 2 declared complete on the Jira ticket.

---

## Risks

1. **Hidden invalid-writing caller missed by Phase 1.** Most likely cause of post-deploy incidents. Mitigation: Phase 4's 48h watch + a pre-merge dry-run that runs a handful of representative writes through the new code path.
2. **Zod parse cost on every write.** LLMO configs are small JSON; parse is microseconds. Negligible. Not mitigated.
3. **Caller catches `Error` and swallows.** If any caller has a generic `try/catch` around `writeConfig` and discards the error, fail-closed silently degrades to a no-op. Phase 1 should flag these. Mitigation: any caller that catches around `writeConfig` should re-throw `LlmoConfigValidationError` explicitly or escalate.
4. **Major-version bump churn.** Renovate/dependabot may push the new version to consumers we haven't yet audited. Mitigation: pin in `renovate.json5` until Phase 3 is complete, OR rely on consumer CI to catch issues.

## Deferred

- Schema-evolution policy (what happens when the schema changes and old configs become invalid). Out of scope; tracked separately if the schema starts to evolve.
- Read-validate-write helper (helper that reads, applies a mutator, writes — atomically schema-checked). Possible follow-up if multiple callers re-implement that pattern.
- CloudWatch / Coralogix counter metric for validation failures. Useful for trend-watching but not required for correctness.

## Timeline (estimate)

- Phase 1 (audit): 1 day
- Phase 2 (implementation + tests): half a day
- Phase 3 (release + critical dep bumps): 1–2 days
- Phase 4 (prod verification soak): 2–3 days

End-to-end ~1 calendar week assuming Phase 1 surfaces no surprises.
