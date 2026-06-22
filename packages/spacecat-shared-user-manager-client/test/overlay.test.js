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
import sinon from 'sinon';
import {
  parsePath,
  select,
  deepMerge,
  applyAction,
  applyOverlay,
} from '../scripts/apply-overlay.mjs';

const sandbox = sinon.createSandbox();

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
  afterEach(() => sandbox.restore());

  it('applies every action and returns the total node count', () => {
    sandbox.stub(console, 'log');
    const doc = { paths: { '/a': { get: {} } }, components: {} };
    const total = applyOverlay(doc, {
      actions: [
        { target: '$.components.x', update: { v: 1 } },
        { target: "$.paths['/a']", remove: true },
      ],
    });
    expect(total).to.equal(2);
    expect(doc.components.x).to.deep.equal({ v: 1 });
    expect(doc.paths).to.deep.equal({});
  });

  it('throws when the overlay has no actions', () => {
    expect(() => applyOverlay({}, { actions: [] })).to.throw(/no actions/);
    expect(() => applyOverlay({}, {})).to.throw(/no actions/);
  });

  it('warns (does not throw) when a remove matches 0 nodes — a stale correction signal', () => {
    sandbox.stub(console, 'log');
    const warn = sandbox.stub(console, 'warn');
    const total = applyOverlay({ params: [{ name: 'id' }] }, {
      actions: [{ target: "$.params[?(@.name == 'gone')]", remove: true }],
    });
    expect(total).to.equal(0);
    expect(warn.calledOnce).to.equal(true);
    expect(warn.firstCall.args[0]).to.match(/remove matched 0 nodes/);
  });
});
