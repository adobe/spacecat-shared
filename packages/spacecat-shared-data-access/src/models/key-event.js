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

import { hasText, isIsoDate } from '@adobe/spacecat-shared-utils';

import { Base } from './base.js';

export const KEY_EVENT_TYPES = {
  PERFORMANCE: 'PERFORMANCE',
  SEO: 'SEO',
  CONTENT: 'CONTENT',
  CODE: 'CODE',
  THIRD_PARTY: 'THIRD PARTY',
  EXPERIMENTATION: 'EXPERIMENTATION',
  NETWORK: 'NETWORK',
};

/**
 * Creates a new Key Event.
 *
 * @param {object} data - key event data
 * @returns {Readonly<KeyEvent>} new key event
 */
const KeyEvent = (data = {}) => {
  const self = Base(data);

  self.getName = () => self.state.name;
  self.getSiteId = () => self.state.siteId;
  self.getType = () => self.state.type;
  self.getTime = () => self.state.time;

  // no set functions since all values are required at creation time

  return Object.freeze(self);
};

/**
 * Creates a new Key Event.
 *
 * @param {object} data - key event data
 * @returns {Readonly<KeyEvent>} new key event
 */
export const createKeyEvent = (data) => {
  const newState = { ...data };

  if (!hasText(newState.siteId)) {
    throw new Error('Required field "siteId" is missing');
  }

  if (!hasText(newState.name)) {
    throw new Error('Required field "name" is missing');
  }

  if (!hasText(newState.type)) {
    throw new Error('Required field "type" is missing');
  }

  if (!Object.values(KEY_EVENT_TYPES).includes(newState.type.toUpperCase())) {
    throw new Error(`Unknown value for "type": ${newState.type}`);
  }

  if (hasText(newState.time) && !isIsoDate(newState.time)) {
    throw new Error('"Time" should be a valid ISO string');
  }

  if (!hasText(newState.time)) {
    newState.time = new Date().toISOString();
  }

  return KeyEvent(newState);
};
