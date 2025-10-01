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

import FixEntitySuggestion from '../../../../src/models/fix-entity-suggestion/fix-entity-suggestion.model.js';
import BaseModel from '../../../../src/models/base/base.model.js';

describe('FixEntitySuggestion Model', () => {
  describe('class definition', () => {
    it('extends BaseModel', () => {
      expect(FixEntitySuggestion.prototype).to.be.instanceOf(BaseModel);
    });

    it('has the correct DEFAULT_UPDATED_BY constant', () => {
      expect(FixEntitySuggestion.DEFAULT_UPDATED_BY).to.equal('spacecat');
    });

    it('can be instantiated', () => {
      // Note: In a real scenario, FixEntitySuggestion would be instantiated through the collection
      // This test just verifies the class structure
      expect(FixEntitySuggestion).to.be.a('function');
      expect(FixEntitySuggestion.name).to.equal('FixEntitySuggestion');
    });
  });

  describe('junction table functionality', () => {
    it('represents a many-to-many relationship between FixEntity and Suggestion', () => {
      // This is more of a documentation test - the junction table allows:
      // - One FixEntity to be associated with multiple Suggestions
      // - One Suggestion to be associated with multiple FixEntities
      expect(FixEntitySuggestion.prototype).to.be.instanceOf(BaseModel);
    });
  });
});
