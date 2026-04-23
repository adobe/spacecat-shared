# Fix: Omit `display_date` to avoid 5x historical pricing on SEO provider API

**Package:** `@adobe/mysticat-shared-seo-client` (v1.2.1)
**Date:** 2026-04-14
**Author:** Daniel Huser

## Problem

The SEO provider API charges **5x more API units** when the `display_date` parameter is present — regardless of what date value is set. This was empirically verified:

| Request | `display_date` | Cost |
|---------|---------------|------|
| `domain_rank` without `display_date` | omitted | **10 units** |
| `domain_rank` with `display_date=20260315` (latest month) | present | **50 units** |

This is a pre-existing issue (predating PR #1522), but the recent 30-DB fan-out amplifies it:

| Scenario | DBs | Cost/DB | Total per call |
|----------|-----|---------|----------------|
| Before fan-out (hardcoded US, with display_date) | 1 | 50 | 50 |
| Current (fan-out + display_date) | 30-31 | 50 | **1,500-1,550** |
| Fixed (fan-out, no display_date) | 30-31 | 10 | **300-310** |

(30 BIG_MARKETS databases; 31 when the site's region is not already in BIG_MARKETS.)

**Net savings: 80% cost reduction on affected endpoints.**

**Estimated monthly impact** (based on production data as of 2026-04-14):
- 62 sites have `ahref-paid-pages` imports enabled (which calls both `getPaidPages` and `getMetrics`)
- Per site per import run: `getPaidPages` (30 DBs) + `getMetrics` (30 DBs) = 60 API calls at the `domain_rank`/`domain_adwords` endpoints
- For `getMetrics` (1 line/DB): current = 30 × 50 = 1,500 units; fixed = 30 × 10 = 300 units
- For `getPaidPages`: cost scales with response lines per DB (up to `fetchLimit`), so savings scale proportionally
- Total savings per run = at minimum 1,200 units/site (getMetrics alone) × 62 sites = **74,400 units/run**
- Actual frequency depends on the jobs-dispatcher cron schedule in `global-config.json` (not checked — AWS session was expired)
### SEO provider API documentation

The SEO provider docs explicitly state: *"If you want to get the most recent data, don't use this parameter or leave the value empty."* Omitting `display_date` returns the latest available snapshot at "live" (non-historical) unit rates.

## Affected methods

Only two methods currently send `display_date` with a default:

1. **`getPaidPages`** (client.js:347, 365) — defaults `date` to `lastMonthISO()`, always sends `display_date`
2. **`getMetrics`** (client.js:428, 440) — defaults `date` to `lastMonthISO()`, always sends `display_date`

**Not affected:**
- `getTopPages` — does not use `display_date`
- `getOrganicTraffic` — does not use `display_date` (uses full history endpoint, filters client-side)
- `getBrokenBacklinks` — does not use `display_date`
- `getMetricsByCountry` — stub, returns `STUB_RESPONSE`

## Downstream callers

### Import worker (`src/importer/seo.js`)

```js
seoClient.getPaidPages(domain, { date, limit, region })  // line 229
seoClient.getMetrics(domain, { date, region })            // line 230
```

`date` comes from config. The `paidPagesConfigProvider` only sets `date` if the SQS message includes one (`message.date`). In normal scheduled imports, no date is provided, so `date` is `undefined` and the SEO client's default kicks in.

After this fix: `undefined` date means `display_date` is omitted entirely (live pricing). Explicit date still sends `display_date` (historical pricing, which is correct — the caller explicitly requested a specific month).

### API service (`src/controllers/llmo/llmo-onboarding.js`)

```js
seoClient.getTopPages(url, { limit: 1 })  // line 938
```

Not affected — `getTopPages` doesn't use `display_date`.

### Audit worker

Not affected — the audit worker depends on `@adobe/spacecat-shared-ahrefs-client`, not `@adobe/mysticat-shared-seo-client`. It does not consume the package being changed here.

## Implementation plan

### Step 1: Remove `lastMonthISO()` default, conditionally include `display_date`

**File:** `packages/mysticat-shared-seo-client/src/client.js`

#### 1a. `getPaidPages` (line 347, 361-369)

Change:
```js
const { date = lastMonthISO(), limit = 200, region } = opts;
```
To:
```js
const { date, limit = 200, region } = opts;
```

Change the request params from:
```js
const dbResults = await this.fanOut(databases, (db) => this.sendRawRequest({
  type: ep.type,
  domain: url,
  database: db,
  display_date: toApiDate(date),
  display_limit: fetchLimit,
  export_columns: ep.columns,
  ...ep.defaultParams,
}, ep.path), 'getPaidPages');
```
To:
```js
const dbResults = await this.fanOut(databases, (db) => {
  const params = {
    type: ep.type,
    domain: url,
    database: db,
    display_limit: fetchLimit,
    export_columns: ep.columns,
    ...ep.defaultParams,
  };
  if (date) {
    params.display_date = toApiDate(date);
  }
  return this.sendRawRequest(params, ep.path);
}, 'getPaidPages');
```

#### 1b. `getMetrics` (line 428, 436-443)

Same pattern — remove `lastMonthISO()` default, conditionally include `display_date`:

Change:
```js
const { date = lastMonthISO(), region } = opts;
```
To:
```js
const { date, region } = opts;
```

Change the request params from:
```js
const dbResults = await this.fanOut(databases, (db) => this.sendRawRequest({
  type: ep.type,
  domain: url,
  database: db,
  display_date: toApiDate(date),
  export_columns: ep.columns,
  ...ep.defaultParams,
}, ep.path), 'getMetrics');
```
To:
```js
const dbResults = await this.fanOut(databases, (db) => {
  const params = {
    type: ep.type,
    domain: url,
    database: db,
    export_columns: ep.columns,
    ...ep.defaultParams,
  };
  if (date) {
    params.display_date = toApiDate(date);
  }
  return this.sendRawRequest(params, ep.path);
}, 'getMetrics');
```

#### 1c. `getMetricsByCountry` stub (line 761)

Change:
```js
async getMetricsByCountry(url, date = lastMonthISO()) {
```
To:
```js
async getMetricsByCountry(url, date) {
```

This is a stub returning `STUB_RESPONSE`, so only the signature matters.

### Step 2: Clean up imports

**File:** `packages/mysticat-shared-seo-client/src/client.js` (line 18)

After steps 1a-1c, `lastMonthISO` is no longer used in `client.js`. Remove it from the import:
```js
import {
  parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, buildFilter,
  extractBrand, INTENT_CODES,
} from './utils.js';
```

Keep `lastMonthISO` exported from `index.js` and `utils.js` — callers may use it explicitly.

### Step 3: Update TypeScript declarations

**File:** `packages/mysticat-shared-seo-client/src/index.d.ts`

No signature changes needed. `date?: string` is already optional in both `getPaidPages` and `getMetrics` options. The behavior change (omitting display_date when date is undefined) is internal.

### Step 4: Update tests

**File:** `packages/mysticat-shared-seo-client/test/client.test.js`

#### 4a. Tests that assert `display_date` in `fullAuditRef`

Two tests currently assert that `display_date` is present in `fullAuditRef`:
- Line ~456: `expect(result.fullAuditRef).to.include('display_date=20250315');` (getMetrics with explicit date)
- Line ~510: `expect(result.fullAuditRef).to.include('display_date=20250215');` (getMetrics default date test)

The first test (explicit date) should still pass. The second test (default date) needs updating — when no date is provided, `display_date` should NOT appear in the request.

#### 4b. Tests for "defaults to last month" behavior

The test "defaults to last month when no date provided" (getMetrics) currently asserts:
```js
expect(result.fullAuditRef).to.include('display_date=20250215');
```

This should change to verify that `display_date` is NOT in the request:
```js
expect(result.fullAuditRef).to.not.include('display_date');
```

#### 4c. New tests: explicit date sends `display_date` (both methods)

Add tests for both `getMetrics` AND `getPaidPages` confirming that explicit `date` sends `display_date`:
```js
// getMetrics
it('sends display_date when explicit date is provided', async () => {
  nockMetricsDatabases(BIG_MARKETS, metricsCsv, { targetDb: 'us' });
  const result = await client.getMetrics('adobe.com', { date: '2025-03-01' });
  expect(result.fullAuditRef).to.include('display_date=20250315');
});

// getPaidPages — replaces the existing assertion-less test at ~line 1176
// ("sends custom date converted to API format") which has zero assertions
it('sends display_date when explicit date is provided', async () => {
  nockPaidDatabases(BIG_MARKETS, paidKeywordsCsv, { targetDb: 'us' });
  const result = await client.getPaidPages('adobe.com', { date: '2025-03-01' });
  expect(result.fullAuditRef).to.include('display_date=20250315');
});
```

#### 4d. New tests: no date omits `display_date` (both methods)

Add tests for both `getPaidPages` AND `getMetrics` confirming `display_date` is omitted when no date is passed:
```js
// getPaidPages
it('omits display_date when no date provided (live pricing)', async () => {
  nockPaidDatabases(BIG_MARKETS, paidKeywordsCsv, { targetDb: 'us' });
  const result = await client.getPaidPages('adobe.com');
  expect(result.fullAuditRef).to.not.include('display_date');
});

// getMetrics
it('omits display_date when no date provided (live pricing)', async () => {
  nockMetricsDatabases(BIG_MARKETS, metricsCsv, { targetDb: 'us' });
  const result = await client.getMetrics('adobe.com');
  expect(result.fullAuditRef).to.not.include('display_date');
});
```

#### 4e. Update nock matchers

The existing nock helpers (`nockMetricsDatabases`, `nockPaidDatabases`) use loose function matchers (`query((q) => q.type === '...' && q.database === db)`) that do not assert the presence or absence of `display_date`. This means nock will match requests regardless of whether `display_date` is present.

Since the nock matchers don't gate on `display_date`, no nock changes are strictly required. The behavioral verification relies on `fullAuditRef` assertions in the tests above (steps 4b-4d). However, for tests with explicit dates, consider tightening the nock matcher to also verify `q.display_date === '20250315'` to prevent regressions.

#### 4f. Update stale clock comment

The test at `client.test.js:~509` has a comment `// Clock is 2025-03-12, so lastMonthISO() = 2025-02-01 → toApiDate = 20250215`. Since this test will change to verify the absence of `display_date`, update or remove this comment to reflect the new behavior.

### Step 5: No downstream changes needed

- **Import worker**: `date` is already `undefined` when no SQS message date is provided. Passing `{ date: undefined }` to the SEO client results in `date` being `undefined` in the destructured opts, which means `display_date` is omitted. No change needed.
- **API service**: Doesn't call affected methods.
- **Audit worker**: Doesn't call affected methods.

## Verification

- **Package manager**: npm (workspace `-w packages/mysticat-shared-seo-client`)
- **Test command**: `npm test -w packages/mysticat-shared-seo-client`
- **Lint command**: `npm run lint -w packages/mysticat-shared-seo-client`
- **Coverage thresholds**: 100% lines, 100% branches, 100% statements (`.nycrc.json`)
- **Pre-commit hooks**: yes (husky + lint-staged)
- **Test cases for new/changed branches**:
  - [ ] `getPaidPages` without date → `display_date` NOT in request params
  - [ ] `getPaidPages` with explicit date → `display_date` IS in request params
  - [ ] `getMetrics` without date → `display_date` NOT in request params
  - [ ] `getMetrics` with explicit date → `display_date` IS in request params
  - [ ] All existing tests still pass (backward compatibility)
  - [ ] Coverage thresholds still met at 100%

### Step 6: Post-deploy verification

After the first production import cycle with the new version:
1. Check the SEO provider's API unit usage dashboard (Query log) to confirm reduced unit consumption
2. Compare unit consumption before/after for the same set of sites to validate the 80% cost reduction
3. Verify that the data returned without `display_date` matches what was previously returned (same metrics, same freshness)

## Known issues (out of scope)

- **Ahrefs client** (`@adobe/spacecat-shared-ahrefs-client`) may have a similar `display_date` cost issue in its own `getPaidPages`/`getMetrics` — worth a separate investigation.

## Risk assessment

**Low risk.** The change is purely internal — no method signatures change, no new parameters. The only behavioral difference is that `display_date` is omitted from the HTTP request when no explicit date is provided. This makes the API return the latest snapshot (same data as before) at 5x lower cost.

The only scenario where behavior changes is if the SEO provider's "latest" snapshot differs from `lastMonthISO()`. In early-month edge cases, the "latest" snapshot could theoretically be noisier than a pinned `lastMonthISO()` date. In practice, the provider's default snapshot selection is well-defined and this is the approach recommended by their own documentation. The date selection behavior is effectively deferred to the provider rather than computed client-side.
