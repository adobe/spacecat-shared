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

import { hasText } from '@adobe/spacecat-shared-utils';

class Reference {
  static TYPES = {
    BELONGS_TO: 'belongs_to',
    HAS_MANY: 'has_many',
    HAS_ONE: 'has_one',
  };

  static fromJSON(json) {
    return new Reference(json.type, json.target, json.options);
  }

  static isValidType(type) {
    return Object.values(Reference.TYPES).includes(type);
  }

  constructor(type, target, options = {}) {
    if (!Reference.isValidType(type)) {
      throw new Error(`Invalid reference type: ${type}`);
    }

    if (!hasText(target)) {
      throw new Error('Invalid target');
    }

    this.type = type;
    this.target = target;
    this.options = options;
  }

  getTarget() {
    return this.target;
  }

  getType() {
    return this.type;
  }

  isRemoveDependents() {
    return this.options.removeDependents;
  }
}

export default Reference;
