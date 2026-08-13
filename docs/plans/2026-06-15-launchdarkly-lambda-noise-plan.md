# LaunchDarkly Lambda Log-Noise Elimination - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop LaunchDarkly SDK lines from flooding SpaceCat prod logs as `error`-level noise (~71% of all prod errors) by fixing the LD client lifecycle and logging in the shared client, then cascading the new version to prod.

**Architecture:** The behavior change is confined to `spacecat-shared-launchdarkly-client`: a module-scope SDK-client cache (one client per warm Lambda container instead of one per request), polling instead of streaming, a bounded init timeout, and the existing logger mapping. A two-step release cascade (`launchdarkly-client` -> `http-utils` pin bump -> `api-service` consumption bump + redeploy) is what actually lands it in prod - the prior logger fix never deployed because `http-utils` hard-pins the old `launchdarkly-client@1.0.4`.

**Tech Stack:** Node 22 ESM, `@launchdarkly/node-server-sdk@^9.11.2`, Mocha + Chai + Sinon + esmock, c8 coverage (100% lines/statements, 97% branches), semantic-release monorepo (OIDC publish).

**Spec:** `docs/plans/2026-06-15-launchdarkly-lambda-noise-design.md`

---

## File Structure

Phase 1 (repo: `spacecat-shared`, branch `fix/launchdarkly-lambda-noise`):
- Modify: `packages/spacecat-shared-launchdarkly-client/src/launchdarkly-client.js` - cache, polling, timeout, `clearClientCache` export.
- Modify: `packages/spacecat-shared-launchdarkly-client/src/index.js` - re-export `clearClientCache`.
- Modify: `packages/spacecat-shared-launchdarkly-client/test/index.test.js` - reset cache in `afterEach`, new assertions, cross-instance + cache-clear tests.
- Modify: `packages/spacecat-shared-launchdarkly-client/package.json` - SDK bump to `^9.11.2`.

Phase 2 (repo: `spacecat-shared`, NEW branch, after Phase 1 publishes):
- Modify: `packages/spacecat-shared-http-utils/package.json` - bump `@adobe/spacecat-shared-launchdarkly-client` pin `1.0.4` -> `^1.3.0`.

Phase 3 (repo: `spacecat-api-service`, NEW branch, after Phase 2 publishes):
- Modify: `package.json` + `package-lock.json` - bump `@adobe/spacecat-shared-http-utils` and `@adobe/spacecat-shared-launchdarkly-client`, dedupe to a single hoisted copy.

Phase 4: validation gates (Coralogix), no code.

---

## Phase 1 - `spacecat-shared-launchdarkly-client`

Work on the existing branch `fix/launchdarkly-lambda-noise` in `spacecat-shared`. All commands run from the repo root `/Users/dj/work/github/adobe/spacecat-shared`.

### Task 1: Bump the LaunchDarkly SDK to 9.11.2 (hygiene, behavior-neutral)

**Files:**
- Modify: `packages/spacecat-shared-launchdarkly-client/package.json`

- [ ] **Step 1: Edit the dependency**

In `packages/spacecat-shared-launchdarkly-client/package.json`, change:
```json
"@launchdarkly/node-server-sdk": "^9.9.7"
```
to:
```json
"@launchdarkly/node-server-sdk": "^9.11.2"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: lockfile updates `@launchdarkly/node-server-sdk` to `9.11.2`.

- [ ] **Step 3: Verify the two API facts the design relies on still hold in 9.11.2**

Run:
```bash
DT=node_modules/@launchdarkly/js-server-sdk-common/dist/api/options
grep -n -B1 "stream?: boolean" $DT/LDOptions.d.ts | grep -i deprecat || echo "stream: NOT deprecated (OK)"
grep -n "@experimental" $DT/LDDataSystemOptions.d.ts | head -1 && echo "dataSystem: still experimental (OK - keep using stream/pollInterval)"
```
Expected: `stream` is NOT deprecated; `dataSystem` is still `@experimental`. If either changed, stop and revisit the design.

- [ ] **Step 4: Run the existing suite (must stay green)**

Run: `npm test -w packages/spacecat-shared-launchdarkly-client`
Expected: PASS, coverage thresholds met.

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-launchdarkly-client/package.json package-lock.json
git commit -m "fix(launchdarkly-client): bump node-server-sdk to ^9.11.2"
```

### Task 2: Module-scope SDK-client cache (reuse across warm invocations)

**Files:**
- Modify: `packages/spacecat-shared-launchdarkly-client/src/launchdarkly-client.js`
- Modify: `packages/spacecat-shared-launchdarkly-client/src/index.js`
- Test: `packages/spacecat-shared-launchdarkly-client/test/index.test.js`

- [ ] **Step 1: Capture the cache-reset hook in the test setup**

In `test/index.test.js`, the suite esmocks once in `before()`. Add a `clearClientCache` capture and reset it after each test so the new module-scope cache does not leak between tests.

In the `before(async () => { ... })` block, after `LaunchDarklyClient = module.default;`, add:
```js
    clearClientCache = module.clearClientCache;
```
Add the declaration near the other `let` declarations at the top of the `describe`:
```js
  let clearClientCache;
```
Change the existing `afterEach`:
```js
  afterEach(() => {
    sinon.resetHistory();
  });
```
to:
```js
  afterEach(() => {
    sinon.resetHistory();
    clearClientCache();
  });
```

- [ ] **Step 2: Write the failing cross-instance reuse test**

Add this test inside the `describe('init', ...)` block (next to the existing reuse tests):
```js
    it('reuses one SDK client across separate instances with the same sdkKey', async () => {
      const log = {
        info: sinon.stub(), error: sinon.stub(), debug: sinon.stub(), warn: sinon.stub(),
      };
      const a = new LaunchDarklyClient({ sdkKey: testSdkKey }, log);
      const b = new LaunchDarklyClient({ sdkKey: testSdkKey }, log);

      await a.init();
      await b.init();

      // Without a module-scope cache, each instance calls ld.init separately.
      expect(mockInit).to.have.been.calledOnce;
    });
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npm test -w packages/spacecat-shared-launchdarkly-client -- --grep "reuses one SDK client"`
Expected: FAIL - `mockInit` called twice.

- [ ] **Step 4: Add the cache + reset export to the client**

In `src/launchdarkly-client.js`, add module-scope constants and cache near the top (after the existing `DEFAULT_API_BASE_URL`):
```js
const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const DEFAULT_INIT_TIMEOUT_SECONDS = 5;

// Cache of initialized SDK clients, keyed by sdkKey. A warm Lambda container
// reuses one client across invocations instead of opening a new connection per
// request. Each entry holds the in-flight/resolved init promise.
const sdkClientCache = new Map();

/**
 * Resets the module-scope SDK-client cache. Exported for tests; not part of the
 * normal runtime flow.
 */
export function clearClientCache() {
  sdkClientCache.clear();
}
```

Replace the body of `async init()` with:
```js
  async init() {
    if (!this.sdkKey) {
      throw new Error('LaunchDarkly SDK key is required for flag evaluation');
    }

    if (this.client) {
      return undefined;
    }

    const cached = sdkClientCache.get(this.sdkKey);
    if (cached) {
      // Reuse an already-initialized client or join an in-flight initialization.
      this.client = await cached.initPromise;
      return undefined;
    }

    const initPromise = (async () => {
      const client = ld.init(this.sdkKey, {
        stream: false,
        pollInterval: DEFAULT_POLL_INTERVAL_SECONDS,
        ...this.options,
        logger: this.sdkLogger,
      });
      await client.waitForInitialization({ timeoutSeconds: DEFAULT_INIT_TIMEOUT_SECONDS });
      return client;
    })();

    sdkClientCache.set(this.sdkKey, { initPromise });

    try {
      this.client = await initPromise;
      this.log.info('LaunchDarkly client initialized successfully');
    } catch (error) {
      // Clear the poisoned entry so the next call retries initialization.
      sdkClientCache.delete(this.sdkKey);
      this.log.error('Failed to initialize LaunchDarkly client:', error);
      throw error;
    }
    return undefined;
  }
```

- [ ] **Step 5: Re-export `clearClientCache`**

In `src/index.js`, change:
```js
import LaunchDarklyClient from './launchdarkly-client.js';

export { LaunchDarklyClient };
export default LaunchDarklyClient;
```
to:
```js
import LaunchDarklyClient, { clearClientCache } from './launchdarkly-client.js';

export { LaunchDarklyClient, clearClientCache };
export default LaunchDarklyClient;
```

- [ ] **Step 6: Run the new test + full suite**

Run: `npm test -w packages/spacecat-shared-launchdarkly-client`
Expected: PASS, including the new cross-instance test and all pre-existing reuse tests (the `afterEach` reset keeps them isolated).

- [ ] **Step 7: Commit**

```bash
git add packages/spacecat-shared-launchdarkly-client/src packages/spacecat-shared-launchdarkly-client/test
git commit -m "feat(launchdarkly-client): cache SDK client per sdkKey across warm invocations"
```

### Task 3: Polling instead of streaming + bounded init timeout

**Files:**
- Test: `packages/spacecat-shared-launchdarkly-client/test/index.test.js`
- Modify: `packages/spacecat-shared-launchdarkly-client/src/launchdarkly-client.js` (already done in Task 2 - this task drives it with tests and updates the existing arg assertion)

- [ ] **Step 1: Write failing assertions for the new init options**

Add this test inside `describe('init', ...)`:
```js
    it('initializes in polling mode with a bounded init timeout', async () => {
      const log = {
        info: sinon.stub(), error: sinon.stub(), debug: sinon.stub(), warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, log);

      await client.init();

      const options = mockInit.firstCall.args[1];
      expect(options).to.include({ stream: false, pollInterval: 30 });
      expect(options).to.have.property('logger');
      expect(mockClient.waitForInitialization)
        .to.have.been.calledWith({ timeoutSeconds: 5 });
    });
```

- [ ] **Step 2: Run it**

Run: `npm test -w packages/spacecat-shared-launchdarkly-client -- --grep "polling mode"`
Expected: PASS (the implementation from Task 2 already passes `stream:false`, `pollInterval:30`, and `{ timeoutSeconds: 5 }`). If it fails, fix the `ld.init` options / `waitForInitialization` call in `src/launchdarkly-client.js` to match.

- [ ] **Step 3: Commit**

```bash
git add packages/spacecat-shared-launchdarkly-client/test
git commit -m "test(launchdarkly-client): assert polling mode and init timeout"
```

### Task 4: Cache is cleared on init failure (retry, no poisoned warm container)

**Files:**
- Test: `packages/spacecat-shared-launchdarkly-client/test/index.test.js`

- [ ] **Step 1: Write the failing retry test**

Add inside `describe('init', ...)`:
```js
    it('clears the cache on init failure so the next call retries', async () => {
      const log = {
        info: sinon.stub(), error: sinon.stub(), debug: sinon.stub(), warn: sinon.stub(),
      };
      mockClient.waitForInitialization.onFirstCall().rejects(new Error('init timeout'));
      mockClient.waitForInitialization.onSecondCall().resolves();

      const first = new LaunchDarklyClient({ sdkKey: testSdkKey }, log);
      await expect(first.init()).to.be.rejectedWith('init timeout');

      const second = new LaunchDarklyClient({ sdkKey: testSdkKey }, log);
      await second.init();

      // A failed init must not poison the cache: ld.init runs again on retry.
      expect(mockInit).to.have.been.calledTwice;

      mockClient.waitForInitialization.reset();
      mockClient.waitForInitialization.resolves();
    });
```

- [ ] **Step 2: Run it**

Run: `npm test -w packages/spacecat-shared-launchdarkly-client -- --grep "clears the cache on init failure"`
Expected: PASS (the `catch` block in Task 2 deletes the cache entry). If it fails, ensure `sdkClientCache.delete(this.sdkKey)` is in the `catch`.

- [ ] **Step 3: Commit**

```bash
git add packages/spacecat-shared-launchdarkly-client/test
git commit -m "test(launchdarkly-client): retry after init failure clears cache"
```

### Task 5: Full verification gate + open Phase 1 PR

- [ ] **Step 1: Run lint, full suite, coverage**

Run:
```bash
npm run lint -w packages/spacecat-shared-launchdarkly-client
npm test -w packages/spacecat-shared-launchdarkly-client
```
Expected: lint clean; all tests pass; c8 reports 100% lines/statements, >=97% branches. If a new branch (e.g. the `catch` path) is uncovered, the Task 4 test should cover it - confirm.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin fix/launchdarkly-lambda-noise
```
Open a PR to `adobe/spacecat-shared` `main` via the `mcp__github__*` tools. Title: `feat(launchdarkly-client): eliminate Lambda log noise (cache + polling + init timeout)`. Body: link the spec, summarize root cause (nested `1.0.4` pin shipped a no-logger streaming client created per request) and the fix. Note this is Phase 1 of a 3-PR cascade.

- [ ] **Step 3: Validation gate - merge + publish**

After review + merge, confirm semantic-release published the new minor:
```bash
npm view @adobe/spacecat-shared-launchdarkly-client dist-tags.latest
```
Expected: `1.3.0` (or the computed minor). Record the exact version - Phase 2 pins to it.

---

## Phase 2 - `spacecat-shared-http-utils` pin bump (lands the fix on the auth path)

This is what makes prod actually pick up the fix: `http-utils` hard-pins `launchdarkly-client@1.0.4`, which shadows everything. Do this in a NEW branch only AFTER Phase 1's version is on npm (otherwise CI `npm install` fails with a missing version).

### Task 6: Bump the launchdarkly-client pin in http-utils

**Files:**
- Modify: `packages/spacecat-shared-http-utils/package.json`

- [ ] **Step 1: New branch from latest main**

```bash
git fetch origin main
git checkout -b fix/http-utils-ld-client-bump origin/main
```

- [ ] **Step 2: Edit the pin**

In `packages/spacecat-shared-http-utils/package.json`, change the `@adobe/spacecat-shared-launchdarkly-client` dependency from `1.0.4` to `^1.3.0` (use the exact version published in Phase 1).

- [ ] **Step 3: Install + test**

```bash
npm install
npm test -w packages/spacecat-shared-http-utils
npm run lint -w packages/spacecat-shared-http-utils
```
Expected: PASS. The auth handlers call `LaunchDarklyClient.createFrom(...)` unchanged; existing tests stub the client, so behavior is unchanged at the http-utils layer.

- [ ] **Step 4: Verify no nested old copy remains in the workspace**

Run:
```bash
find node_modules/@adobe/spacecat-shared-http-utils/node_modules -name package.json -path '*launchdarkly-client*' -exec node -p "require('./{}').version" \; 2>/dev/null || echo "no nested copy (OK)"
```
Expected: no nested `launchdarkly-client` under http-utils (hoisted to a single `>=1.3.0`).

- [ ] **Step 5: Commit, push, PR**

```bash
git add packages/spacecat-shared-http-utils/package.json package-lock.json
git commit -m "fix(http-utils): bump launchdarkly-client to ^1.3.0 to ship Lambda log-noise fix"
git push -u origin fix/http-utils-ld-client-bump
```
Open PR to `adobe/spacecat-shared` `main`. After merge, confirm publish:
```bash
npm view @adobe/spacecat-shared-http-utils dist-tags.latest
```
Record the new http-utils version for Phase 3.

---

## Phase 3 - `spacecat-api-service` consumption bump + dedupe + deploy

Repo: `spacecat-api-service` (`/Users/dj/work/github/adobe/spacecat-api-service`). Do this AFTER Phase 2 is on npm.

### Task 7: Bump consumers and remove the nested old client

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: New branch from latest main**

```bash
cd /Users/dj/work/github/adobe/spacecat-api-service
git fetch origin main
git checkout -b fix/ld-lambda-noise-consume origin/main
```

- [ ] **Step 2: Bump both shared deps**

In `package.json`, set:
- `@adobe/spacecat-shared-http-utils` to the version published in Phase 2.
- `@adobe/spacecat-shared-launchdarkly-client` to `^1.3.0` (so the top-level range and the http-utils pin both resolve to one hoisted copy).

- [ ] **Step 3: Install and confirm a single hoisted client**

```bash
npm install
node -p "require('./node_modules/@adobe/spacecat-shared-launchdarkly-client/package.json').version"
find node_modules/@adobe/spacecat-shared-http-utils/node_modules -path '*launchdarkly-client*' 2>/dev/null || echo "no nested copy (OK)"
```
Expected: top-level client is `>=1.3.0`; no nested copy under http-utils. This is the dedupe that guarantees the auth path loads the fixed client.

- [ ] **Step 4: Run the api-service test suite**

Run: `npm test`
Expected: PASS. If auth tests stub the LD client, no behavior change is expected.

- [ ] **Step 5: Commit, push, PR**

```bash
git add package.json package-lock.json
git commit -m "fix: consume launchdarkly-client log-noise fix and dedupe nested copy"
git push -u origin fix/ld-lambda-noise-consume
```
Open PR to `adobe/spacecat-api-service` `main` via `mcp__github__*`. Merge per the repo's CD flow (deploys to dev/ci, then prod).

---

## Phase 4 - Validation gates (Coralogix)

LD logs flow to Coralogix during the Splunk cutover. Use the SpaceCat Coralogix label map: dev = `aws-682033462621` / `spacecat-services-dev`; prod = `aws-640168421876` / `spacecat-services-prod`. Keep windows <= 6h.

### Task 8: Verify dev after api-service deploys to ci/dev

- [ ] **Step 1: Confirm LD noise templates are gone in dev**

DataPrime (last 3h, dev):
```
source logs | filter $l.applicationname == 'aws-682033462621'
  && $l.subsystemname == 'spacecat-services-dev'
  && $d.level == 'error'
  && $d.message ~ 'launchdarkly'
  | count
```
Expected: ~0 (was a steady stream of `will retry stream connection` / `waitForInitialization ... timeout`).

- [ ] **Step 2: Confirm flag evaluation still works (fail-open + correctness)**

Exercise an IMS-authenticated request for an org gated by `FF_READ_ONLY_ORG` and confirm the gate behaves as before. Check dev logs show no new LD `error` lines and no auth regressions.

- [ ] **Step 3: Sanity-check cold-start latency**

Confirm api-service p50/p99 latency in dev is not worse than before (the single per-cold-start poll with a 5s timeout replaces per-request streaming).

### Task 9: Verify prod after deploy

- [ ] **Step 1: Re-run the top-error analysis in prod**

DataPrime (prod, comparable window):
```
source logs | filter $l.applicationname == 'aws-640168421876'
  && $l.subsystemname == 'spacecat-services-prod'
  && $d.level == 'error'
  | groupby $d.inv.functionName aggregate count() as cnt
```
Expected: `api-service` error count drops from ~106k to roughly the genuine-error baseline; the LD templates (`will retry stream connection`, `waitForInitialization ... timeout`, `received I/O error`) are absent from the top-N.

- [ ] **Step 2: Confirm the genuine errors are now visible**

Expected top errors are the real ones (import-worker RUM domainkey 404s, audit-worker enrollment + DB unique-constraint), not LD noise. Done.

---

## Self-Review Notes

- Spec coverage: cache (Task 2), polling + timeout (Task 3), logger mapping retained (unchanged code, covered by existing logger tests at lines ~130-138), cache-clear-on-failure (Task 4), SDK bump (Task 1), release cascade (Tasks 5-7), validation gates (Tasks 8-9). The url.parse DEP0169 is explicitly out of scope per the spec.
- Type/name consistency: `clearClientCache` exported from `launchdarkly-client.js` and re-exported from `index.js`; `sdkClientCache`, `DEFAULT_POLL_INTERVAL_SECONDS` (30), `DEFAULT_INIT_TIMEOUT_SECONDS` (5) used consistently; tests assert the same literals (`stream:false`, `pollInterval:30`, `timeoutSeconds:5`).
- Cross-repo gates: Phase 2 waits on Phase 1's npm publish; Phase 3 waits on Phase 2's. Each is a separate branch/PR.
