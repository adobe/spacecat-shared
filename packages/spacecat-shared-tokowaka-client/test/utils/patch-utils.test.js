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
import { getPatchKey, mergePatches } from '../../src/utils/patch-utils.js';

describe('Patch Utils', () => {
  describe('getPatchKey', () => {
    it('should return opportunityId:suggestionId for individual patches (hasSinglePatchPerUrl=false)', () => {
      const patch = {
        opportunityId: 'opp-headings',
        suggestionIds: ['sugg-456'],
      };

      const key = getPatchKey(patch, false);
      expect(key).to.equal('opp-headings:sugg-456');
    });

    it('should return opportunityId for combined patches (hasSinglePatchPerUrl=true) with one suggestion', () => {
      const patch = {
        opportunityId: 'opp-faq',
        suggestionIds: ['sugg-456'],
      };

      const key = getPatchKey(patch, true);
      expect(key).to.equal('opp-faq');
    });

    it('should return opportunityId for combined patches (hasSinglePatchPerUrl=true) with multiple suggestions', () => {
      const patch = {
        opportunityId: 'opp-faq',
        suggestionIds: ['sugg-456', 'sugg-789'],
      };

      const key = getPatchKey(patch, true);
      expect(key).to.equal('opp-faq');
    });

    it('should throw error when suggestionIds is missing', () => {
      const patch = {
        opportunityId: 'opp-123',
      };

      expect(() => getPatchKey(patch, false)).to.throw('Patch must have suggestionIds array with at least one element');
    });

    it('should throw error when suggestionIds is empty array', () => {
      const patch = {
        opportunityId: 'opp-123',
        suggestionIds: [],
      };

      expect(() => getPatchKey(patch, false)).to.throw('Patch must have suggestionIds array with at least one element');
    });
  });

  describe('mergePatches', () => {
    it('should merge individual patches with same key (hasSinglePatchPerUrl=false)', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionIds: ['sugg-123'],
          value: 'old-value',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionIds: ['sugg-123'],
          value: 'new-value',
        },
      ];

      const result = mergePatches(existingPatches, newPatches, false);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0].suggestionIds).to.deep.equal(['sugg-123']);
      expect(result.patches[0].value).to.equal('new-value');
      expect(result.updateCount).to.equal(1);
      expect(result.addCount).to.equal(0);
    });

    it('should keep individual patches with different keys (hasSinglePatchPerUrl=false)', () => {
      const existingPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionIds: ['sugg-1'],
          value: 'value-1',
        },
      ];

      const newPatches = [
        {
          op: 'replace',
          opportunityId: 'opp-headings',
          suggestionIds: ['sugg-2'],
          value: 'value-2',
        },
      ];

      const result = mergePatches(existingPatches, newPatches, false);
      expect(result.patches).to.have.lengthOf(2);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(1);
    });

    it('should merge combined patches (hasSinglePatchPerUrl=true)', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-faq',
          suggestionIds: ['sugg-1', 'sugg-2'],
          value: 'old-faq-value',
        },
      ];

      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-faq',
          suggestionIds: ['sugg-3', 'sugg-4'],
          value: 'new-faq-value',
        },
      ];

      const result = mergePatches(existingPatches, newPatches, true);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0].suggestionIds).to.deep.equal(['sugg-3', 'sugg-4']);
      expect(result.patches[0].value).to.equal('new-faq-value');
      expect(result.updateCount).to.equal(1);
      expect(result.addCount).to.equal(0);
    });

    it('should merge FAQ patch even when only one suggestionId (hasSinglePatchPerUrl=true)', () => {
      const existingPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-faq',
          suggestionIds: ['sugg-1'],
          value: 'old-faq',
        },
      ];

      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-faq',
          suggestionIds: ['sugg-2'],
          value: 'new-faq',
        },
      ];

      const result = mergePatches(existingPatches, newPatches, true);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0].suggestionIds).to.deep.equal(['sugg-2']);
      expect(result.patches[0].value).to.equal('new-faq');
      expect(result.updateCount).to.equal(1);
      expect(result.addCount).to.equal(0);
    });

    it('should handle empty existing patches', () => {
      const newPatches = [
        {
          op: 'appendChild',
          opportunityId: 'opp-123',
          suggestionIds: ['sugg-new'],
          value: 'new-value',
        },
      ];

      const result = mergePatches([], newPatches, false);
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
          suggestionIds: ['sugg-old'],
          value: 'old-value',
        },
      ];

      const result = mergePatches(existingPatches, [], false);
      expect(result.patches).to.have.lengthOf(1);
      expect(result.patches[0]).to.deep.equal(existingPatches[0]);
      expect(result.updateCount).to.equal(0);
      expect(result.addCount).to.equal(0);
    });
  });
});
