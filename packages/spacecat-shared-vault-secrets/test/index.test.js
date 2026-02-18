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
import vaultSecrets, { loadSecrets, reset } from '../src/index.js';

describe('index exports', () => {
  it('exports vaultSecrets as default', () => {
    expect(vaultSecrets).to.be.a('function');
  });

  it('exports loadSecrets', () => {
    expect(loadSecrets).to.be.a('function');
  });

  it('exports reset', () => {
    expect(reset).to.be.a('function');
  });

  it('vaultSecrets stub throws not implemented', () => {
    expect(() => vaultSecrets()).to.throw('Not implemented');
  });

  it('loadSecrets stub throws not implemented', () => {
    expect(() => loadSecrets()).to.throw('Not implemented');
  });

  it('reset stub is a no-op', () => {
    expect(() => reset()).to.not.throw();
  });
});
