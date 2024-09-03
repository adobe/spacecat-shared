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

import { v4 as uuidv4 } from 'uuid';
import { isString } from '@adobe/spacecat-shared-utils';

/**
 * The Base function assigns the properties of the data object to the new object and
 * provides methods to get the id, createdAt, updatedAt properties, along with a touch method
 * that updates the updatedAt property.
 *
 * @param {object} data - The data object to assign to the new state being returned.
 * @returns {{ state: {}, touch, getId, getCreatedAt, getUpdatedAt }} The new object with the
 * state and functions.
 */
export const Base = (data = {}) => {
  const self = { state: { ...data } };
  const newRecord = !isString(self.state.id);
  const nowISO = new Date().toISOString();

  if (newRecord) {
    self.state.id = uuidv4();
    self.state.createdAt = nowISO;
    self.state.updatedAt = nowISO;
  }

  self.getId = () => self.state.id;
  self.getCreatedAt = () => self.state.createdAt;
  self.getUpdatedAt = () => self.state.updatedAt;

  self.touch = () => {
    self.state.updatedAt = new Date().toISOString();
  };

  return self;
};
