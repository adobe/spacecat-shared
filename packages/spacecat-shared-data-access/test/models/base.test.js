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
import { Base } from '../../src/models/base.js';

describe('Base Entity Tests', () => {
  describe('Initialization Tests', () => {
    it('should automatically assign a UUID if no id is provided', () => {
      const baseEntity = Base();
      expect(baseEntity.getId()).to.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
    });

    it('should retain the provided id if one is provided', () => {
      const id = 'test-id';
      const baseEntity = Base({ id });
      expect(baseEntity.getId()).to.equal(id);
    });
  });

  describe('Getter Method Tests', () => {
    it('should correctly return the createdAt date if provided', () => {
      const createdAt = new Date().toISOString();
      const baseEntity = Base({ createdAt });
      expect(baseEntity.getCreatedAt()).to.equal(createdAt);
    });

    it('should return undefined for createdAt if not provided', () => {
      const baseEntity = Base();
      expect(baseEntity.getCreatedAt()).to.be.undefined;
    });

    it('should correctly return the updatedAt date if provided', () => {
      const updatedAt = new Date().toISOString();
      const baseEntity = Base({ updatedAt });
      expect(baseEntity.getUpdatedAt()).to.equal(updatedAt);
    });

    it('should return undefined for updatedAt if not provided', () => {
      const baseEntity = Base();
      expect(baseEntity.getUpdatedAt()).to.be.undefined;
    });
  });
});
