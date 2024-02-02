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
  SLACK_STATUSES,
  SLACK_TARGETS,
  BaseSlackClient,
  ElevatedSlackClient,
} from '../src/index.js';

describe('SLACK_TARGETS Object', () => {
  it('should have WORKSPACE_INTERNAL and WORKSPACE_EXTERNAL properties', () => {
    expect(SLACK_TARGETS).to.be.an('object').that.includes.all.keys('WORKSPACE_INTERNAL', 'WORKSPACE_EXTERNAL');
  });

  it('SLACK_STATUSES must have required properties', () => {
    expect(SLACK_STATUSES).to.be.an('object').that.includes.all.keys(
      'USER_ALREADY_IN_CHANNEL',
      'GENERAL_ERROR',
      'USER_ALREADY_IN_ANOTHER_CHANNEL',
      'USER_INVITED_TO_CHANNEL',
      'USER_NEEDS_INVITATION_TO_WORKSPACE',
      'CHANNEL_ALREADY_EXISTS',
    );
  });

  it('should have correct values for properties', () => {
    expect(SLACK_TARGETS.WORKSPACE_INTERNAL).to.equal('WORKSPACE_INTERNAL');
    expect(SLACK_TARGETS.WORKSPACE_EXTERNAL).to.equal('WORKSPACE_EXTERNAL');
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
