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
/* eslint-disable object-curly-newline */

import { hasText } from '@adobe/spacecat-shared-utils';
import URI from 'urijs';

/**
 * Extracts the second-level domain (SLD) from a given URL.
 *
 * For example, for the URL `https://subdomain.example.co.uk/path`, this
 * function will return `example` (excluding the TLD `co.uk`).
 *
 * @param {string} url - The URL from which to extract the second-level domain.
 * @returns {string} The second-level domain of the given URL, or the original
 *                    URL if it does not contain any text.
 */
function getSecondLevelDomain(url) {
  if (!hasText(url)) return url;
  const uri = new URI(url);
  const domain = uri.domain();
  const tld = uri.tld();
  return domain.split(`.${tld}`)[0];
}

/*
 * --------- DEFINITIONS ----------------
 */

// Referrer related
const referrers = {
  search: /google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask/,
  social: /^\b(x)\b|(.*(facebook|tiktok|snapchat|x|twitter|pinterest|reddit|linkedin|threads|quora|discord|tumblr|mastodon|bluesky|instagram).*)$/,
  ad: /googlesyndication|2mdn|doubleclick|syndicatedsearch/,
  video: /youtube|vimeo|twitch|dailymotion|wistia/,
};

const mediums = {
  paidall: /^\bpp\b|(.*(cp[acmuv]|ppc|paid).*)$/, // matches 'pp', *cp[acmuv]*, *ppc*, *paid*
  paidsearch: /google|paidsearch|sea|sem|maps/,
  paidsocial: /paidsocial|socialpaid|fbig|facebook|gnews|instagram|line|linkedin|metasearch/,
  organic: /organic/,
  socialall: /^\b(soc)\b|(.*(social).*)$/,
  display: /display|banner|poster|placement|image|dcm|businesslistings/,
  video: /video/,
  affiliate: /^aff|patrocinados|referral/,
  email: ['em', 'email', 'mail', 'newsletter'],
  sms: ['sms', 'mms'],
  qr: ['qr', 'qrcode'],
  push: ['push', 'pushnotification'],
};

const sources = {
  social: /^\b(ig|fb|x|soc)\b|(.*(meta|tiktok|facebook|snapchat|twitter|igshopping|instagram|linkedin|reddit).*)$/,
  search: /^\b(goo)\b|(.*(sea|google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask).*)$/,
  video: /youtube|vimeo|twitch|dailymotion|wistia/,
  display: /optumib2b|jun|googleads|dv36|dv360|microsoft|flipboard|programmatic|yext|gdn|banner|newsshowcase/,
  affiliate: /brandreward|yieldkit|fashionistatop|partner|linkbux|stylesblog|linkinbio|affiliate/,
  email: /sfmc|email/,
};

// Tracking params - based on the checkpoints we have in rum-enhancer now
// const organicTrackingParams = ['srsltid']; WE DO NOT HAVE THIS AS OF NOW
const paidTrackingParams = ['paid'];
const emailTrackingParams = ['email'];

/*
 * --------- HELPERS ----------------
 */

const any = () => true;

const anyOf = (truth) => (text) => {
  if (Array.isArray(truth)) return truth.includes(text);
  if (truth instanceof RegExp) return truth.test(text);
  return truth === text;
};

const none = (input) => (Array.isArray(input) ? input.length === 0 : !hasText(input));

const not = (truth) => (text) => {
  if (!hasText(text)) return false;
  if (Array.isArray(truth)) return !truth.includes(text);
  if (truth instanceof RegExp) return !truth.test(text);
  return truth !== text;
};

const notEmpty = (text) => hasText(text);

/*
 * --------- RULES ----------------
 */

// ORDER IS IMPORTANT
const RULES = (domain) => ([
  // PAID
  { type: 'paid', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: anyOf(mediums.paidsearch), tracking: none },
  { type: 'paid', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'search', referrer: anyOf(referrers.ad), utmSource: any, utmMedium: anyOf(mediums.paidsearch), tracking: any },
  { type: 'paid', category: 'search', referrer: none, utmSource: anyOf(sources.search), utmMedium: anyOf(mediums.paidsearch), tracking: any },

  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: anyOf(mediums.paidsocial), tracking: none },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: notEmpty, utmMedium: anyOf(mediums.socialall), tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.paidsocial), tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: notEmpty, utmMedium: notEmpty, tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.socialall), tracking: any },

  { type: 'paid', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'video', referrer: none, utmSource: anyOf(sources.video), utmMedium: anyOf(mediums.video), tracking: any },

  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: any, utmMedium: anyOf(mediums.display), tracking: any },
  { type: 'paid', category: 'display', referrer: anyOf(referrers.ad), utmSource: any, utmMedium: any, tracking: any },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: anyOf(sources.display), utmMedium: any, tracking: any },
  { type: 'paid', category: 'display', referrer: none, utmSource: notEmpty, utmMedium: anyOf(mediums.display), tracking: any },
  { type: 'paid', category: 'display', referrer: none, utmSource: notEmpty, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'display', referrer: none, utmSource: anyOf(sources.display), utmMedium: notEmpty, tracking: any },
  { type: 'paid', category: 'display', referrer: any, utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'display', referrer: anyOf(referrers.ad), utmSource: any, utmMedium: any, tracking: any },

  { type: 'paid', category: 'affiliate', referrer: any, utmSource: any, utmMedium: anyOf(mediums.affiliate), tracking: any },

  // low prio PAIDs
  { type: 'paid', category: 'search', referrer: none, utmSource: anyOf(sources.search), utmMedium: any, tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(domain), utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(domain), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },

  // EARNED
  { type: 'earned', category: 'search', referrer: anyOf(referrers.search), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: not(mediums.paidall), tracking: not(paidTrackingParams) },
  { type: 'earned', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: anyOf(mediums.organic), tracking: none },
  { type: 'earned', category: 'social', referrer: anyOf(referrers.social), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'social', referrer: not(domain), utmSource: any, utmMedium: anyOf(mediums.organic), tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(referrers.video), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: not(mediums.paidall), tracking: none },
  { type: 'earned', category: 'referral', referrer: not(domain), utmSource: none, utmMedium: none, tracking: none },

  // OWNED
  { type: 'owned', category: 'direct', referrer: none, utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'internal', referrer: anyOf(domain), utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: any, tracking: anyOf(emailTrackingParams) },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: anyOf(mediums.email), tracking: any },
  { type: 'owned', category: 'sms', referrer: none, utmSource: any, utmMedium: anyOf(mediums.sms), tracking: none },
  { type: 'owned', category: 'qr', referrer: none, utmSource: any, utmMedium: anyOf(mediums.qr), tracking: none },
  { type: 'owned', category: 'push', referrer: none, utmSource: any, utmMedium: anyOf(mediums.push), tracking: none },

  // FALLBACK
  { type: 'owned', category: 'uncategorized', referrer: any, utmSource: any, utmMedium: any, tracking: any },
]);

export function classifyTrafficSource(url, referrer, utmSource, utmMedium, trackingParams) {
  const secondLevelDomain = getSecondLevelDomain(url);
  const rules = RULES(secondLevelDomain);

  const referrerDomain = getSecondLevelDomain(referrer);

  const sanitize = (str) => (str || '').toLowerCase().replace(/[^a-zA-Z0-9]/, '');

  const { type, category } = rules.find((rule) => (
    rule.referrer(referrerDomain)
    && rule.utmSource(sanitize(utmSource))
    && rule.utmMedium(sanitize(utmMedium))
    && rule.tracking(trackingParams)
  ));

  return {
    type,
    category,
  };
}
