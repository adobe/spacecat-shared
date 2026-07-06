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
import { brandUrlHttpsTag } from '../../mock/brand-url-validation.js';

// The route handler is coverage-excluded, so the https:// validation is unit-tested here against
// the live contract write-probed 2026-07-06 (serenity-docs#25): a brand URL must be a literal
// https:// value; a scheme-less value fails the `url` tag, a non-https URL the `startswith` tag.
describe('brand-url-validation', () => {
  it('accepts an https:// URL (apex, www, path, uppercase host) → null', () => {
    expect(brandUrlHttpsTag('https://lovesac.com')).to.equal(null);
    expect(brandUrlHttpsTag('https://www.lovesac.com')).to.equal(null);
    expect(brandUrlHttpsTag('https://x.com/Lovesac')).to.equal(null);
    expect(brandUrlHttpsTag('HTTPS://LOVESAC.COM')).to.equal(null);
  });

  it('rejects a scheme-less value on the `url` tag', () => {
    // The resolve `primary_url` form — cannot be written as a brand URL.
    expect(brandUrlHttpsTag('lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('www.lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('instagram.com/lovesac')).to.equal('url');
    expect(brandUrlHttpsTag('not a url')).to.equal('url');
    expect(brandUrlHttpsTag('')).to.equal('url');
    expect(brandUrlHttpsTag(undefined)).to.equal('url');
  });

  it('rejects a valid but non-https URL on the `startswith` tag', () => {
    expect(brandUrlHttpsTag('http://lovesac.com')).to.equal('startswith');
    expect(brandUrlHttpsTag('ftp://lovesac.com')).to.equal('startswith');
  });

  it('rejects a scheme with no host (e.g. mailto:) on the `url` tag', () => {
    expect(brandUrlHttpsTag('mailto:hi@lovesac.com')).to.equal('url');
  });
});
