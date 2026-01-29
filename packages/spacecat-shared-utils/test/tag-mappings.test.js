/*
 * Copyright 2026 Adobe. All rights reserved.
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
  OPPORTUNITY_TAG_MAPPINGS,
  getTagsForOpportunityType,
  mergeTagsWithHardcodedTags,
} from '../src/tag-mappings.js';

describe('tag-mappings', () => {
  describe('OPPORTUNITY_TAG_MAPPINGS', () => {
    it('should be an object', () => {
      expect(OPPORTUNITY_TAG_MAPPINGS).to.be.an('object');
    });

    it('should contain expected opportunity types', () => {
      expect(OPPORTUNITY_TAG_MAPPINGS).to.have.property('cwv');
      expect(OPPORTUNITY_TAG_MAPPINGS).to.have.property('meta-tags');
      expect(OPPORTUNITY_TAG_MAPPINGS).to.have.property('a11y-assistive');
    });
  });

  describe('getTagsForOpportunityType', () => {
    it('should return tags for valid opportunity type', () => {
      const tags = getTagsForOpportunityType('cwv');
      expect(tags).to.deep.equal(['Core Web Vitals', 'Web Performance']);
    });

    it('should return empty array for invalid opportunity type', () => {
      const tags = getTagsForOpportunityType('invalid-type');
      expect(tags).to.deep.equal([]);
    });

    it('should return tags for meta-tags opportunity type', () => {
      const tags = getTagsForOpportunityType('meta-tags');
      expect(tags).to.deep.equal(['Meta Tags', 'SEO']);
    });

    it('should return tags for opportunity type with multiple tags', () => {
      const tags = getTagsForOpportunityType('headings');
      expect(tags).to.deep.equal(['Headings', 'SEO', 'Engagement']);
    });
  });

  describe('mergeTagsWithHardcodedTags', () => {
    it('should return hardcoded tags when currentTags is empty', () => {
      const result = mergeTagsWithHardcodedTags('cwv', []);
      expect(result).to.deep.equal(['Core Web Vitals', 'Web Performance']);
    });

    it('should return currentTags when opportunity type is generic-opportunity', () => {
      const currentTags = ['custom-tag', 'another-tag'];
      const result = mergeTagsWithHardcodedTags('generic-opportunity', currentTags);
      expect(result).to.deep.equal(currentTags);
    });

    it('should return currentTags when no hardcoded tags exist for opportunity type', () => {
      const currentTags = ['custom-tag'];
      const result = mergeTagsWithHardcodedTags('invalid-type', currentTags);
      expect(result).to.deep.equal(currentTags);
    });

    it('should merge hardcoded tags with preserved custom tags', () => {
      const currentTags = ['isElmo', 'isASO', 'tech-seo'];
      const result = mergeTagsWithHardcodedTags('cwv', currentTags);
      expect(result).to.include.members(['Core Web Vitals', 'Web Performance']);
      expect(result).to.include.members(['isElmo', 'isASO', 'tech-seo']);
    });

    it('should handle null currentTags', () => {
      const result = mergeTagsWithHardcodedTags('cwv', null);
      expect(result).to.deep.equal(['Core Web Vitals', 'Web Performance']);
    });

    it('should handle undefined currentTags', () => {
      const result = mergeTagsWithHardcodedTags('cwv', undefined);
      expect(result).to.deep.equal(['Core Web Vitals', 'Web Performance']);
    });

    it('should not duplicate tags that are in both hardcoded and currentTags', () => {
      const currentTags = ['Core Web Vitals', 'custom-tag'];
      const result = mergeTagsWithHardcodedTags('cwv', currentTags);
      expect(result).to.include('Core Web Vitals');
      expect(result).to.include('Web Performance');
      expect(result).to.include('custom-tag');
      // Should not have duplicates
      expect(result.filter((tag) => tag === 'Core Web Vitals').length).to.equal(1);
    });

    it('should preserve tags that are not in hardcoded mapping', () => {
      const currentTags = ['preserved-tag-1', 'preserved-tag-2'];
      const result = mergeTagsWithHardcodedTags('meta-tags', currentTags);
      expect(result).to.include.members(['Meta Tags', 'SEO']);
      expect(result).to.include.members(['preserved-tag-1', 'preserved-tag-2']);
    });

    it('should filter out tags that are in hardcoded mapping from preserved tags', () => {
      const currentTags = ['Meta Tags', 'preserved-tag'];
      const result = mergeTagsWithHardcodedTags('meta-tags', currentTags);
      // Meta Tags should be in result (from hardcoded)
      expect(result).to.include('Meta Tags');
      expect(result).to.include('SEO');
      expect(result).to.include('preserved-tag');
      // Should not have duplicate Meta Tags
      expect(result.filter((tag) => tag === 'Meta Tags').length).to.equal(1);
    });

    it('should handle empty array for currentTags', () => {
      const result = mergeTagsWithHardcodedTags('cwv', []);
      expect(result).to.deep.equal(['Core Web Vitals', 'Web Performance']);
    });

    it('should preserve isElmo and isASO tags', () => {
      const currentTags = ['isElmo', 'isASO'];
      const result = mergeTagsWithHardcodedTags('alt-text', currentTags);
      expect(result).to.include('isElmo');
      expect(result).to.include('isASO');
      expect(result).to.include.members(['Alt-Text', 'Accessibility', 'SEO']);
    });

    it('should handle opportunity type with multiple hardcoded tags', () => {
      const currentTags = ['custom'];
      const result = mergeTagsWithHardcodedTags('headings', currentTags);
      expect(result).to.include.members(['Headings', 'SEO', 'Engagement', 'custom']);
    });
  });
});
