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
