/*
 * Copyright 2023 Adobe. All rights reserved.
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

import { resolveSecretsName } from '../src/helpers.js';

describe('resolveSecretsName', () => {
  it('resolves name correctly with valid inputs', () => {
    const ctx = { func: { version: '1.0.0' } };
    const defaultPath = 'secretPath';
    expect(resolveSecretsName({}, ctx, defaultPath)).to.equal('secretPath/1.0.0');
  });

  it('throws error when ctx is undefined', () => {
    expect(() => resolveSecretsName({}, undefined, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func is undefined', () => {
    const ctx = {};
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when ctx.func.version is not a string', () => {
    const ctx = { func: { version: null } };
    expect(() => resolveSecretsName({}, ctx, 'defaultPath')).to.throw('Invalid context: func.version is required and must be a string');
  });

  it('throws error when defaultPath is not a string', () => {
    const ctx = { func: { version: '1.0.0' } };
    expect(() => resolveSecretsName({}, ctx, null)).to.throw('Invalid defaultPath: must be a string');
  });
});
