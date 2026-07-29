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
import { resolveUrl } from '../../mock/url-resolve.js';
import { createUrlResolveMock } from '../../mock/factories.js';

// The route handler is coverage-excluded, so the canonicalization is unit-tested here against the
// live contract captured 2026-07-03 (serenity-docs#25 §0). resolveUrl returns only the OVERRIDES
// for a valid URL (the factory default supplies the empty/invalid shape), so an invalid input
// yields `{}`.
describe('url-resolve', () => {
  it('strips scheme + www. and drops a bare path (the canonical case, idempotent)', () => {
    const expected = { domain: 'lovesac.com', primary_url: 'lovesac.com', is_valid: true };
    // scheme + www., scheme-only, and scheme-less all normalize alike (live idempotency).
    expect(resolveUrl('https://www.lovesac.com')).to.deep.equal(expected);
    expect(resolveUrl('https://lovesac.com')).to.deep.equal(expected);
    expect(resolveUrl('www.lovesac.com')).to.deep.equal(expected);
  });

  it('preserves the path on primary_url but not on domain', () => {
    // http://www.lovesac.com/products → primary_url keeps the path, domain is the apex only.
    expect(resolveUrl('http://www.lovesac.com/products')).to.deep.equal({
      domain: 'lovesac.com',
      primary_url: 'lovesac.com/products',
      is_valid: true,
    });
  });

  it('preserves a non-www subdomain on primary_url but collapses domain to the apex', () => {
    // blog.hubspot.com → primary_url keeps the subdomain; domain strips it to the registrable apex.
    expect(resolveUrl('https://blog.hubspot.com')).to.deep.equal({
      domain: 'hubspot.com',
      primary_url: 'blog.hubspot.com',
      is_valid: true,
    });
  });

  it('returns {} (→ invalid default) for a non-string input', () => {
    expect(resolveUrl(undefined)).to.deep.equal({});
    expect(resolveUrl(null)).to.deep.equal({});
    expect(resolveUrl(42)).to.deep.equal({});
  });

  it('returns {} for an empty or whitespace-only input', () => {
    expect(resolveUrl('')).to.deep.equal({});
    expect(resolveUrl('   ')).to.deep.equal({});
  });

  it('returns {} for garbage that does not parse as a URL', () => {
    // A space in the authority makes `new URL` throw — caught → invalid (live is_valid:false, 200).
    expect(resolveUrl('not a url !!!')).to.deep.equal({});
    // A scheme with no host also throws.
    expect(resolveUrl('https://')).to.deep.equal({});
  });

  it('returns {} for an IP literal (numeric TLD is not a domain)', () => {
    expect(resolveUrl('https://192.168.0.1')).to.deep.equal({});
  });

  it('returns {} for a single-label host (no dot)', () => {
    expect(resolveUrl('http://localhost')).to.deep.equal({});
    expect(resolveUrl('intranet')).to.deep.equal({});
  });

  it('returns {} for a host with an empty label (trailing dot / double dot)', () => {
    expect(resolveUrl('https://example.com.')).to.deep.equal({});
  });

  it('strips the query string and fragment (only host + path form the brand URL)', () => {
    // The canonicalizer reads parsed.pathname only, so ?query and #fragment are dropped by design.
    expect(resolveUrl('https://lovesac.com/products?ref=123#top')).to.deep.equal({
      domain: 'lovesac.com',
      primary_url: 'lovesac.com/products',
      is_valid: true,
    });
  });

  it('strips an explicit port (uses hostname, not host)', () => {
    expect(resolveUrl('https://www.lovesac.com:8443/path')).to.deep.equal({
      domain: 'lovesac.com',
      primary_url: 'lovesac.com/path',
      is_valid: true,
    });
  });

  it('preserves a trailing slash on the path (only a bare root `/` is dropped)', () => {
    // Mock behavior: parsed.pathname is `/products/`, which is not the bare `/`, so it is kept.
    // (Live trailing-slash handling is unverified; this pins the mock's documented choice.)
    expect(resolveUrl('https://lovesac.com/products/')).to.deep.equal({
      domain: 'lovesac.com',
      primary_url: 'lovesac.com/products/',
      is_valid: true,
    });
  });

  it('composes with createUrlResolveMock: valid → resolved, invalid → the empty default', () => {
    // The route handler merges resolveUrl's overrides onto the factory default; that glue is
    // coverage-excluded, so assert the seam here without booting the mock server.
    expect(createUrlResolveMock(resolveUrl('https://www.lovesac.com')))
      .to.deep.equal({ domain: 'lovesac.com', primary_url: 'lovesac.com', is_valid: true });
    expect(createUrlResolveMock(resolveUrl('garbage !!!')))
      .to.deep.equal({ domain: '', primary_url: '', is_valid: false });
  });
});
