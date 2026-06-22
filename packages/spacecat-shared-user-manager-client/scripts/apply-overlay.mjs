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
 * live API's actual behaviour (see that file for CR1-CR2); this script just
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
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// js-yaml is a build-time devDependency (this script only runs in `npm run generate`,
// and the published package ships src/ only), so the production-import rule doesn't apply.
// eslint-disable-next-line import/no-extraneous-dependencies
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const SPEC_PATH = resolve(pkgRoot, 'build/openapi3.json');
const OVERLAY_PATH = resolve(pkgRoot, 'spec/overlays/corrections.yaml');

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
function parsePath(path) {
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
function select(doc, path) {
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

/** Deep-merges `src` into `target` (objects recurse; arrays and scalars overwrite). */
function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (isObject(v) && isObject(target[k])) {
      deepMerge(target[k], v);
    } else {
      // eslint-disable-next-line no-param-reassign
      target[k] = v;
    }
  }
  return target;
}

/** Removes matched refs: array items spliced high-to-low per container; object keys deleted. */
function removeRefs(refs) {
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

function applyAction(doc, action) {
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

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'));
const overlay = yaml.load(readFileSync(OVERLAY_PATH, 'utf-8'));
if (!Array.isArray(overlay?.actions) || overlay.actions.length === 0) {
  throw new Error(`Overlay ${OVERLAY_PATH} has no actions`);
}
for (const action of overlay.actions) {
  const hits = applyAction(spec, action);
  // eslint-disable-next-line no-console
  console.log(`overlay: ${action.remove ? 'remove' : 'update'} ${action.target} -> ${hits} node(s)`);
}
writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2), 'utf-8');
// eslint-disable-next-line no-console
console.log(`✔ overlay applied (${overlay.actions.length} actions) → ${SPEC_PATH}`);
