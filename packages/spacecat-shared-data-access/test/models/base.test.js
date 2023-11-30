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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import { expect } from 'chai';
import { Base } from '../../src/models/base.js';
import { sleep } from '../util.js';

describe('Base Model Tests', () => {
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
    it('correctly returns the createdAt date if provided', () => {
      const createdAt = new Date().toISOString();
      const baseEntity = Base({ createdAt });
      expect(baseEntity.getCreatedAt()).to.equal(createdAt);
    });

    it('correctly returns the updatedAt date if provided', () => {
      const updatedAt = new Date().toISOString();
      const baseEntity = Base({ updatedAt });
      expect(baseEntity.getUpdatedAt()).to.equal(updatedAt);
    });
  });

  describe('Timestamp Tests', () => {
    it('should set createdAt and updatedAt for new records', () => {
      const baseEntity = Base();
      expect(isIsoDate(baseEntity.getCreatedAt())).to.be.true;
      expect(isIsoDate(baseEntity.getUpdatedAt())).to.be.true;
      expect(baseEntity.getCreatedAt()).to.equal(baseEntity.getUpdatedAt());
    });

    it('should update updatedAt using touch method', async () => {
      const baseEntity = Base();
      const initialUpdatedAt = baseEntity.getUpdatedAt();

      await sleep(10);

      baseEntity.touch();

      expect(baseEntity.getUpdatedAt()).to.not.equal(initialUpdatedAt);
    });
  });
});
