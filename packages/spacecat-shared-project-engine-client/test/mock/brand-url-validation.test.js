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

// Every value below was POSTed to the LIVE Semrush `create_brand_urls` during the 2026-07-13
// write-probe (prod `adobe-hackathon.semrush.com`, throwaway benchmarks in the LLMO-Dev-2 dev
// sub-workspace, serenity-docs#25), and the expectation is the tag prod actually answered with.
// `BrandURLRequest.URL` is `required,url,startswith=https://`, evaluated in that order — so the
// cases that matter are the ones where go's semantics differ from JS's: a case-SENSITIVE
// `startswith`, opaque URLs, and untrimmed whitespace.
describe('brand-url-validation', () => {
  it('accepts a literal lower-case https:// URL → null', () => {
    expect(brandUrlHttpsTag('https://lovesac.com')).to.equal(null);
    expect(brandUrlHttpsTag('https://www.lovesac.com')).to.equal(null);
    expect(brandUrlHttpsTag('https://x.com/Lovesac')).to.equal(null);
    expect(brandUrlHttpsTag('https://lovesac.com:8443/p?q=1#f')).to.equal(null);
    // Only the SCHEME must be literal — an upper-case host is fine (live: 200).
    expect(brandUrlHttpsTag('https://LOVESAC.COM')).to.equal(null);
    // Live accepts an IP, a bare host and an IDN host too.
    expect(brandUrlHttpsTag('https://192.168.0.1')).to.equal(null);
    expect(brandUrlHttpsTag('https://localhost')).to.equal(null);
    expect(brandUrlHttpsTag('https://exämple.net')).to.equal(null);
    // No host at all, but a fragment — which satisfies go's `url` tag (live: 200).
    expect(brandUrlHttpsTag('https://#frag')).to.equal(null);
  });

  it('rejects an upper/mixed-case scheme on `startswith` (HasPrefix is case-SENSITIVE)', () => {
    // These parse fine, so go reaches `startswith` — which compares the RAW bytes.
    expect(brandUrlHttpsTag('HTTPS://LOVESAC.COM')).to.equal('startswith');
    expect(brandUrlHttpsTag('Https://lovesac.com')).to.equal('startswith');
    expect(brandUrlHttpsTag('hTTps://lovesac.com')).to.equal('startswith');
  });

  it('rejects a scheme-less value on the `url` tag', () => {
    // The resolve `primary_url` form — cannot be written as a brand URL.
    expect(brandUrlHttpsTag('lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('www.lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('instagram.com/lovesac')).to.equal('url');
    expect(brandUrlHttpsTag('//lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('not a url')).to.equal('url');
  });

  it('rejects a valid but non-https URL on the `startswith` tag', () => {
    expect(brandUrlHttpsTag('http://lovesac.com')).to.equal('startswith');
    expect(brandUrlHttpsTag('HTTP://lovesac.com')).to.equal('startswith');
    expect(brandUrlHttpsTag('ftp://lovesac.com')).to.equal('startswith');
  });

  it('rejects an opaque / hostless URL on `startswith`, NOT on `url`', () => {
    // The `url` tag accepts a scheme carrying opaque content (no host), so these get PAST it and
    // die on `startswith` — the tag a JS `URL.host` check gets wrong.
    expect(brandUrlHttpsTag('mailto:hi@lovesac.com')).to.equal('startswith');
    expect(brandUrlHttpsTag('tel:+41791234567')).to.equal('startswith');
    // eslint-disable-next-line no-script-url -- a probed live input, not a URL we ever navigate to
    expect(brandUrlHttpsTag('javascript:alert(1)')).to.equal('startswith');
    expect(brandUrlHttpsTag('https:lovesac.com')).to.equal('startswith'); // opaque, not `https://`
  });

  it('rejects EVERY file: form on `startswith` (the scheme is exempt from the `url` tag)', () => {
    // Probed live: all five clear `url` — even the empty ones, which go-validator's current source
    // says should fail it. The deployed validator predates that path check.
    expect(brandUrlHttpsTag('file:///etc/passwd')).to.equal('startswith');
    expect(brandUrlHttpsTag('file:/etc/passwd')).to.equal('startswith');
    expect(brandUrlHttpsTag('file:etc/passwd')).to.equal('startswith');
    expect(brandUrlHttpsTag('file://')).to.equal('startswith');
    expect(brandUrlHttpsTag('file:///')).to.equal('startswith');
  });

  it('rejects a degenerate URL on the `url` tag', () => {
    expect(brandUrlHttpsTag('https:/lovesac.com')).to.equal('url'); // single slash → rooted path
    expect(brandUrlHttpsTag('https://')).to.equal('url'); // scheme only: no host/fragment/opaque
    expect(brandUrlHttpsTag('https://#')).to.equal('url'); // EMPTY fragment does not satisfy it
  });

  it('lets a non-empty fragment stand in for a missing host', () => {
    // A rooted path alone fails `url`, but the same value with a fragment clears it and falls
    // through to `startswith` — the fragment, not the path, is what the tag counts.
    expect(brandUrlHttpsTag('https:/lovesac.com#frag')).to.equal('startswith');
  });

  it('rejects whitespace on the `url` tag (go does not trim it; JS `URL` would)', () => {
    expect(brandUrlHttpsTag(' https://lovesac.com')).to.equal('url');
    expect(brandUrlHttpsTag('https://lovesac.com ')).to.equal('url');
    expect(brandUrlHttpsTag('https://love sac.com')).to.equal('url');
  });

  it('reports a missing / null / empty url on the `required` tag', () => {
    // All three are go's empty string, so `required` fires before `url` is ever evaluated.
    expect(brandUrlHttpsTag('')).to.equal('required');
    expect(brandUrlHttpsTag(undefined)).to.equal('required');
    expect(brandUrlHttpsTag(null)).to.equal('required');
  });

  it('reports a non-string url as an unmarshal failure, not a tag', () => {
    // Live answers `400 {"message":"invalid request body"}` — go never reaches the validator.
    expect(brandUrlHttpsTag(123)).to.equal('invalid_body');
    expect(brandUrlHttpsTag(true)).to.equal('invalid_body');
    expect(brandUrlHttpsTag({ url: 'https://lovesac.com' })).to.equal('invalid_body');
  });
});
