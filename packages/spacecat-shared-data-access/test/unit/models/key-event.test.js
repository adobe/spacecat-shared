/*
 * Copyright 2024 Adobe. All rights reserved.
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
  createKeyEvent,
  KEY_EVENT_TYPES,
} from '../../../src/models/key-event.js';

describe('Key Event Model Tests', () => {
  it('throws an error if site id does not exist', () => {
    expect(() => createKeyEvent({ name: 'some name' })).to.throw('Required field "siteId" is missing');
  });

  it('throws an error if name does not exist', () => {
    expect(() => createKeyEvent({ siteId: 'some site id' })).to.throw('Required field "name" is missing');
  });

  it('throws an error if type does not exist', () => {
    expect(() => createKeyEvent({ name: 'some name', siteId: 'some site id' })).to.throw('Required field "type" is missing');
  });

  it('throws an error when an unknown type field is submitted', () => {
    expect(() => createKeyEvent({ name: 'some name', siteId: 'some site id', type: 'hebele' })).to.throw('Unknown value for "type": hebele');
  });

  it('creates a key event when all fields are as expected', () => {
    const keyEvent = createKeyEvent({ name: 'some name', siteId: 'some site id', type: KEY_EVENT_TYPES.SEO });
    expect(keyEvent.getId()).not.to.be.empty;
  });

  it('creates a key event when all fields are as expected - type field case insensitive', () => {
    const keyEvent = createKeyEvent({ name: 'some name', siteId: 'some site id', type: 'sEo' });
    expect(keyEvent.getId()).not.to.be.empty;
  });
});
