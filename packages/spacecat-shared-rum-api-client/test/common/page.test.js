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
import { getPageType, isConsentClick } from '../../src/common/page.js';

describe('Page categorization', () => {
  const pageTypes = {
    home: /^\/$/,
    product: /^\/product\/\d+/,
    'other | Other Pages': /.*/,
  };

  it('should return "uncategorized" if pageTypes is undefined', () => {
    const result = getPageType({ url: '/product/123' }, undefined);
    expect(result).to.equal('uncategorized');
  });

  it('should return "uncategorized" if pageTypes is null', () => {
    const result = getPageType({ url: '/product/123' }, null);
    expect(result).to.equal('uncategorized');
  });

  it('should return "uncategorized" if pageTypes is empty', () => {
    const result = getPageType({ url: '/product/123' }, {});
    expect(result).to.equal('uncategorized');
  });

  it('should correctly classify page by RegExp', () => {
    const result = getPageType({ url: '/product/123' }, pageTypes);
    expect(result).to.equal('product');
  });

  it('should return "uncategorized" if match is "other"', () => {
    const result = getPageType({ url: '/unknown/path' }, pageTypes);
    expect(result).to.equal('uncategorized');
  });

  it('should return "uncategorized" if no match is found', () => {
    const result = getPageType({ url: '/no-match' }, {
      home: /^\/home$/,
      product: /^\/product\/\d+$/,
    });
    expect(result).to.equal('uncategorized');
  });

  it('should handle string regex pattern (not RegExp instance)', () => {
    const result = getPageType(
      { url: '/product/999' },
      { 'product | item': '^/product/\\d+$' },
    );
    expect(result).to.equal('product | item');
  });
});

describe('IsConsentClick Check', () => {
  it('should return true for known consent keywords', () => {
    expect(isConsentClick('onetrust')).to.be.true;
    expect(isConsentClick('.CookiebotWidget')).to.be.true;
  });
  it('should be case-insensitive', () => {
    expect(isConsentClick('ONEtrust')).to.be.true;
  });

  it('should return false for unrelated string', () => {
    expect(isConsentClick('click-here')).to.be.false;
  });

  it('should return false for null or non-string', () => {
    expect(isConsentClick(null)).to.be.false;
    expect(isConsentClick(42)).to.be.false;
    expect(isConsentClick({})).to.be.false;
  });

  it('should return false for empty string', () => {
    expect(isConsentClick('')).to.be.false;
  });
});
