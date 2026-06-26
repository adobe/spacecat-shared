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

/**
 * Applies the OpenAPI Overlay in spec/overlays/corrections.yaml to the
 * swagger2openapi output build/openapi3.json, in place. The overlay is the single
 * source of truth for the corrections that align the vendored swagger with the
 * live API's actual behaviour (see that file for CR1-CR3); this script just
 * executes it. The vendored spec/usermanager_swagger.yaml is never modified.
 *
 * It implements the subset of the Overlay spec the overlay uses — `update`
 * (deep-merge into the targeted node) and `remove` (delete the targeted node) —
 * with a small JSONPath dialect:
 *   - `$`                       root
 *   - `.key`  /  ['key']        property access
 *   - `.*`    /  [*]            wildcard over an object's values or an array's items
 *   - [?(@.field == 'value')]   filter array items by a string field
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
// js-yaml is a build-time devDependency (this script only runs in `npm run generate`,
// and the published package ships src/ only), so the production-import rule doesn't apply.
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';

const SEGMENT_MATCHERS = [
  // [?(@.name == 'Auth-Data-Jwt')]
  [/^\[\?\(@\.([A-Za-z0-9_]+)\s*==\s*'([^']*)'\)\]/, (m) => ({ type: 'filter', key: m[1], value: m[2] })],
  [/^\[\*\]/, () => ({ type: 'wild' })],
  [/^\.\*/, () => ({ type: 'wild' })],
  // ['/v2/.../projects'] or ["x"]
  [/^\['([^']*)'\]/, (m) => ({ type: 'key', key: m[1] })],
  [/^\["([^"]*)"\]/, (m) => ({ type: 'key', key: m[1] })],
  [/^\.([^.[]+)/, (m) => ({ type: 'key', key: m[1] })],
];

/** Consumes one leading segment of `rest`, returning `{ step, rest }` or null if none matches. */
function nextSegment(rest) {
  for (const [re, make] of SEGMENT_MATCHERS) {
    const m = rest.match(re);
    if (m) {
      return { step: make(m), rest: rest.slice(m[0].length) };
    }
  }
  return null;
}

/** Tokenises a supported JSONPath into a list of steps. */
export function parsePath(path) {
  if (!path.startsWith('$')) {
    throw new Error(`Overlay target must start with '$': ${path}`);
  }
  const steps = [];
  let rest = path.slice(1);
  while (rest.length > 0) {
    const parsed = nextSegment(rest);
    if (!parsed) {
      throw new Error(`Unsupported JSONPath segment near: ${rest}`);
    }
    steps.push(parsed.step);
    rest = parsed.rest;
  }
  return steps;
}

/** Expands one step against one node into the next `{ container, key }` refs. */
function stepRefs(step, node, refs) {
  if (step.type === 'key') {
    refs.push({ container: node, key: step.key });
    return;
  }
  if (step.type === 'wild') {
    if (Array.isArray(node)) {
      node.forEach((_, i) => refs.push({ container: node, key: i }));
    } else if (node && typeof node === 'object') {
      Object.keys(node).forEach((k) => refs.push({ container: node, key: k }));
    }
    return;
  }
  if (step.type === 'filter' && Array.isArray(node)) {
    node.forEach((el, i) => {
      if (el && el[step.key] === step.value) {
        refs.push({ container: node, key: i });
      }
    });
  }
}

/**
 * Resolves a JSONPath to a list of `{ container, key }` references, so both `update`
 * (mutate `container[key]`) and `remove` (delete `container[key]`) can act on the result.
 */
export function select(doc, path) {
  let refs = [{ container: { $root: doc }, key: '$root' }];
  for (const step of parsePath(path)) {
    const next = [];
    for (const ref of refs) {
      const node = ref.container[ref.key];
      if (node !== null && node !== undefined) {
        stepRefs(step, node, next);
      }
    }
    refs = next;
  }
  return refs;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Keys that would let a hand-edited overlay reach Object.prototype through deepMerge. No
// legitimate OpenAPI node key is one of these, so they are skipped defensively.
const PROTO_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Deep-merges `src` into `target` (objects recurse; arrays and scalars overwrite). */
export function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (!PROTO_POLLUTION_KEYS.has(k)) {
      if (isObject(v) && isObject(target[k])) {
        deepMerge(target[k], v);
      } else {
        // eslint-disable-next-line no-param-reassign
        target[k] = v;
      }
    }
  }
  return target;
}

/** Removes matched refs: array items spliced high-to-low per container; object keys deleted. */
export function removeRefs(refs) {
  const byContainer = new Map();
  for (const ref of refs) {
    if (typeof ref.key === 'number') {
      const indices = byContainer.get(ref.container) || [];
      indices.push(ref.key);
      byContainer.set(ref.container, indices);
    } else {
      delete ref.container[ref.key];
    }
  }
  for (const [container, indices] of byContainer) {
    indices.sort((a, b) => b - a).forEach((i) => container.splice(i, 1));
  }
}

export function applyAction(doc, action) {
  const refs = select(doc, action.target);
  if (action.remove) {
    removeRefs(refs);
    return refs.length;
  }
  if (action.update !== undefined) {
    if (refs.length === 0) {
      throw new Error(`Overlay update matched no node: ${action.target}`);
    }
    for (const ref of refs) {
      if (!isObject(ref.container[ref.key])) {
        ref.container[ref.key] = {};
      }
      deepMerge(ref.container[ref.key], action.update);
    }
    return refs.length;
  }
  throw new Error(`Overlay action must have 'update' or 'remove': ${action.target}`);
}

/**
 * @typedef {object} OverlayActionResult
 * @property {string} target the action's JSONPath target
 * @property {boolean} remove whether the action was a remove (vs an update)
 * @property {number} hits how many nodes the action touched
 * @property {boolean} staleRemove true when a `remove` matched 0 nodes (the correction is now a
 *   no-op — a valid future state once the upstream spec drops the node, but worth pruning)
 */

/**
 * Applies every action of an overlay document to `spec` in place and returns a structured result
 * per action — it prints NOTHING, so a programmatic caller gets no stray stdout; user-facing
 * logging is the CLI {@link main}'s job. A 0-match `remove` is surfaced via `staleRemove` rather
 * than passing silently; a 0-match `update` DOES throw (see {@link applyAction}), since updating a
 * node that has moved is a genuine miss.
 * @param {object} spec the OAS3 document to mutate in place
 * @param {{ actions?: Array<object> }} overlay
 * @returns {{ total: number, results: OverlayActionResult[] }}
 */
export function applyOverlay(spec, overlay) {
  if (!Array.isArray(overlay?.actions) || overlay.actions.length === 0) {
    throw new Error('Overlay has no actions');
  }
  const results = [];
  let total = 0;
  for (const action of overlay.actions) {
    const hits = applyAction(spec, action);
    total += hits;
    const remove = Boolean(action.remove);
    results.push({
      target: action.target, remove, hits, staleRemove: remove && hits === 0,
    });
  }
  return { total, results };
}

/**
 * CLI entry: read the converted spec + the overlay, apply in place, log, write back.
 *
 * Returns a process exit code so the build fails loudly when a correction has gone stale: a
 * 0-match `remove` (`staleRemove`) means upstream may have caught up and the correction should be
 * pruned, so we exit 1. (A 0-match `update` throws from {@link applyAction} and aborts before any
 * write — also a hard failure.) Paths and the logger are injectable so the behaviour is testable
 * without spawning a subprocess; the defaults target this package's real build artefact.
 *
 * @param {object} [opts]
 * @param {string} [opts.specPath] OAS3 doc to overlay (default: build/openapi3.json)
 * @param {string} [opts.overlayPath] overlay file (default: spec/overlays/corrections.yaml)
 * @param {Pick<Console, 'log' | 'error'>} [opts.logger] sink for progress + failure output
 * @returns {number} process exit code — 0 on success, 1 when any correction is stale
 */
export function main({ specPath, overlayPath, logger = console } = {}) {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, '..');
  const resolvedSpecPath = specPath ?? resolve(pkgRoot, 'build/openapi3.json');
  const resolvedOverlayPath = overlayPath ?? resolve(pkgRoot, 'spec/overlays/corrections.yaml');
  const spec = JSON.parse(readFileSync(resolvedSpecPath, 'utf-8'));
  const overlay = yaml.load(readFileSync(resolvedOverlayPath, 'utf-8'));
  const { results } = applyOverlay(spec, overlay);
  const stale = [];
  for (const r of results) {
    logger.log(`overlay: ${r.remove ? 'remove' : 'update'} ${r.target} -> ${r.hits} node(s)`);
    if (r.staleRemove) {
      stale.push(r.target);
    }
  }
  writeFileSync(resolvedSpecPath, JSON.stringify(spec, null, 2), 'utf-8');
  if (stale.length > 0) {
    logger.error(`overlay: FAIL ${stale.length} stale correction(s) matched 0 nodes — upstream may have caught up; prune them from corrections.yaml:`);
    for (const target of stale) {
      logger.error(`overlay:   - ${target}`);
    }
    return 1;
  }
  logger.log(`✔ overlay applied (${results.length} actions) → ${resolvedSpecPath}`);
  return 0;
}

// Run only when executed directly (`node scripts/apply-overlay.mjs`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
