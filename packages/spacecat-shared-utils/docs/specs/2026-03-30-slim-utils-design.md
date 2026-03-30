# Design: Slim down `spacecat-shared-utils` transitive dependencies

**Date:** 2026-03-30
**Jira:** SITES-42560
**Status:** Approved

---

## Problem

`@adobe/spacecat-shared-utils` pulls in ~110MB of transitive dependencies (22MB zipped). Any consumer — even one that only needs `hasText` — inherits the full dependency tree including `@aws-sdk/*`, `date-fns`, `world-countries`, `cheerio`, `zod`, and more. This makes the package unusable in size-constrained runtimes like Lambda@Edge (1MB zipped limit).

---

## Goals

- Consumers that only use pure utility functions (`hasText`, `isString`, etc.) pull in zero heavy dependencies in unbundled Node.js (the primary Lambda runtime).
- Existing imports from `@adobe/spacecat-shared-utils` continue to work unchanged (fully backwards compatible public API).
- No production dependencies are added or removed in this change.
- Leave consumers to migrate to sub-paths at their own pace.

## Non-goals

- Removing `date-fns` or replacing it with native Date arithmetic (tracked as future improvement).
- Moving `@aws-sdk/*` to `peerDependencies`.
- Updating consuming packages (`spacecat-shared-http-utils`, etc.) to use new sub-paths.

---

## Approach: Sub-path exports + `sideEffects` array

Add named sub-path exports to `package.json` backed by thin barrel files. The public API of the package remains completely unchanged.

---

## Key Structural Change: Extract `isValidEmail` into `src/email.js`

**This is required for `./core` to be truly zero-dep in unbundled Node.js.**

Currently `functions.js` has a top-level static import: `import isEmail from 'validator/lib/isEmail.js'`. In Node.js (no bundler), loading any file that statically imports `functions.js` — including `core.js` — will unconditionally evaluate this import and load `validator`, regardless of whether `isValidEmail` is actually used. The zero-dep claim is only valid in a bundled context.

**Fix:** Extract `isValidEmail` into its own file so `functions.js` has no external deps at all:

```
src/email.js        ← new (~5 lines): isValidEmail + validator import
src/functions.js    ← modified: validator import removed, isValidEmail removed
src/index.js        ← minimally modified: see migration steps below
src/core.js         ← new barrel: re-exports from functions.js only (zero deps)
```

### Implementation order (required)

**`src/functions.js` must be modified before `src/core.js` is created.** If `core.js` is created first while `functions.js` still contains `isValidEmail`, the barrel will accidentally re-export it and pull in `validator`.

### `src/functions.js` — three removals required

1. Remove the import: `import isEmail from 'validator/lib/isEmail.js'`
2. Remove the `isValidEmail` function body
3. Remove `isValidEmail` from the named `export { }` block at the bottom of the file (currently around line 336). Omitting this causes a startup `ReferenceError`.

### `src/index.js` migration steps (both steps required)

1. **Remove** `isValidEmail` from the existing `functions.js` re-export block:
   ```js
   // Before:
   export { ..., isValidEmail, ... } from './functions.js';
   // After: isValidEmail removed from this block
   export { ... } from './functions.js';
   ```
2. **Add** a new re-export line:
   ```js
   export { isValidEmail } from './email.js';
   ```

Omitting step 1 causes a startup `SyntaxError` (`functions.js` no longer provides `isValidEmail`). Both steps are required.

After this change, loading `core.js` → `functions.js` never touches `validator`. The public API of the package is unchanged — `isValidEmail` is still exported from `"."` via `index.js`. This also fixes `./locale`: `locale-detect.js` imports from `functions.js`, so removing the validator import there also removes it from the locale dep chain.

---

## Sub-path Mapping

| Import path | Barrel file | Dependencies pulled in |
|---|---|---|
| `@adobe/spacecat-shared-utils` | `src/index.js` (minimally updated) | All: `@aws-sdk/*`, `@adobe/fetch`, `aws-xray-sdk`, `date-fns`, `world-countries`, `cheerio`, `franc-min`, `iso-639-3`, `zod`, `validator`, `urijs`, `@json2csv/plainjs` |
| `@adobe/spacecat-shared-utils/core` | `src/core.js` (new) | **None** — pure JS only |
| `@adobe/spacecat-shared-utils/aws` | `src/aws.js` (new) | `@aws-sdk/client-s3`, `@aws-sdk/client-sqs`, `aws-xray-sdk`, `@adobe/fetch` (via both `sqs.js` directly and `tracing-fetch.js`) |
| `@adobe/spacecat-shared-utils/locale` | `src/locale.js` (new) | `cheerio`, `world-countries`, `franc-min`, `iso-639-3`, `@adobe/fetch`, `aws-xray-sdk` (via `tracing-fetch.js`). **Side effect:** loading `./locale` triggers the `adobe-fetch.js` HTTP context initialization (`h1()`/`h2()`) at module load time. |
| `@adobe/spacecat-shared-utils/calendar` | `src/calendar.js` (new) | `date-fns` |
| `@adobe/spacecat-shared-utils/schemas` | `src/schemas.js` (existing) | `zod` |

**Browser compatibility:** Sub-paths have no `browser` condition. `./aws` includes `@aws-sdk/*` and `aws-xray-sdk`, which are not browser-compatible. Sub-paths are intended for Node.js server-side consumers only.

### `./core` exports

All exports from `functions.js` after `isValidEmail` is extracted. Zero external dependencies:

`arrayEquals`, `dateAfterDays`, `deepEqual`, `hasText`, `isArray`, `isBoolean`, `isInteger`, `isIsoDate`, `isIsoTimeOffsetsDate`, `isNonEmptyArray`, `isNonEmptyObject`, `isNumber`, `isObject`, `isString`, `isValidDate`, `isValidHelixPreviewUrl`, `isValidIMSOrgId`, `isValidUrl`, `isValidUUID`, `toBoolean`

### Exports remaining main-barrel-only (no sub-path in this iteration)

The following remain accessible only via `@adobe/spacecat-shared-utils`:
- `url-helpers.js` — mixes pure URL utils with `@adobe/fetch` and `urijs`
- `helpers.js` — `@json2csv/plainjs`
- `bot-blocker-detect/` — transitively depends on `@adobe/fetch` via `tracing-fetch.js`
- `aem.js`, `aem-content-api-utils.js`, `url-extractors.js`, `formcalc.js`
- `aggregation/`, `llmo-config.js`, `llmo-strategy.js`, `cdn-helpers.js`
- `constants.js` — zero-dep, candidate for `./constants` in a follow-up (see Future Improvements)

### Breaking change: deep `src/` imports become inaccessible

Once the `exports` map is in place, any consumer doing `import '..../src/url-helpers.js'` directly will receive `ERR_PACKAGE_PATH_NOT_EXPORTED`. This is intentional — the `exports` map seals the public API. It is a breaking change for any consumer relying on deep imports, though none are known within this monorepo.

---

## `package.json` Changes

### Sub-path exports

Each sub-path includes a `types` condition. The `browser` condition on `"."` is pre-existing and preserved as-is:

```json
"exports": {
  ".": {
    "types": "./src/index.d.ts",
    "browser": "./src/browser.js",
    "default": "./src/index.js"
  },
  "./core": {
    "types": "./src/core.d.ts",
    "default": "./src/core.js"
  },
  "./aws": {
    "types": "./src/aws.d.ts",
    "default": "./src/aws.js"
  },
  "./locale": {
    "types": "./src/locale.d.ts",
    "default": "./src/locale.js"
  },
  "./calendar": {
    "types": "./src/calendar.d.ts",
    "default": "./src/calendar.js"
  },
  "./schemas": {
    "types": "./src/schemas.d.ts",
    "default": "./src/schemas.js"
  }
}
```

**Note on `browser` condition:** The `browser` condition on `"."` appears before `default`. Server-side bundlers that honour the `browser` condition by default (Webpack without `target: node`) will resolve `"."` to `browser.js`, which only exports `prettifyLogForwardingConfig`. This is pre-existing behavior. Server-side bundler consumers must configure `target: node` or `browser: false`. Sub-paths have no `browser` condition and always resolve to their `default`.

**Note on TypeScript `moduleResolution`:** Sub-path exports are only resolved by TypeScript with `"moduleResolution": "node16"`, `"nodenext"`, or `"bundler"`. Consumers on legacy `"moduleResolution": "node"` will get a TypeScript error on sub-path imports. Document this in the README.

Note: the existing top-level `"types": "src/index.d.ts"` is retained as a fallback for tooling that ignores `exports`.

### `sideEffects`

Only the two leaf files that actually execute imperative code at module load time are listed. Barrel files (`aws.js`, `locale.js`) are pure re-exports with no top-level imperative code of their own and must NOT be listed — listing them would prevent partial tree-shaking of the barrel by bundlers:

```json
"sideEffects": [
  "./src/adobe-fetch.js",
  "./src/url-helpers.js"
]
```

**Maintenance obligation:** Any new `src/` file added in the future that contains top-level imperative code (i.e., anything beyond `import`/`export` statements) must be added to this array. Document this obligation in the README.

### `devDependencies`

Add `esbuild` to `devDependencies` in `packages/spacecat-shared-utils/package.json`. It is used only for the dep hygiene CI script and does not affect the published artifact.

### `scripts`

Add a `pretest` hook so the dep hygiene check runs automatically before every `npm test` invocation, including `npm test -ws` at the monorepo root:

```json
"pretest": "node scripts/check-core-deps.js",
"test": "c8 mocha"
```

---

## New and Modified Files

### Modified source files

**`src/functions.js`**
1. Remove `import isEmail from 'validator/lib/isEmail.js'`
2. Remove the `isValidEmail` function body
3. Remove `isValidEmail` from the `export { }` block at the bottom of the file

**`src/index.js`**
- Remove `isValidEmail` from the `functions.js` re-export block
- Add `export { isValidEmail } from './email.js'`

**`src/index.d.ts`**
- Add type declarations for `isAWSLambda`, `resetFetchContext`, and `clearFetchCache`, which are exported from `src/index.js` but have no declarations (confirmed by full search of `index.d.ts`):
  ```ts
  export function isAWSLambda(): boolean;
  export function resetFetchContext(): void;
  export function clearFetchCache(): void;
  ```
- Add type declarations for the 5 calendar functions currently missing: `getDateRanges`, `getLastNumberOfWeeks`, `getWeekInfo`, `getMonthInfo`, `getTemporalCondition` (see exact signatures in the calendar.d.ts section below)
- Remove the `type` keyword from `export { type detectLocale }` on line 378, making it a value-level export so `locale.d.ts` can re-export it correctly

  **Note on locale-detect path:** Line 378 references `'./locale-detect/index.js'`. No `locale-detect/index.js` runtime file exists — only `locale-detect/index.d.ts`. This is correct: in TypeScript declaration files, `.js` extension references are resolved to their `.d.ts` siblings, so `locale-detect/index.d.ts` (which exists and declares `detectLocale`) is correctly found. The spec's approach of re-exporting through `./index.js` is valid and the chain works.

### New source files

**`src/email.js`** (~5 lines)
Contains the `isValidEmail` function extracted from `functions.js`, with the `validator` import.

**`src/core.js`** (create after modifying `functions.js`)
Re-exports all exports from `functions.js` (which is now zero-dep).

**`src/aws.js`**
Re-exports AWS/infrastructure utilities:
- `s3Wrapper`, `getObjectFromKey` — from `s3.js`
- `sqsWrapper`, `sqsEventAdapter` — from `sqs.js`
- `instrumentAWSClient`, `getTraceId`, `addTraceIdHeader` — from `xray.js`
- `logWrapper` — from `log-wrapper.js`
- `isAWSLambda` — from `runtimes.js`
- `fetch`, `resetFetchContext`, `clearFetchCache` — from `adobe-fetch.js`
- `tracingFetch`, `SPACECAT_USER_AGENT` — from `tracing-fetch.js`
- `getStoredMetrics`, `storeMetrics`, `calculateCPCValue` — from `metrics-store.js`

**`src/locale.js`**
Re-exports `detectLocale` from `locale-detect/locale-detect.js`.

**`src/calendar.js`**
Re-exports all exports from `calendar-week-helper.js`.

(`src/schemas.js` already exists; only a `.d.ts` file is new for it.)

### New `.d.ts` type declaration files

The `.d.ts` strategy varies per barrel due to gaps and namespace collisions in `index.d.ts`:

**`src/core.d.ts`** — re-exports from `./index.js` (all names exist in `index.d.ts`):
```ts
export {
  arrayEquals, dateAfterDays, deepEqual, hasText,
  isArray, isBoolean, isInteger, isIsoDate, isIsoTimeOffsetsDate,
  isNonEmptyArray, isNonEmptyObject, isNumber, isObject, isString,
  isValidDate, isValidHelixPreviewUrl, isValidIMSOrgId, isValidUrl,
  isValidUUID, toBoolean,
} from './index.js';
```

**`src/aws.d.ts`** — re-exports from `./index.js` (all names exist in `index.d.ts`):
```ts
export {
  s3Wrapper, getObjectFromKey,
  sqsWrapper, sqsEventAdapter,
  instrumentAWSClient, getTraceId, addTraceIdHeader,
  logWrapper, isAWSLambda,
  fetch, resetFetchContext, clearFetchCache,
  tracingFetch, SPACECAT_USER_AGENT,
  getStoredMetrics, storeMetrics, calculateCPCValue,
} from './index.js';
```

**`src/locale.d.ts`** — re-exports from `./index.js` (after removing the `type` keyword from `index.d.ts` line 378):
```ts
export { detectLocale } from './index.js';
```

**`src/calendar.d.ts`** — re-exports from `./index.js` (after adding the 5 missing declarations to `index.d.ts`). The 5 missing declarations to add to `index.d.ts` (derived from source):
```ts
interface DateRange {
  year: number;
  month: number;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
}
interface WeekInfo {
  week: number;
  year: number;
  month: number;
  temporalCondition: string;
}
interface MonthInfo {
  month: number;
  year: number;
  temporalCondition: string;
}
export function getDateRanges(week?: number, year?: number): DateRange[];
export function getWeekInfo(inputWeek?: number | null, inputYear?: number | null): WeekInfo;
export function getMonthInfo(inputMonth?: number | null, inputYear?: number | null): MonthInfo;
export function getTemporalCondition(options?: {
  week?: number;
  month?: number;
  year?: number;
  numSeries?: number;
  log?: object | null;
}): string;
export function getLastNumberOfWeeks(number: number): { week: number; year: number }[];
```

`calendar.d.ts` itself:
```ts
export {
  getDateRanges, getLastNumberOfWeeks, getWeekInfo,
  getMonthInfo, getTemporalCondition,
  isoCalendarWeek, isoCalendarWeekSunday, isoCalendarWeekMonday,
} from './index.js';
```

**`src/schemas.d.ts`** — cannot re-export from `./index.js` because `index.d.ts` exposes `schemas` as a namespace (`export * as schemas`), not as flat named exports. `schemas.js` exports exactly one value: `llmoConfig`, a Zod object with `.superRefine()` applied (type: `ZodEffects<ZodObject<...>>`). Complete file content:
```ts
import type { z } from 'zod';
export declare const llmoConfig: z.ZodEffects<z.ZodObject<any>>;
export type LLMOConfig = z.output<typeof llmoConfig>;
```

---

## Testing

### Modified test files

**`test/functions.test.js`**
Remove the `isValidEmail` import (line 35) and the entire `describe('isValidEmail', ...)` block (lines 316–350, inclusive — the closing `});` at line 350 must also be removed to avoid a dangling brace).

### New test files

**`test/email.test.js`**
Covers `src/email.js`. Required for the 100% line/statement coverage threshold. Move the `isValidEmail` test cases from `functions.test.js` here, importing from `../src/email.js`.

**`test/subpaths.test.js`**
Two responsibilities:

**1. Shape checks** — uses relative imports (not bare package specifiers, to ensure c8 instruments the correct file paths) and asserts a **hardcoded expected export list** for each barrel. Hardcoding is required: a runtime-derived list would not catch a developer accidentally adding or omitting an export. Full export lists are required for both `./core` and `./aws` (silent drops in the aws barrel cause hard Lambda runtime errors):

```js
import * as core from '../src/core.js';
import * as aws from '../src/aws.js';

const EXPECTED_CORE_EXPORTS = [
  'arrayEquals', 'dateAfterDays', 'deepEqual', 'hasText',
  'isArray', 'isBoolean', 'isInteger', 'isIsoDate', 'isIsoTimeOffsetsDate',
  'isNonEmptyArray', 'isNonEmptyObject', 'isNumber', 'isObject', 'isString',
  'isValidDate', 'isValidHelixPreviewUrl', 'isValidIMSOrgId', 'isValidUrl',
  'isValidUUID', 'toBoolean',
];

const EXPECTED_AWS_EXPORTS = [
  's3Wrapper', 'getObjectFromKey',
  'sqsWrapper', 'sqsEventAdapter',
  'instrumentAWSClient', 'getTraceId', 'addTraceIdHeader',
  'logWrapper', 'isAWSLambda',
  'fetch', 'resetFetchContext', 'clearFetchCache',
  'tracingFetch', 'SPACECAT_USER_AGENT',
  'getStoredMetrics', 'storeMetrics', 'calculateCPCValue',
];

it('core exports exactly the expected list', () => {
  expect(Object.keys(core).sort()).to.deep.equal(EXPECTED_CORE_EXPORTS.sort());
});

it('aws exports exactly the expected list', () => {
  expect(Object.keys(aws).sort()).to.deep.equal(EXPECTED_AWS_EXPORTS.sort());
});
```

Representative spot-checks are sufficient for `./locale`, `./calendar`, and `./schemas`.

**2. Dep hygiene check: `scripts/check-core-deps.js`**

A standalone Node.js script located at `packages/spacecat-shared-utils/scripts/check-core-deps.js` (inside the package directory, not the monorepo root — `pretest` runs with CWD set to the package directory). Uses esbuild's JS API. External packages appear in `metafile.inputs[file].imports` (not `metafile.outputs[chunk].imports`, which lists inter-chunk splits and is always empty for a single-entry bundle):

```js
// scripts/check-core-deps.js
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['src/core.js'],
  bundle: true,
  write: false,
  metafile: true,
  packages: 'external',
  logLevel: 'silent',
});

const external = [];
for (const [file, info] of Object.entries(result.metafile.inputs)) {
  for (const imp of info.imports) {
    if (imp.external) {
      external.push({ file, path: imp.path });
    }
  }
}

if (external.length > 0) {
  console.error('FAIL: src/core.js has unexpected external dependencies:');
  external.forEach((i) => console.error(` - ${i.file} imports ${i.path}`));
  process.exit(1);
}

console.log('OK: src/core.js has zero external dependencies.');
```

This script runs automatically via the `pretest` hook before every `npm test` invocation.

---

## Future Improvements

- **Approach B:** Replace the 4 `date-fns` functions in `calendar-week-helper.js` with native Date arithmetic. Eliminates 38MB for all consumers. Requires thorough tests for ISO week edge cases.
- **`./constants` sub-path:** `constants.js` is zero-dependency and widely used. A trivially safe follow-up addition.
