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

import { expect } from 'chai';
import {
  readFileSync, writeFileSync, mkdtempSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import {
  join, resolve, dirname,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import sinon from 'sinon';
import yaml from 'js-yaml';
import swagger2openapi from 'swagger2openapi';
import {
  parsePath,
  select,
  deepMerge,
  applyAction,
  applyOverlay,
  main,
} from '../scripts/apply-overlay.mjs';

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDORED_SPEC = resolve(PKG_ROOT, 'spec/usermanager_swagger.yaml');
const OVERLAY = resolve(PKG_ROOT, 'spec/overlays/corrections.yaml');

/** Reproduces `npm run spec:convert`: the vendored swagger 2.0 → the OAS3 doc the overlay edits. */
async function convertVendoredSpec() {
  const swagger = yaml.load(readFileSync(VENDORED_SPEC, 'utf-8'));
  const { openapi } = await swagger2openapi.convertObj(swagger, { patch: true });
  return openapi;
}

describe('apply-overlay: parsePath', () => {
  it('parses key, bracketed-key, wildcard and filter segments', () => {
    const steps = parsePath("$.paths['/v2/x'].*.parameters[?(@.name == 'Auth-Data-Jwt')]");
    expect(steps).to.deep.equal([
      { type: 'key', key: 'paths' },
      { type: 'key', key: '/v2/x' },
      { type: 'wild' },
      { type: 'key', key: 'parameters' },
      { type: 'filter', key: 'name', value: 'Auth-Data-Jwt' },
    ]);
  });

  it('throws when the target does not start with $', () => {
    expect(() => parsePath('paths.x')).to.throw(/must start with/);
  });

  it('throws on an unsupported segment', () => {
    // after `$` the remainder must start with `.` or `[`; a bare word matches no matcher
    expect(() => parsePath('$foo')).to.throw(/Unsupported JSONPath segment/);
  });
});

describe('apply-overlay: deepMerge', () => {
  it('recurses into objects and overwrites scalars/arrays', () => {
    const target = { a: { x: 1, y: 2 }, list: [1, 2], scalar: 'old' };
    deepMerge(target, { a: { y: 9, z: 3 }, list: [3], scalar: 'new' });
    expect(target).to.deep.equal({ a: { x: 1, y: 9, z: 3 }, list: [3], scalar: 'new' });
  });

  it('skips prototype-pollution keys (no Object.prototype mutation)', () => {
    const target = {};
    deepMerge(target, JSON.parse('{ "__proto__": { "polluted": true }, "ok": 1 }'));
    expect(target.ok).to.equal(1);
    expect({}.polluted).to.equal(undefined);
    expect(Object.prototype).to.not.have.property('polluted');
  });
});

describe('apply-overlay: select', () => {
  it('resolves a wildcard over object values', () => {
    const doc = { paths: { '/a': { get: {} }, '/b': { post: {} } } };
    const refs = select(doc, '$.paths.*');
    expect(refs.map((r) => r.key)).to.deep.equal(['/a', '/b']);
  });
});

describe('apply-overlay: applyAction', () => {
  it('update deep-merges into the targeted node', () => {
    const doc = { components: { securitySchemes: {} } };
    const hits = applyAction(doc, {
      target: '$.components.securitySchemes',
      update: { imsBearer: { type: 'http', scheme: 'bearer' } },
    });
    expect(hits).to.equal(1);
    expect(doc.components.securitySchemes.imsBearer).to.deep.equal({ type: 'http', scheme: 'bearer' });
  });

  it('update creates the node as an object when the target is absent/non-object', () => {
    const doc = { components: {} };
    applyAction(doc, { target: '$.components.securitySchemes', update: { a: 1 } });
    expect(doc.components.securitySchemes).to.deep.equal({ a: 1 });
  });

  it('update throws when it matches no node', () => {
    const doc = { paths: {} };
    expect(() => applyAction(doc, {
      target: "$.paths['/missing'].get",
      update: { summary: 'x' },
    })).to.throw(/matched no node/);
  });

  it('remove deletes a targeted object key', () => {
    const doc = { paths: { '/a': { get: {} } } };
    const hits = applyAction(doc, { target: "$.paths['/a']", remove: true });
    expect(hits).to.equal(1);
    expect(doc.paths).to.deep.equal({});
  });

  it('remove deletes filtered array items (high-to-low, leaving siblings intact)', () => {
    const doc = {
      params: [
        { name: 'Auth-Data-Jwt' },
        { name: 'id' },
        { name: 'Auth-Data-Jwt' },
      ],
    };
    const hits = applyAction(doc, {
      target: "$.params[?(@.name == 'Auth-Data-Jwt')]",
      remove: true,
    });
    expect(hits).to.equal(2);
    expect(doc.params).to.deep.equal([{ name: 'id' }]);
  });

  it('remove returns 0 (no throw) when it matches nothing', () => {
    const doc = { params: [{ name: 'id' }] };
    const hits = applyAction(doc, {
      target: "$.params[?(@.name == 'Auth-Data-Jwt')]",
      remove: true,
    });
    expect(hits).to.equal(0);
    expect(doc.params).to.deep.equal([{ name: 'id' }]);
  });

  it('throws when the action has neither update nor remove', () => {
    expect(() => applyAction({}, { target: '$.x' })).to.throw(/must have 'update' or 'remove'/);
  });
});

describe('apply-overlay: applyOverlay', () => {
  it('applies every action and returns the total + per-action results (prints nothing)', () => {
    const doc = { paths: { '/a': { get: {} } }, components: {} };
    const { total, results } = applyOverlay(doc, {
      actions: [
        { target: '$.components.x', update: { v: 1 } },
        { target: "$.paths['/a']", remove: true },
      ],
    });
    expect(total).to.equal(2);
    expect(doc.components.x).to.deep.equal({ v: 1 });
    expect(doc.paths).to.deep.equal({});
    expect(results).to.deep.equal([
      {
        target: '$.components.x', remove: false, hits: 1, staleRemove: false,
      },
      {
        target: "$.paths['/a']", remove: true, hits: 1, staleRemove: false,
      },
    ]);
  });

  it('throws when the overlay has no actions', () => {
    expect(() => applyOverlay({}, { actions: [] })).to.throw(/no actions/);
    expect(() => applyOverlay({}, {})).to.throw(/no actions/);
  });

  it('flags a 0-match remove via staleRemove (does not throw, prints nothing)', () => {
    const { total, results } = applyOverlay({ params: [{ name: 'id' }] }, {
      actions: [{ target: "$.params[?(@.name == 'gone')]", remove: true }],
    });
    expect(total).to.equal(0);
    expect(results).to.deep.equal([
      {
        target: "$.params[?(@.name == 'gone')]", remove: true, hits: 0, staleRemove: true,
      },
    ]);
  });
});

// The freshness gate (mirrors project-engine-client #1733): every correction in corrections.yaml
// must still do real work against the swagger we vendor. This runs the SAME pipeline as
// `npm run spec:convert` (vendored swagger 2.0 → OAS3) and then applies each correction, asserting
// it both still applies (matches >0 nodes) and is still necessary (actually changes the spec). It
// is fully offline — no live API, no credentials, no cron — so a re-vendored swagger that makes a
// correction stale or redundant fails CI here, instead of drifting silently until the next manual
// live-capture pass.
describe('apply-overlay: freshness gate (corrections vs the vendored swagger)', () => {
  it('every correction still applies (>0 nodes) and is still necessary (changes the spec)', async () => {
    const spec = await convertVendoredSpec();
    const overlay = yaml.load(readFileSync(OVERLAY, 'utf-8'));
    expect(overlay.actions.length, 'the overlay must declare at least one correction').to.be.greaterThan(0);

    for (const action of overlay.actions) {
      const label = action.description || action.target;
      const before = structuredClone(spec);
      // A 0-match `update` throws from applyAction; a 0-match `remove` returns 0 (caught below).
      // Actions apply in order to the running doc, as applyOverlay/main run them.
      const hits = applyAction(spec, action);
      expect(
        hits,
        `correction matched 0 nodes — it is STALE (upstream moved/removed the target): ${label}`,
      ).to.be.greaterThan(0);
      expect(
        spec,
        `correction is a no-op — it is REDUNDANT (the vendored swagger already declares it): ${label}`,
      ).to.not.deep.equal(before);
    }
  });
});

describe('apply-overlay: main (CLI exit code)', () => {
  const sandbox = sinon.createSandbox();
  let tmp;
  let logger;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'um-overlay-'));
    logger = { log: sandbox.spy(), error: sandbox.spy() };
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    sandbox.restore();
  });

  const errorOutput = () => logger.error.getCalls().map((c) => c.args.join(' ')).join('\n');

  it('returns 0, applies the overlay, and writes the spec back', () => {
    const specPath = join(tmp, 'openapi3.json');
    const overlayPath = join(tmp, 'corrections.yaml');
    writeFileSync(specPath, JSON.stringify({ paths: { '/a': { get: {} } }, components: {} }));
    writeFileSync(overlayPath, yaml.dump({
      actions: [
        { target: '$.components.x', update: { v: 1 } },
        { target: "$.paths['/a']", remove: true },
      ],
    }));

    const code = main({ specPath, overlayPath, logger });

    expect(code).to.equal(0);
    expect(logger.error.called).to.equal(false);
    const written = JSON.parse(readFileSync(specPath, 'utf-8'));
    expect(written.components.x).to.deep.equal({ v: 1 });
    expect(written.paths).to.deep.equal({});
  });

  it('returns 1 and reports every stale (0-match remove) correction', () => {
    const specPath = join(tmp, 'openapi3.json');
    const overlayPath = join(tmp, 'corrections.yaml');
    writeFileSync(specPath, JSON.stringify({ params: [{ name: 'id' }] }));
    writeFileSync(overlayPath, yaml.dump({
      actions: [{ target: "$.params[?(@.name == 'gone')]", remove: true }],
    }));

    const code = main({ specPath, overlayPath, logger });

    expect(code).to.equal(1);
    expect(errorOutput()).to.include('stale correction');
    expect(errorOutput()).to.include("$.params[?(@.name == 'gone')]");
  });
});
