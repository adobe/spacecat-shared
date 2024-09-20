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
/* eslint-disable object-curly-newline */

import { expect } from 'chai';
import { classifyTraffic } from '../../src/common/traffic.js';

describe('Traffic classification', () => {
  const url = 'https://www.test.com/some/page';
  const { origin } = new URL(url);

  const assert = (expected, f) => {
    const result = classifyTraffic(url, f.referrer, f.utmSource, f.utmMedium, f.tracking);
    expect(result).to.eql(expected);
  };

  it('paid search', () => {
    const expected = { type: 'paid', category: 'search' };

    assert(expected, { referrer: 'https://www.bing.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: null });
    assert(expected, { referrer: 'https://www.google.co.uk/', utmSource: 'some-source', utmMedium: 'sea', tracking: null });
    assert(expected, { referrer: 'https://yahoo.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: null });
    assert(expected, { referrer: 'https://google.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: 'paid' });
    assert(expected, { referrer: 'https://googleads.g.doubleclick.net/', utmSource: 'goo', utmMedium: 'gsea', tracking: null });
    assert(expected, { referrer: '', utmSource: 'goo', utmMedium: 'sem', tracking: null });
    assert(expected, { referrer: 'https://www.google.com/', utmSource: 'googlemaps', utmMedium: 'seomaps', tracking: null });
    assert(expected, { referrer: '', utmSource: 'gsea', utmMedium: 'sea', tracking: null });
  });

  it('paid social', () => {
    const expected = { type: 'paid', category: 'social' };

    assert(expected, { referrer: 'https://www.facebook.com/', utmSource: 'some-source', utmMedium: 'facebook', tracking: null });
    assert(expected, { referrer: 'https://www.tiktok.com/', utmSource: 'some-source', utmMedium: 'paidsocial', tracking: null });
    assert(expected, { referrer: 'https://snapchat.com/', utmSource: 'some-source', utmMedium: 'social', tracking: null });
    assert(expected, { referrer: 'https://x.com/', utmSource: 'some-source', utmMedium: '', tracking: 'paid' });
    assert(expected, { referrer: '', utmSource: 'meta', utmMedium: 'paidsocial', tracking: null });
    assert(expected, { referrer: 'https://www.tiktok.com/', utmSource: 'tt', utmMedium: 'soci', tracking: null });
    assert(expected, { referrer: '', utmSource: 'reddit', utmMedium: 'social', tracking: null });
    assert(expected, { referrer: '', utmSource: 'soc', utmMedium: 'fbig', tracking: null });
    assert(expected, { referrer: '', utmSource: 'instagram', utmMedium: 'social', tracking: null });
  });

  it('paid video', () => {
    const expected = { type: 'paid', category: 'video' };

    assert(expected, { referrer: 'https://www.youtube.com/', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert(expected, { referrer: 'https://www.youtube.com/', utmSource: 'some-source', utmMedium: 'ppc', tracking: null });
    assert(expected, { referrer: 'https://www.dailymotion.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert(expected, { referrer: 'https://www.twitch.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert(expected, { referrer: '', utmSource: 'youtube', utmMedium: 'video', tracking: null });
  });

  it('paid display', () => {
    const expected = { type: 'paid', category: 'display' };

    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert(expected, { referrer: 'https://hebele.hebele.googlesyndication.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: 'gdn', utmMedium: 'some-medium', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'pp', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'display', tracking: null });
    assert(expected, { referrer: '', utmSource: 'dv360', utmMedium: 'some-medium', tracking: null });
    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert(expected, { referrer: 'some-referrer', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert(expected, { referrer: '', utmSource: '', utmMedium: '', tracking: 'paid' });
    assert(expected, { referrer: 'https://www.google.com/', utmSource: 'newsshowcase', utmMedium: 'discover', tracking: null });
    assert(expected, { referrer: 'https://googleads.g.doubleclick.net/', utmSource: 'some', utmMedium: 'some', tracking: null });
    assert(expected, { referrer: 'https://www.google.com/', utmSource: 'google', utmMedium: 'businesslistings', tracking: null });
  });

  it('paid affiliate', () => {
    const expected = { type: 'paid', category: 'affiliate' };

    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'affiliate', tracking: null });
  });

  it('earned search', () => {
    const expected = { type: 'earned', category: 'search' };

    assert(expected, { referrer: 'https://www.bing.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://www.google.co.uk/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://yahoo.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'some' });
    assert(expected, { referrer: 'https://google.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'some' });
    assert(expected, { referrer: 'https://www.google.com/', utmSource: 'google', utmMedium: 'organicgmb', tracking: null });
  });

  it('earned social', () => {
    const expected = { type: 'earned', category: 'social' };

    assert(expected, { referrer: 'https://www.facebook.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://www.tiktok.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://some-site.com/', utmSource: 'some-source', utmMedium: 'organicsocial', tracking: null });
  });

  it('earned video', () => {
    const expected = { type: 'earned', category: 'video' };

    assert(expected, { referrer: 'https://www.youtube.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://www.youtube.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://www.dailymotion.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: null });
  });

  it('earned referral', () => {
    const expected = { type: 'earned', category: 'referral' };

    assert(expected, { referrer: 'https://some-site.com/', utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned direct', () => {
    const expected = { type: 'owned', category: 'direct' };

    assert(expected, { referrer: '', utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned internal', () => {
    const expected = { type: 'owned', category: 'internal' };

    assert(expected, { referrer: origin, utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned email', () => {
    const expected = { type: 'owned', category: 'email' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: '', tracking: 'email' });
    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'email', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: '', utmMedium: 'some-medium', tracking: 'email' });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'newsletter', tracking: null });
  });

  it('owned sms', () => {
    const expected = { type: 'owned', category: 'sms' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'sms', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'mms', tracking: null });
  });

  it('owned qr', () => {
    const expected = { type: 'owned', category: 'qr' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'qr', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'qrcode', tracking: null });
  });

  it('owned push', () => {
    const expected = { type: 'owned', category: 'push' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'push', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'pushnotification', tracking: null });
  });

  it('owned uncategorized', () => {
    const expected = { type: 'owned', category: 'uncategorized' };

    assert(expected, { referrer: 'some', utmSource: 'some', utmMedium: 'some', tracking: null });
    assert(expected, { referrer: '', utmSource: 'some', utmMedium: 'some', tracking: null });
  });
});
