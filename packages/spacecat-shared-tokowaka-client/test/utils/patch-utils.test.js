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
import { mergePatches } from '../../src/utils/patch-utils.js';

describe('Patch Utils', () => {
  describe('mergePatches', () => {
    it('should merge individual patches with same key', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-123',
          value: 'old-value',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-123',
          value: 'new-value',
        },
      ];

      const result = mergePatches(existingPatches, newPatches);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0].suggestionId).to.equal('sugg-123');
      expect(result.patches[0].value).to.equal('new-value');
      expect(result.updateCount).to.equal(1);
      expect(result.addCount).to.equal(0);
    });

    it('should keep individual patches with different keys', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-1',
          value: 'value-1',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionId: 'sugg-2',
          value: 'value-2',
        },
      ];

      const result = mergePatches(existingPatches, newPatches);
      expect(result.patches).to.have.lengthOf(2);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(1);
    });

    it('should handle empty existing patches', () => {
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          suggestionId: 'sugg-new',
          value: 'new-value',
        },
      ];

      const result = mergePatches([], newPatches);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0]).to.deep.equal(newPatches[0]);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(1);
    });

    it('should handle empty new patches', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          suggestionId: 'sugg-old',
          value: 'old-value',
        },
      ];

      const result = mergePatches(existingPatches, []);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0]).to.deep.equal(existingPatches[0]);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(0);
    });

    it('should handle patch without suggestionId (heading patch)', () => {
      const existingPatches = [];
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2' },
          // No suggestionId - this is a heading patch
        },
      ];

      const result = mergePatches(existingPatches, newPatches);

      expect(result.patches).to.have.lengthOf(1);
      expect(result.addCount).to.equal(1);
    });

    it('should merge heading patches with same opportunityId', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'Old' }] },
          // No suggestionId
        },
      ];
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          value: { type: 'element', tagName: 'h2', children: [{ type: 'text', value: 'New' }] },
          // No suggestionId
        },
      ];

      const result = mergePatches(existingPatches, newPatches);

      expect(result.patches).to.have.lengthOf(1);
      expect(result.updateCount).to.equal(1);
      expect(result.patches[0].value.children[0].value).to.equal('New');
    });
  });
});
