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
import { classifyTrafficSource } from '../../src/common/traffic.js';

describe('Traffic classification', () => {
  const url = 'https://www.test.com/some/page';
  const { origin } = new URL(url);

  const assert = (expected, f) => {
    const result = classifyTrafficSource(url, f.referrer, f.utmSource, f.utmMedium, f.tracking);
    expect(result).to.eql(expected);
  };

  it('paid search', () => {
    const expected = { type: 'paid', category: 'search', vendor: '' };

    assert({ ...expected, vendor: 'bing' }, { referrer: 'https://www.bing.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.co.uk/', utmSource: 'some-source', utmMedium: 'sea', tracking: null });
    assert({ ...expected, vendor: 'yahoo' }, { referrer: 'https://yahoo.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://google.com/', utmSource: 'some-source', utmMedium: 'paidsearch', tracking: 'paid' });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://googleads.g.doubleclick.net/', utmSource: 'goo', utmMedium: 'gsea', tracking: null });
    assert({ ...expected, vendor: '' }, { referrer: '', utmSource: 'goo', utmMedium: 'sem', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.com/', utmSource: 'googlemaps', utmMedium: 'seomaps', tracking: null });
    assert({ ...expected, vendor: '' }, { referrer: '', utmSource: 'gsea', utmMedium: 'sea', tracking: null });
  });

  it('paid social', () => {
    const expected = { type: 'paid', category: 'social', vendor: '' };

    assert({ ...expected, vendor: 'facebook' }, { referrer: 'https://www.facebook.com/', utmSource: 'some-source', utmMedium: 'facebook', tracking: null });
    assert({ ...expected, vendor: 'tiktok' }, { referrer: 'https://www.tiktok.com/', utmSource: 'some-source', utmMedium: 'paidsocial', tracking: null });
    assert({ ...expected, vendor: 'snapchat' }, { referrer: 'https://snapchat.com/', utmSource: 'some-source', utmMedium: 'social', tracking: null });
    assert({ ...expected, vendor: 'x' }, { referrer: 'https://x.com/', utmSource: 'some-source', utmMedium: '', tracking: 'paid' });
    assert({ ...expected, vendor: 'facebook' }, { referrer: '', utmSource: 'meta', utmMedium: 'paidsocial', tracking: null });
    assert({ ...expected, vendor: 'tiktok' }, { referrer: 'https://www.tiktok.com/', utmSource: 'tt', utmMedium: 'soci', tracking: null });
    assert({ ...expected, vendor: 'reddit' }, { referrer: '', utmSource: 'reddit', utmMedium: 'social', tracking: null });
    assert({ ...expected, vendor: '' }, { referrer: '', utmSource: 'soc', utmMedium: 'fbig', tracking: null });
    assert({ ...expected, vendor: 'instagram' }, { referrer: '', utmSource: 'instagram', utmMedium: 'social', tracking: null });
  });

  it('paid video', () => {
    const expected = { type: 'paid', category: 'video', vendor: '' };

    assert({ ...expected, vendor: 'youtube' }, { referrer: 'https://www.youtube.com/', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert({ ...expected, vendor: 'youtube' }, { referrer: 'https://www.youtube.com/', utmSource: 'some-source', utmMedium: 'ppc', tracking: null });
    assert({ ...expected, vendor: 'dailymotion' }, { referrer: 'https://www.dailymotion.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert({ ...expected, vendor: 'twitch' }, { referrer: 'https://www.twitch.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert({ ...expected, vendor: 'youtube' }, { referrer: '', utmSource: 'youtube', utmMedium: 'video', tracking: null });
  });

  it('paid display', () => {
    const expected = { type: 'paid', category: 'display', vendor: '' };

    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://hebele.hebele.googlesyndication.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'not-empty', utmSource: 'gdn', utmMedium: 'some-medium', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'pp', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'display', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: '', utmSource: 'dv360', utmMedium: 'some-medium', tracking: null });
    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'cpc', tracking: null });
    assert(expected, { referrer: 'some-referrer', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'paid' });
    assert(expected, { referrer: '', utmSource: '', utmMedium: '', tracking: 'paid' });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.com/', utmSource: 'newsshowcase', utmMedium: 'discover', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://googleads.g.doubleclick.net/', utmSource: 'some', utmMedium: 'some', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.com/', utmSource: 'google', utmMedium: 'businesslistings', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: '', utmSource: '', utmMedium: 'google', tracking: 'paid' });
  });

  it('paid affiliate', () => {
    const expected = { type: 'paid', category: 'affiliate', vendor: '' };

    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'affiliate', tracking: null });
  });

  it('earned llm', () => {
    const expected = { type: 'earned', category: 'llm', vendor: '' };

    // OpenAI / ChatGPT
    assert({ ...expected, vendor: 'openai' }, { referrer: 'https://chatgpt.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: '', utmSource: 'chatgpt.com', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: '', utmSource: 'chatgpt.com', utmMedium: 'paidsearch', tracking: 'paid' });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'https://openai.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'https://subdomain.chatgpt.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'https://subdomain.openai.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'openai.com', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'subdomain.chatgpt.com', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'openai' }, { referrer: 'subdomain.openai.com', utmSource: '', utmMedium: '', tracking: null });

    // Perplexity
    assert({ ...expected, vendor: 'perplexity' }, { referrer: 'https://www.perplexity.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'perplexity' }, { referrer: 'www.perplexity.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'perplexity' }, { referrer: '', utmSource: 'perplexity', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'perplexity' }, { referrer: '', utmSource: 'perplexity.ai', utmMedium: '', tracking: null });

    // Claude
    assert({ ...expected, vendor: 'claude' }, { referrer: 'https://claude.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'claude' }, { referrer: 'claude.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'claude' }, { referrer: '', utmSource: 'claude', utmMedium: '', tracking: null });

    // Microsoft Copilot
    assert({ ...expected, vendor: 'microsoft' }, { referrer: 'https://copilot.microsoft.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'microsoft' }, { referrer: 'copilot.microsoft.com', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'microsoft' }, { referrer: 'https://m365.cloud.microsoft/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'microsoft' }, { referrer: '', utmSource: 'copilot', utmMedium: '', tracking: null });

    // Google Gemini
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://gemini.google.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'gemini.google.com', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: '', utmSource: 'gemini', utmMedium: '', tracking: null });

    // DeepSeek
    assert({ ...expected, vendor: 'deepseek' }, { referrer: 'https://deepseek.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'deepseek' }, { referrer: 'https://chat.deepseek.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'deepseek' }, { referrer: 'deepseek.com', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'deepseek' }, { referrer: '', utmSource: 'deepseek', utmMedium: '', tracking: null });

    // Mistral
    assert({ ...expected, vendor: 'mistral' }, { referrer: 'https://chat.mistral.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'mistral' }, { referrer: 'chat.mistral.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'mistral' }, { referrer: 'mistral.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'mistral' }, { referrer: '', utmSource: 'mistral', utmMedium: '', tracking: null });

    // Meta AI - with subdomain like l.meta.ai
    assert({ ...expected, vendor: 'meta' }, { referrer: 'https://meta.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'meta' }, { referrer: 'https://l.meta.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'meta' }, { referrer: 'https://www.meta.ai/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'meta' }, { referrer: 'meta.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'meta' }, { referrer: 'l.meta.ai', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'meta' }, { referrer: '', utmSource: 'meta.ai', utmMedium: '', tracking: null });
  });

  it('earned search', () => {
    const expected = { type: 'earned', category: 'search', vendor: '' };

    assert({ ...expected, vendor: 'bing' }, { referrer: 'https://www.bing.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.co.uk/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'yahoo' }, { referrer: 'https://yahoo.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'some' });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://google.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: 'some' });
    assert({ ...expected, vendor: 'google' }, { referrer: 'https://www.google.com/', utmSource: 'google', utmMedium: 'organicgmb', tracking: null });
  });

  it('earned social', () => {
    const expected = { type: 'earned', category: 'social', vendor: '' };

    assert({ ...expected, vendor: 'facebook' }, { referrer: 'https://www.facebook.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'tiktok' }, { referrer: 'https://www.tiktok.com/', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: 'https://some-site.com/', utmSource: 'some-source', utmMedium: 'organicsocial', tracking: null });
  });

  it('earned video', () => {
    const expected = { type: 'earned', category: 'video', vendor: '' };

    assert({ ...expected, vendor: 'youtube' }, { referrer: 'https://www.youtube.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'youtube' }, { referrer: 'https://www.youtube.com/', utmSource: '', utmMedium: '', tracking: null });
    assert({ ...expected, vendor: 'dailymotion' }, { referrer: 'https://www.dailymotion.com/', utmSource: 'some-source', utmMedium: 'some-medium', tracking: null });
  });

  it('earned referral', () => {
    const expected = { type: 'earned', category: 'referral', vendor: '' };

    assert(expected, { referrer: 'https://some-site.com/', utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned direct', () => {
    const expected = { type: 'owned', category: 'direct', vendor: '' };

    assert(expected, { referrer: '', utmSource: '', utmMedium: '', tracking: null });
    assert(expected, { referrer: '(direct)', utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned internal', () => {
    const expected = { type: 'owned', category: 'internal', vendor: '' };

    assert(expected, { referrer: origin, utmSource: '', utmMedium: '', tracking: null });
  });

  it('owned email', () => {
    const expected = { type: 'owned', category: 'email', vendor: '' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: '', tracking: 'email' });
    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'email', tracking: null });
    assert(expected, { referrer: 'not-empty', utmSource: '', utmMedium: 'some-medium', tracking: 'email' });
    assert(expected, { referrer: 'not-empty', utmSource: 'some-source', utmMedium: 'newsletter', tracking: null });
  });

  it('owned sms', () => {
    const expected = { type: 'owned', category: 'sms', vendor: '' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'sms', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'mms', tracking: null });
  });

  it('owned qr', () => {
    const expected = { type: 'owned', category: 'qr', vendor: '' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'qr', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'qrcode', tracking: null });
  });

  it('owned push', () => {
    const expected = { type: 'owned', category: 'push', vendor: '' };

    assert(expected, { referrer: '', utmSource: 'some-source', utmMedium: 'push', tracking: null });
    assert(expected, { referrer: '', utmSource: '', utmMedium: 'pushnotification', tracking: null });
  });

  it('owned uncategorized', () => {
    const expected = { type: 'owned', category: 'uncategorized', vendor: '' };

    assert(expected, { referrer: 'some', utmSource: 'some', utmMedium: 'some', tracking: null });
    assert(expected, { referrer: '', utmSource: 'some', utmMedium: 'some', tracking: null });
  });

  describe('Remediated cases', () => {
    it('does not falsely classify vendor as openai', () => {
      const expected = { type: 'paid', category: 'display', vendor: '' };
      assert(expected, { referrer: 'https://example.chatopenai.com', utmSource: 'display', utmMedium: 'display', tracking: null });
    });

    it('does not falsely classify referrer as llm', () => {
      const expected = { type: 'earned', category: 'referral', vendor: '' };
      assert(expected, { referrer: 'https://example.chatopenai.com/', utmSource: '', utmMedium: '', tracking: null });
    });

    it('meta as utm_source in paid social context maps to facebook, not meta', () => {
      // When utm_source is 'meta' but context is paid social (not LLM), vendor should be 'facebook'
      const expected = { type: 'paid', category: 'social', vendor: 'facebook' };
      assert(expected, { referrer: '', utmSource: 'meta', utmMedium: 'paidsocial', tracking: null });
    });

    it('meta.ai referrer in LLM context maps to vendor meta, not facebook', () => {
      // When referrer is meta.ai (LLM), vendor should be 'meta' not 'facebook'
      const expected = { type: 'earned', category: 'llm', vendor: 'meta' };
      assert(expected, { referrer: 'https://l.meta.ai/', utmSource: '', utmMedium: '', tracking: null });
      assert(expected, { referrer: 'meta.ai', utmSource: '', utmMedium: '', tracking: null });
    });
  });
});
