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
import { AWSAthenaClient } from '../src/index.js';

describe('Index', () => {
  it('exports AWSAthenaClient', () => {
    expect(AWSAthenaClient).to.be.a('function');
    expect(AWSAthenaClient.name).to.equal('AWSAthenaClient');
  });

  it('exports AWSAthenaClient with all expected static methods', () => {
    expect(AWSAthenaClient.fromContext).to.be.a('function');
  });

  it('exports AWSAthenaClient with correct prototype methods', () => {
    const methods = ['query', 'execute'];
    methods.forEach((method) => {
      expect(AWSAthenaClient.prototype[method]).to.be.a('function');
    });
  });
});
