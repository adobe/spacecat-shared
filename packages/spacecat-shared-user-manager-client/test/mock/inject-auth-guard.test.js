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
import { injectAuthGuard } from '../../mock/inject-auth-guard.js';

const GUARD = '$.context.authError($.headers)';

describe('mock injectAuthGuard', () => {
  it('prepends the auth guard to a canonical handler', () => {
    const out = injectAuthGuard('export function GET($) {\n  return $.response[200];\n}', 'status.js');
    expect(out).to.include(GUARD);
    // the guard sits inside the body, before the original first statement
    expect(out.indexOf(GUARD)).to.be.lessThan(out.indexOf('return $.response[200]'));
  });

  it('guards an async handler', () => {
    const out = injectAuthGuard('export async function POST($) {\n  return $.response[200];\n}', 'child.js');
    expect(out).to.include(GUARD);
  });

  it('guards every method in a multi-method file', () => {
    const src = 'export function GET($) {\n  return 1;\n}\nexport function DELETE($) {\n  return 2;\n}';
    const out = injectAuthGuard(src, 'workspace.js');
    expect(out.match(/\$\.context\.authError/g)).to.have.length(2);
  });

  it('leaves __* control routes untouched (exempt)', () => {
    const src = 'export function POST($) {\n  return $.response[200];\n}';
    expect(injectAuthGuard(src, '__quota.js')).to.equal(src);
  });

  it('returns a method-less file unchanged (no throw)', () => {
    const src = '// _lib registers as an unreachable route\nexport const helper = 1;\n';
    expect(injectAuthGuard(src, '_lib.js')).to.equal(src);
  });

  it('throws on an arrow-exported method (counted, not guardable)', () => {
    expect(() => injectAuthGuard('export const GET = ($) => $.response[200];', 'drift.js'))
      .to.throw(/drift\.js declares 1 HTTP method export\(s\) but only 0 matched/);
  });

  it('throws on an OPTIONS/HEAD verb (not in the guardable set)', () => {
    expect(() => injectAuthGuard('export function OPTIONS($) {\n  return $.response[204];\n}', 'cors.js'))
      .to.throw(/unguarded and would serve\s+unauthenticated/);
  });

  it('throws on a renamed/destructured param (declared but unguarded)', () => {
    expect(() => injectAuthGuard('export function GET(ctx) {\n  return ctx.response[200];\n}', 'renamed.js'))
      .to.throw(/declares 1 HTTP method export\(s\) but only 0 matched/);
  });
});
