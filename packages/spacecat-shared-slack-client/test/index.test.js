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
import {
  SLACK_TARGETS,
  BaseSlackClient,
  ElevatedSlackClient,
} from '../src/index.js';

describe('SLACK_TARGETS Object', () => {
  it('should have ADOBE_INTERNAL and ADOBE_EXTERNAL properties', () => {
    expect(SLACK_TARGETS).to.be.an('object').that.includes.all.keys('ADOBE_INTERNAL', 'ADOBE_EXTERNAL');
  });

  it('should have correct values for properties', () => {
    expect(SLACK_TARGETS.ADOBE_INTERNAL).to.equal('ADOBE_INTERNAL');
    expect(SLACK_TARGETS.ADOBE_EXTERNAL).to.equal('ADOBE_EXTERNAL');
  });
});

describe('BaseSlackClient Class', () => {
  it('should be a function (class)', () => {
    expect(BaseSlackClient).to.be.a('function');
  });

  // More detailed tests can be added here to test class instantiation, methods, etc.
});

describe('ElevatedSlackClient Class', () => {
  it('should be a function (class)', () => {
    expect(ElevatedSlackClient).to.be.a('function');
  });

  // More detailed tests can be added here to test class instantiation, methods, etc.
});
