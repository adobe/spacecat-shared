# Slim `spacecat-shared-utils` Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sub-path exports to `@adobe/spacecat-shared-utils` so consumers can import only what they need without pulling in the full ~110MB dependency tree.

**Architecture:** Extract `isValidEmail` to `src/email.js` to make `functions.js` zero-dep, then create thin barrel files (`core.js`, `aws.js`, `locale.js`, `calendar.js`) backed by sub-path exports in `package.json`. A CI script using esbuild verifies zero-dep invariants on `src/core.js` and `src/constants.js`, and that `src/schemas.js` only pulls in `zod`.

**Tech Stack:** Node.js ESM, esbuild (devDep, CI script only), Mocha/Chai for tests. No new runtime dependencies.

**Spec:** `packages/spacecat-shared-utils/docs/specs/2026-03-30-slim-utils-design.md`

---

## File Map

**New files:**
- `src/email.js` — `isValidEmail` extracted from `functions.js`
- `src/core.js` — barrel: re-exports all of `functions.js` (zero external deps)
- `src/aws.js` — barrel: S3/SQS/XRay/fetch/log utilities
- `src/locale.js` — barrel: `detectLocale`
- `src/calendar.js` — barrel: calendar utilities
- `src/core.d.ts` — TypeScript declarations for `./core`
- `src/aws.d.ts` — TypeScript declarations for `./aws`
- `src/locale.d.ts` — TypeScript declarations for `./locale`
- `src/calendar.d.ts` — TypeScript declarations for `./calendar`
- `src/schemas.d.ts` — TypeScript declarations for `./schemas`
- `src/constants.d.ts` — TypeScript declarations for `./constants`
- `scripts/check-subpath-deps.js` — esbuild dep hygiene CI script
- `test/email.test.js` — tests for `src/email.js`
- `test/subpaths.test.js` — shape checks for all barrel files

**Modified files:**
- `src/functions.js` — remove `isValidEmail` (import + body + export entry)
- `src/index.js` — remove `isValidEmail` from `functions.js` block, add re-export from `email.js`
- `src/index.d.ts` — add 8 missing declarations, fix `detectLocale` `type` keyword
- `package.json` — add exports map, `sideEffects`, esbuild devDep, `pretest` script
- `test/functions.test.js` — remove `isValidEmail` import and test block (moved to `email.test.js`)

**Note on test imports:** All tests import barrels using relative paths (`../src/core.js`, `../src/aws.js`, etc.) rather than the package specifier (`@adobe/spacecat-shared-utils/core`). This is required for two reasons: (1) the `exports` map isn't added until Task 5, so package-qualified imports would throw `ERR_PACKAGE_PATH_NOT_EXPORTED` in Tasks 2–4; (2) relative imports ensure c8 instruments the correct file paths for coverage. Never switch these to package-qualified imports.

**Note on formcalc.js exports:** `getHighFormViewsLowConversionMetrics`, `getHighPageViewsLowFormViewsMetrics`, `getHighPageViewsLowFormCtrMetrics`, and `FORMS_AUDIT_INTERVAL` are intentionally **not** in any sub-path barrel. They remain accessible only via the main `@adobe/spacecat-shared-utils` entry. Same applies to `url-helpers.js`, `helpers.js`, `bot-blocker-detect/`, `aem.js`, `aem-content-api-utils.js`, `url-extractors.js`, `aggregation/`, `llmo-config.js`, `llmo-strategy.js`, and `cdn-helpers.js`.

All paths below are relative to `packages/spacecat-shared-utils/` unless stated otherwise.

---

### Task 1: Extract `isValidEmail` to `src/email.js`

**Files:**
- Create: `test/email.test.js`
- Create: `src/email.js`
- Modify: `src/functions.js`
- Modify: `src/index.js`
- Modify: `test/functions.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/email.test.js`:

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

import { expect } from 'chai';

import { isValidEmail } from '../src/email.js';

describe('isValidEmail', () => {
  it('returns false for invalid email addresses', () => {
    const invalidEmails = [
      null,
      undefined,
      1234,
      true,
      '',
      'invalid-email',
      'test@',
      '@example.com',
      'test..test@example.com',
      'test@.com',
      'test@example.',
      'test@example..com',
      'test@example.com.',
      'test space@example.com',
      'test@example com',
    ];
    invalidEmails.forEach((email) => expect(isValidEmail(email)).to.be.false);
  });

  it('returns true for valid email addresses', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      'user123@subdomain.example.net',
      'firstname.lastname@company-name.com',
    ];
    validEmails.forEach((email) => expect(isValidEmail(email)).to.be.true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/spacecat-shared-utils && npx mocha test/email.test.js
```

Expected: error — `Cannot find module '../src/email.js'`

- [ ] **Step 3: Remove `isValidEmail` from `src/functions.js` (three removals)**

**3a.** Remove the import on line 13:
```js
import isEmail from 'validator/lib/isEmail.js';
```
Delete this line entirely.

**3b.** Remove the JSDoc + function body (lines 265–272):
```js
/**
 * Validates whether the given string is a valid email address.
 * @param {string} email - The string to validate.
 * @returns {boolean} True if the given string is a valid email address, false otherwise.
 */
function isValidEmail(email) {
  return typeof email === 'string' && isEmail(email);
}
```
Delete these 8 lines entirely.

**3c.** Remove `isValidEmail,` from the `export { }` block at the bottom. Change:
```js
  isValidDate,
  isValidEmail,
  isValidUrl,
```
to:
```js
  isValidDate,
  isValidUrl,
```

All three removals are required — omitting any one causes a startup error.

> **Do not commit between Steps 3–5.** After Step 3 the package is broken (`functions.js` no longer exports `isValidEmail` but `index.js` still re-exports it from there). Steps 4 and 5 restore the invariant. Complete all three before running tests.

- [ ] **Step 4: Create `src/email.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import isEmail from 'validator/lib/isEmail.js';

/**
 * Validates whether the given string is a valid email address.
 * @param {string} email - The string to validate.
 * @returns {boolean} True if the given string is a valid email address, false otherwise.
 */
export function isValidEmail(email) {
  return typeof email === 'string' && isEmail(email);
}
```

- [ ] **Step 5: Update `src/index.js`**

**5a.** Remove `isValidEmail` from the `functions.js` re-export block. Change:
```js
export {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidEmail,
  isValidUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
} from './functions.js';
```
to:
```js
export {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
} from './functions.js';
```

**5b.** Add the following line immediately after the `functions.js` re-export block:
```js
export { isValidEmail } from './email.js';
```

- [ ] **Step 6: Run tests to verify both test files pass**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: all tests pass. `isValidEmail` tests run in both `functions.test.js` (via `index.js` → `email.js`) and `email.test.js`.

- [ ] **Step 7: Remove duplicate `isValidEmail` tests from `test/functions.test.js`**

**7a.** Remove `isValidEmail,` from the import block (line 35). Change:
```js
import {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidEmail,
  isValidUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
} from '../src/index.js';
```
to:
```js
import {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
} from '../src/index.js';
```

**7b.** Remove the entire `describe('isValidEmail', ...)` block (lines 316–350, inclusive). Delete from:
```js
  describe('isValidEmail', () => {
```
through to and including the closing `});` at line 350.

- [ ] **Step 8: Run full test suite**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: all tests pass, 100% coverage maintained.

- [ ] **Step 9: Commit**

```bash
git add packages/spacecat-shared-utils/src/email.js \
        packages/spacecat-shared-utils/src/functions.js \
        packages/spacecat-shared-utils/src/index.js \
        packages/spacecat-shared-utils/test/email.test.js \
        packages/spacecat-shared-utils/test/functions.test.js
git commit -m "refactor(spacecat-shared-utils): extract isValidEmail to email.js"
```

---

### Task 2: Create `src/core.js` and dep hygiene script

**Files:**
- Create: `test/subpaths.test.js`
- Create: `src/core.js`
- Create: `scripts/check-subpath-deps.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing shape check test**

Create `test/subpaths.test.js`:

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

import { expect } from 'chai';

import * as core from '../src/core.js';

const EXPECTED_CORE_EXPORTS = [
  'arrayEquals', 'dateAfterDays', 'deepEqual', 'hasText',
  'isArray', 'isBoolean', 'isInteger', 'isIsoDate', 'isIsoTimeOffsetsDate',
  'isNonEmptyArray', 'isNonEmptyObject', 'isNumber', 'isObject', 'isString',
  'isValidDate', 'isValidHelixPreviewUrl', 'isValidIMSOrgId', 'isValidUrl',
  'isValidUUID', 'toBoolean',
];

describe('sub-path barrel shape checks', () => {
  it('core exports exactly the expected list', () => {
    expect(Object.keys(core).sort()).to.deep.equal(
      EXPECTED_CORE_EXPORTS.sort(),
      'Core exports changed. If you added a function to functions.js, update EXPECTED_CORE_EXPORTS in test/subpaths.test.js.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: error — `Cannot find module '../src/core.js'`

- [ ] **Step 3: Create `src/core.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidHelixPreviewUrl,
  isValidIMSOrgId,
  isValidUrl,
  isValidUUID,
  toBoolean,
} from './functions.js';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: `1 passing`

- [ ] **Step 5: Add esbuild devDependency and `pretest` script to `package.json`**

In `packages/spacecat-shared-utils/package.json`, add `"pretest"` to `"scripts"`:
```json
"pretest": "node scripts/check-subpath-deps.js",
"test": "c8 mocha"
```

Add `"esbuild"` to `"devDependencies"`:
```json
"esbuild": "0.27.4"
```

- [ ] **Step 6: Install esbuild**

```bash
cd packages/spacecat-shared-utils && npm install
```

Expected: esbuild appears in `node_modules/esbuild`.

- [ ] **Step 7: Create `scripts/check-subpath-deps.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * Dep hygiene check for enforced sub-paths:
 *   - src/core.js      → zero external deps
 *   - src/constants.js → zero external deps
 *   - src/schemas.js   → only 'zod' allowed
 *
 * Run automatically via the `pretest` npm hook before every `npm test` invocation.
 * Exit code 1 = violation found; exit code 0 = all checks passed.
 */

const CHECKS = [
  { entry: 'src/core.js', allowlist: [] },
  { entry: 'src/constants.js', allowlist: [] },
  { entry: 'src/schemas.js', allowlist: ['zod'] },
];

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  if (process.env.SKIP_DEP_CHECK === '1') {
    console.warn('WARN: esbuild not installed, dep check skipped (SKIP_DEP_CHECK=1).');
    process.exit(0);
  }
  console.error('FAIL: esbuild not installed. Run `npm install` before running tests.');
  process.exit(1);
}

let anyFailure = false;

for (const { entry, allowlist } of CHECKS) {
  // eslint-disable-next-line no-await-in-loop
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    metafile: true,
    packages: 'external',
    logLevel: 'silent',
  });

  const violations = [];
  for (const [file, info] of Object.entries(result.metafile.inputs)) {
    for (const imp of info.imports) {
      if (imp.external && !allowlist.includes(imp.path)) {
        violations.push({ file, path: imp.path });
      }
    }
  }

  if (violations.length > 0) {
    const allowed = allowlist.length > 0 ? ` (allowed: ${allowlist.join(', ')})` : ' (none allowed)';
    console.error(`FAIL: ${entry} has unexpected external dependencies${allowed}:`);
    violations.forEach((i) => console.error(`  - ${i.file} imports ${i.path}`));
    console.error(`  Fix: move the offending import to a file not re-exported from ${entry}.`);
    anyFailure = true;
  } else {
    const allowed = allowlist.length > 0 ? ` (allowed: ${allowlist.join(', ')})` : '';
    console.log(`OK: ${entry} dep check passed${allowed}.`);
  }
}

if (anyFailure) process.exit(1);
```

**Note on coverage:** `scripts/check-subpath-deps.js` is not covered by the Mocha test suite — it runs as a `pretest` script, not as a test. c8 does not instrument scripts launched via `pretest`. This is intentional and acceptable; the script itself acts as a test (exits non-zero on failure). No `.nycrc.json` exclusion is needed because c8 only instruments files loaded during `npm test`.

**Note on `./aws` and `./locale`:** These sub-paths are intentionally excluded from enforcement — they already pull in heavy deps (`@aws-sdk/*`, `cheerio`, etc.) and new deps are expected to be added. Enforcing only `./core`, `./constants`, and `./schemas` keeps the zero-dep invariant where it matters without blocking future development.

- [ ] **Step 8: Verify the script runs cleanly**

```bash
cd packages/spacecat-shared-utils && node scripts/check-subpath-deps.js
```

Expected output:
```
OK: src/core.js dep check passed.
OK: src/constants.js dep check passed.
OK: src/schemas.js dep check passed (allowed: zod).
```

If `core.js` or `constants.js` prints any `FAIL` lines, the functions.js modifications in Task 1 were incomplete — re-check that the validator import was fully removed.

- [ ] **Step 9: Run full test suite**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: `pretest` runs and prints `OK: ...`, then all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/spacecat-shared-utils/src/core.js \
        packages/spacecat-shared-utils/scripts/check-subpath-deps.js \
        packages/spacecat-shared-utils/test/subpaths.test.js \
        packages/spacecat-shared-utils/package.json \
        packages/spacecat-shared-utils/package-lock.json
git commit -m "feat(spacecat-shared-utils): add core.js barrel and dep hygiene CI script"
```

---

### Task 3: Create `src/aws.js` barrel

**Files:**
- Modify: `test/subpaths.test.js`
- Create: `src/aws.js`

- [ ] **Step 1: Add failing shape check for `aws` barrel**

In `test/subpaths.test.js`, add import at the top (after the existing `core` import):
```js
import * as aws from '../src/aws.js';
```

Add constant after `EXPECTED_CORE_EXPORTS`:
```js
const EXPECTED_AWS_EXPORTS = [
  's3Wrapper', 'getObjectFromKey',
  'sqsWrapper', 'sqsEventAdapter',
  'instrumentAWSClient', 'getTraceId', 'addTraceIdHeader',
  'logWrapper', 'isAWSLambda',
  'fetch', 'resetFetchContext', 'clearFetchCache',
  'tracingFetch', 'SPACECAT_USER_AGENT',
  'getStoredMetrics', 'storeMetrics', 'calculateCPCValue',
];
```

Add `it` block inside the existing `describe`:
```js
  it('aws exports exactly the expected list', () => {
    expect(Object.keys(aws).sort()).to.deep.equal(
      EXPECTED_AWS_EXPORTS.sort(),
      'AWS exports changed. Update EXPECTED_AWS_EXPORTS in test/subpaths.test.js to match the new barrel.',
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: error — `Cannot find module '../src/aws.js'`

- [ ] **Step 3: Create `src/aws.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export { s3Wrapper, getObjectFromKey } from './s3.js';
export { sqsWrapper, sqsEventAdapter } from './sqs.js';
export { instrumentAWSClient, getTraceId, addTraceIdHeader } from './xray.js';
export { logWrapper } from './log-wrapper.js';
export { isAWSLambda } from './runtimes.js';
export { fetch, resetFetchContext, clearFetchCache } from './adobe-fetch.js';
export { tracingFetch, SPACECAT_USER_AGENT } from './tracing-fetch.js';
export { getStoredMetrics, storeMetrics, calculateCPCValue } from './metrics-store.js';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: `2 passing`

- [ ] **Step 5: Run full test suite**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/spacecat-shared-utils/src/aws.js \
        packages/spacecat-shared-utils/test/subpaths.test.js
git commit -m "feat(spacecat-shared-utils): add aws.js sub-path barrel"
```

---

### Task 4: Create `src/locale.js` and `src/calendar.js` barrels

**Files:**
- Modify: `test/subpaths.test.js`
- Create: `src/locale.js`
- Create: `src/calendar.js`

Note: `src/constants.js` already exists (it's a source file, not a new barrel — same pattern as `src/schemas.js`). No new JS file is needed for `./constants`. The spot check, exports map entry, and `.d.ts` file are handled in Task 4, 5, and 6 respectively.

- [ ] **Step 1: Add spot checks to `test/subpaths.test.js`**

Add imports at the top (after the existing imports):
```js
import * as locale from '../src/locale.js';
import * as calendar from '../src/calendar.js';
import * as schemas from '../src/schemas.js';
import * as constants from '../src/constants.js';
```

Add `it` blocks inside the existing `describe`:
```js
  it('locale exports detectLocale', () => {
    expect(locale).to.have.property('detectLocale').that.is.a('function');
  });

  it('calendar exports expected functions', () => {
    const expected = [
      'isoCalendarWeek', 'isoCalendarWeekSunday', 'isoCalendarWeekMonday',
      'getDateRanges', 'getLastNumberOfWeeks', 'getWeekInfo',
      'getMonthInfo', 'getTemporalCondition',
    ];
    expected.forEach((name) => expect(calendar).to.have.property(name).that.is.a('function'));
  });

  it('schemas exports llmoConfig', () => {
    expect(schemas).to.have.property('llmoConfig');
  });

  it('constants exports OPPORTUNITY_TYPES and DEFAULT_CPC_VALUE', () => {
    expect(constants).to.have.property('OPPORTUNITY_TYPES').that.is.an('object');
    expect(constants).to.have.property('DEFAULT_CPC_VALUE').that.is.a('number');
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: error — `Cannot find module '../src/locale.js'`

- [ ] **Step 3: Create `src/locale.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/**
 * @sideeffect Importing this module initializes the @adobe/fetch HTTP connection pool
 * (h1() or h2() based on HELIX_FETCH_FORCE_HTTP1) at module load time, before any
 * detectLocale() call is made. In a VPC Lambda with restricted egress or no NAT gateway,
 * this can cause a silent hang at import time. Ensure your Lambda has outbound internet
 * access before importing this module.
 */
export { detectLocale } from './locale-detect/locale-detect.js';
```

- [ ] **Step 4: Create `src/calendar.js`**

```js
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {
  getDateRanges,
  getLastNumberOfWeeks,
  getWeekInfo,
  getMonthInfo,
  getTemporalCondition,
  isoCalendarWeek,
  isoCalendarWeekSunday,
  isoCalendarWeekMonday,
} from './calendar-week-helper.js';
```

- [ ] **Step 5: Run test to verify all spot checks pass**

```bash
cd packages/spacecat-shared-utils && npx mocha test/subpaths.test.js
```

Expected: `6 passing` (core, aws, locale, calendar, schemas, constants)

- [ ] **Step 6: Run full test suite**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/spacecat-shared-utils/src/locale.js \
        packages/spacecat-shared-utils/src/calendar.js \
        packages/spacecat-shared-utils/test/subpaths.test.js
git commit -m "feat(spacecat-shared-utils): add locale.js and calendar.js sub-path barrels"
```

---

### Task 5: Update `package.json` exports map and `sideEffects`

**Files:**
- Modify: `packages/spacecat-shared-utils/package.json`

- [ ] **Step 1: Replace the `exports` field with the new sub-path map**

In `packages/spacecat-shared-utils/package.json`, change:
```json
"exports": {
  ".": {
    "browser": "./src/browser.js",
    "default": "./src/index.js"
  }
},
```
to:
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
  },
  "./constants": {
    "types": "./src/constants.d.ts",
    "default": "./src/constants.js"
  }
},
```

- [ ] **Step 2: Add `sideEffects` field**

Add after the `"exports"` block:
```json
"sideEffects": [
  "./src/adobe-fetch.js",
  "./src/url-helpers.js"
],
```

These are the only two files with top-level imperative code (HTTP context initialization). Do **not** list barrel files — that would prevent tree-shaking.

- [ ] **Step 3: Document sub-path usage in `README.md`**

Add a section to `packages/spacecat-shared-utils/README.md` (append at the end or after the existing usage section):

```markdown
## Sub-path Exports

To avoid pulling in the full dependency tree (~110MB), import from a sub-path:

| Import | Dependencies |
|--------|-------------|
| `@adobe/spacecat-shared-utils` | All (~110MB) |
| `@adobe/spacecat-shared-utils/core` | None — pure JS only |
| `@adobe/spacecat-shared-utils/aws` | `@aws-sdk/*`, `aws-xray-sdk`, `@adobe/fetch` |
| `@adobe/spacecat-shared-utils/locale` | `cheerio`, `world-countries`, `franc-min`, `iso-639-3`, `@adobe/fetch` ⚠ **Side effect:** initializes HTTP connection pool at import time — requires outbound internet access |
| `@adobe/spacecat-shared-utils/calendar` | `date-fns` |
| `@adobe/spacecat-shared-utils/schemas` | `zod` |
| `@adobe/spacecat-shared-utils/constants` | None — pure data |

### TypeScript

Sub-path exports require `"moduleResolution": "node16"`, `"nodenext"`, or `"bundler"` in `tsconfig.json`. Legacy `"moduleResolution": "node"` does not resolve sub-path exports.

### Maintenance

Any new `src/` file that contains top-level imperative code (anything beyond `import`/`export` statements) must be added to the `sideEffects` array in `package.json`.
```

- [ ] **Step 4: Run full test suite**

```bash
cd packages/spacecat-shared-utils && npm test
```

Expected: all tests pass. The `exports` map does not affect test execution (tests use relative `../src/` imports).

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-utils/package.json \
        packages/spacecat-shared-utils/README.md
git commit -m "feat(spacecat-shared-utils): add sub-path exports map and sideEffects to package.json"
```

---

### Task 6: Type declarations

**Files:**
- Modify: `src/index.d.ts`
- Create: `src/core.d.ts`
- Create: `src/aws.d.ts`
- Create: `src/locale.d.ts`
- Create: `src/calendar.d.ts`
- Create: `src/schemas.d.ts`

- [ ] **Step 1: Fix `src/index.d.ts` — remove `type` keyword from `detectLocale` export**

On line 378, change:
```ts
export { type detectLocale } from './locale-detect/index.js';
```
to:
```ts
export { detectLocale } from './locale-detect/index.js';
```

This makes `detectLocale` a value-level export so `locale.d.ts` can forward it.

- [ ] **Step 2: Add three missing function declarations to `src/index.d.ts`**

Add near the other AWS-related declarations — after this existing block:
```ts
export function s3Wrapper(fn: (request: object, context: object) => Promise<Response>):
  (request: object, context: object) => Promise<Response>;
```
```ts
export function isAWSLambda(): boolean;
export function resetFetchContext(): void;
export function clearFetchCache(): void;
```

- [ ] **Step 3: Add five missing calendar declarations to `src/index.d.ts`**

Add before or after the existing `isoCalendarWeek` declaration (around line 346):
```ts
interface DateRange {
  year: number;
  month: number;
  startTime: string;
  endTime: string;
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

- [ ] **Step 4: Create `src/core.d.ts`**

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {
  arrayEquals, dateAfterDays, deepEqual, hasText,
  isArray, isBoolean, isInteger, isIsoDate, isIsoTimeOffsetsDate,
  isNonEmptyArray, isNonEmptyObject, isNumber, isObject, isString,
  isValidDate, isValidHelixPreviewUrl, isValidIMSOrgId, isValidUrl,
  isValidUUID, toBoolean,
} from './index.js';
```

- [ ] **Step 5: Create `src/aws.d.ts`**

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

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

- [ ] **Step 6: Create `src/locale.d.ts`**

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export { detectLocale } from './index.js';
```

- [ ] **Step 7: Create `src/calendar.d.ts`**

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {
  getDateRanges, getLastNumberOfWeeks, getWeekInfo,
  getMonthInfo, getTemporalCondition,
  isoCalendarWeek, isoCalendarWeekSunday, isoCalendarWeekMonday,
} from './index.js';
```

- [ ] **Step 8: Create `src/schemas.d.ts`**

`schemas.d.ts` cannot re-export from `./index.js` because `index.d.ts` exposes `schemas` as a namespace (`export * as schemas`), not flat named exports. It declares types directly:

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type * as z from 'zod';

export declare const llmoConfig: z.ZodEffects<z.ZodObject<any>>;
export type LLMOConfig = z.output<typeof llmoConfig>;
```

- [ ] **Step 9: Create `src/constants.d.ts`**

`OPPORTUNITY_TYPES` and `DEFAULT_CPC_VALUE` are already declared in `index.d.ts`, so this is a simple re-export:

```ts
/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export { OPPORTUNITY_TYPES, DEFAULT_CPC_VALUE } from './index.js';
```

- [ ] **Step 10: Run full test suite and lint**

```bash
cd packages/spacecat-shared-utils && npm test && npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 11: Commit**

```bash
git add packages/spacecat-shared-utils/src/index.d.ts \
        packages/spacecat-shared-utils/src/core.d.ts \
        packages/spacecat-shared-utils/src/aws.d.ts \
        packages/spacecat-shared-utils/src/locale.d.ts \
        packages/spacecat-shared-utils/src/calendar.d.ts \
        packages/spacecat-shared-utils/src/schemas.d.ts \
        packages/spacecat-shared-utils/src/constants.d.ts
git commit -m "feat(spacecat-shared-utils): add TypeScript declarations for sub-path exports"
```
