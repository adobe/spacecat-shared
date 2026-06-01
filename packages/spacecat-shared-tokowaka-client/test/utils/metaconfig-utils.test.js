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

import { expect } from 'chai';
import {
  addPatternsToMetaconfig,
  removePatternFromMetaconfig,
} from '../../src/utils/metaconfig-utils.js';

describe('metaconfig-utils', () => {
  describe('addPatternsToMetaconfig', () => {
    it('adds patterns to an empty allowList', () => {
      const metaconfig = {};
      const changed = addPatternsToMetaconfig(metaconfig, ['/products/*']);
      expect(changed).to.be.true;
      expect(metaconfig.prerender.allowList).to.deep.equal(['/products/*']);
    });

    it('appends patterns to an existing allowList', () => {
      const metaconfig = { prerender: { allowList: ['/blog/*'] } };
      addPatternsToMetaconfig(metaconfig, ['/products/*']);
      expect(metaconfig.prerender.allowList).to.deep.equal(['/blog/*', '/products/*']);
    });

    it('deduplicates patterns already present', () => {
      const metaconfig = { prerender: { allowList: ['/blog/*'] } };
      const changed = addPatternsToMetaconfig(metaconfig, ['/blog/*']);
      expect(changed).to.be.false;
      expect(metaconfig.prerender.allowList).to.deep.equal(['/blog/*']);
    });
  });

  describe('removePatternFromMetaconfig', () => {
    it('removes a pattern from the allowList', () => {
      const metaconfig = { prerender: { allowList: ['/blog/*', '/products/*'] } };
      const changed = removePatternFromMetaconfig(metaconfig, '/blog/*');
      expect(changed).to.be.true;
      expect(metaconfig.prerender.allowList).to.deep.equal(['/products/*']);
    });

    it('returns false when the pattern is not in the allowList', () => {
      const metaconfig = { prerender: { allowList: ['/blog/*'] } };
      const changed = removePatternFromMetaconfig(metaconfig, '/products/*');
      expect(changed).to.be.false;
      expect(metaconfig.prerender.allowList).to.deep.equal(['/blog/*']);
    });

    it('deletes metaconfig.prerender entirely when allowList becomes empty', () => {
      const metaconfig = { prerender: { allowList: ['/blog/*'] } };
      removePatternFromMetaconfig(metaconfig, '/blog/*');
      expect(metaconfig.prerender).to.be.undefined;
    });

    it('returns false when prerender is absent', () => {
      const metaconfig = {};
      const changed = removePatternFromMetaconfig(metaconfig, '/blog/*');
      expect(changed).to.be.false;
    });
  });
});
