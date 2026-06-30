/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// @ts-check

/**
 * Mock runner for the User Manager Counterfact server.
 *
 * Counterfact discovers handlers from files under `<basePath>/routes`. This runner materializes
 * our committed handlers into the gitignored `.counterfact/` scratch dir, then launches
 * Counterfact in serve-only mode (see {@link launch} — NO `generate`, so nothing is auto-stubbed;
 * an unhandled path 404s). Every endpoint the consumer (spacecat-api-service `rest-transport.js`)
 * calls therefore has an explicit handler under `mock/counterfact/routes/**` — the sub-workspace
 * lifecycle spine (child create, status, family, resources transfer, delete). The shared store
 * lives in `routes/_lib/` and is wired in via a generated root `_.context.js` that re-exports
 * {@link Context}, injecting the seed selected by `MOCK_SEED`.
 *
 * Everything is materialized with a `.ts` extension on purpose. On stock Node, Counterfact
 * cannot execute TS natively (its probe needs `.js`->`.ts` specifier resolution, off by
 * default), so it transpiles `routes/**` to `.cache/**`. The transpiler is built for the TS
 * convention: a `.ts` source emits a `.cjs` file and every relative `.js` import specifier is
 * rewritten to `.cjs`. Two things break if we ship `.js` sources instead: (1) a `.js` source
 * keeps its `.js` name but gets CommonJS *content*, which Node parses as ESM under this
 * package's `"type": "module"` and rejects; (2) the rewritten `.cjs` specifiers then point at
 * files that were never renamed. Shipping `.ts` makes the whole tree emit `.cjs` with matching
 * specifiers, which load as CommonJS regardless of package type. In native-ESM mode (probe
 * passes) the same `.ts` files run directly, with `.js` imports resolving to their `.ts`
 * siblings. The committed sources stay `.js`; only the materialized copies are `.ts`.
 *
 * `_lib/` sits *inside* the `routes` tree so those rewritten imports resolve to transpiled
 * siblings. The `_lib/*` files register as unreachable (method-less) routes — harmless, and
 * not present in the spec.
 *
 * The spec fed to Counterfact is `build/openapi3.json` — the OAS3 artifact produced by
 * `npm run generate` (swagger2openapi conversion → overlay corrections applied in place). The
 * corrected artifact drives Counterfact's response VALIDATION (response validation stays on), so
 * the overlay corrections (e.g. the status object retype, CR2) are what our handlers are checked
 * against. Counterfact honours a Swagger-2.0 `basePath` as a serving prefix but silently ignores
 * OAS3 `servers[0].url`, so we pass `--prefix /enterprise/users/api` explicitly.
 * `build/openapi3.json` is gitignored — run `npm run generate` once before `npm run mock`.
 *
 * Request validation is ENABLED (Counterfact's default — no `--no-validate-request`): the
 * overlay-corrected spec is the request contract. This is safe because CR1 removes the spec's
 * required `Auth-Data-Jwt` HEADER param from every operation (it was the only header param, and a
 * required header would 400 every request — the validator matches case-sensitively against Node's
 * lowercased inbound headers). Response validation also stays on so envelope mismatches surface.
 *
 * Bearer auth is modelled by {@link injectAuthGuard}, which prepends a
 * `context.authError($.headers)` gate to every materialized handler: a real route without
 * `Authorization: Bearer <token>` gets the live gateway's `401 { detail: 'Not authenticated' }`.
 * The `__*` control routes stay exempt. See mock/auth.js.
 *
 * Excluded from coverage: requires a live server, validated via `npm run mock` (see README).
 */

import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, parse as parsePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectAuthGuard } from './inject-auth-guard.js';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, '..');

const SPEC = join(packageRoot, 'build', 'openapi3.json');
const BASE_PATH = join(packageRoot, '.counterfact');
const ROUTES_DIR = join(BASE_PATH, 'routes');
const LIB_DIR = join(ROUTES_DIR, '_lib');
const PORT = process.env.MOCK_PORT ?? '4010';

/**
 * Lib modules the Context depends on, copied into `routes/_lib/` as `.ts`. Derived from the actual
 * `mock/*.js` files (every one except the runner's own modules, `run.js` + `inject-auth-guard.js`)
 * rather than a hand-maintained list — so a new module imported by `context.js` is materialized
 * automatically, with no second list to keep in sync. `counterfact/` is a dir, so the `.js` filter
 * skips it.
 */
const LIB_FILES = readdirSync(here)
  .filter((f) => f.endsWith('.js') && f !== 'run.js' && f !== 'inject-auth-guard.js');

/** Generated root context: re-export Context, injecting the runtime seed selection. */
const ROOT_CONTEXT = `// Generated by run.js — do not edit. Wires the shared stateful store into Counterfact.
import { Context as Base } from './_lib/context.js';

export class Context extends Base {
  constructor(args) {
    // MOCK_SEED_FILE (a JSON Snapshot path) takes precedence over the named MOCK_SEED.
    super({ ...args, seed: process.env.MOCK_SEED, seedFile: process.env.MOCK_SEED_FILE });
  }
}
`;

/**
 * Recursively copies the committed `.js` handler tree to `dest`, renaming each file to `.ts`
 * so Counterfact's transpiler emits `.cjs` (see the module header for why `.js` would break).
 * Each handler gets the bearer-auth guard injected ({@link injectAuthGuard}); the handlers are
 * otherwise plain JS that is valid TS.
 * @param {string} src source directory
 * @param {string} dest destination directory
 */
function copyTreeAsTs(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    if (entry.isDirectory()) {
      copyTreeAsTs(from, join(dest, entry.name));
    } else {
      const renamed = entry.name.replace(/\.js$/, '.ts');
      writeFileSync(join(dest, renamed), injectAuthGuard(readFileSync(from, 'utf8'), entry.name));
    }
  }
}

function materialize() {
  if (!existsSync(SPEC)) {
    process.stderr.write('Error: build/openapi3.json not found. Run `npm run generate` first.\n');
    process.exit(1);
  }
  // Clear the whole scratch dir (routes + the transpile .cache) so stale compiled handlers
  // from a previous run never shadow the freshly materialized source.
  rmSync(BASE_PATH, { recursive: true, force: true });
  copyTreeAsTs(join(here, 'counterfact', 'routes'), ROUTES_DIR);
  mkdirSync(LIB_DIR, { recursive: true });
  for (const file of LIB_FILES) {
    writeFileSync(join(LIB_DIR, file.replace(/\.js$/, '.ts')), readFileSync(join(here, file), 'utf8'));
  }
  writeFileSync(join(ROUTES_DIR, '_.context.ts'), ROOT_CONTEXT);
}

/**
 * Locates the counterfact CLI entry. Its `exports` map blocks subpath resolution, so we walk
 * `node_modules` upward (handles both per-package and hoisted monorepo installs) and read the
 * `bin` field directly.
 * @returns {string} absolute path to the CLI script
 */
function findCounterfactBin() {
  let dir = packageRoot;
  for (;;) {
    const pkgDir = join(dir, 'node_modules', 'counterfact');
    const pkgJson = join(pkgDir, 'package.json');
    if (existsSync(pkgJson)) {
      const { bin } = JSON.parse(readFileSync(pkgJson, 'utf8'));
      const rel = typeof bin === 'string' ? bin : bin.counterfact;
      return join(pkgDir, rel);
    }
    const parent = parsePath(dir).dir;
    if (parent === dir) {
      throw new Error('Could not locate the counterfact package under any node_modules.');
    }
    dir = parent;
  }
}

function launch() {
  // `--serve` is passed explicitly so Counterfact does NOT default to running every action.
  // With no action flag it enables `generate`, which appends a typed `random()` stub for each
  // spec operation onto our materialized handler files — producing duplicate `GET`/`POST`
  // declarations. An explicit `--serve` skips that defaulting: the server still transpiles and
  // loads our handlers, but generates nothing, so our stateful handlers stand alone.
  //
  // NOTE: Counterfact 2.14.0 hardcodes `koaApp.listen({ port })` with no host option and exposes
  // no `--host` flag, so the server binds all interfaces — the auth-exempt `__*` control routes
  // (full state read/replace) are reachable on the host's network. This is a dev/CI-only mock on
  // ephemeral ports, so it is acceptable; if a future Counterfact adds a host/bind option, pin it
  // to loopback (127.0.0.1) here to keep the control surface local-only.
  const child = spawn(
    process.execPath,
    [findCounterfactBin(), SPEC, BASE_PATH, '--port', String(PORT), '--serve',
      '--prefix', '/enterprise/users/api', '--no-update-check'],
    { stdio: 'inherit', cwd: packageRoot },
  );
  child.on('exit', (code) => process.exit(code ?? 0));
}

materialize();
launch();
