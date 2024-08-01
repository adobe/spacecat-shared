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

/*
 * --------- DEFINITIONS ----------------
 */

// Referrer related
// matches second level domains 1:1 ignoring subdomains and top-level domains
// for example: https://l.instagram.com matches, whereas https://wwww.linstagram.com does not
const referrers = {
  search: /^(https?:\/\/)?(.*\.)?(google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask)\.(.*)(\/|$)/,
  social: /^(https?:\/\/)?(.*\.)?(facebook|tiktok|snapchat|x|twitter|pinterest|reddit|linkedin|threads|quora|discord|tumblr|mastodon|bluesky|instagram)\.(.*)(\/|$)/,
  ad: /googlesyndication|2mdn/,
  video: /^(https?:\/\/)?(.*\.)?(youtube|vimeo|twitch|dailymotion|wistia)\.(.*)(\/|$)/,
};

const mediums = {
  paidall: /^\bpp\b|(.*(cp[acmuv]|ppc|paid).*)$/, // matches 'pp', *cp[acmuv]*, *ppc*, *paid*
  paidsearch: /google|paidsearch|sea|sem/,
  paidsocial: /paidsocial|socialpaid|facebook|gnews|instagramfeed|instagramreels|instagramstories|line|linkedin|metasearch/,
  organicsocial: /organicsocial/,
  socialall: /social|fbig/,
  display: /display|banner|poster|placement/,
  affiliate: /^aff|patrocinados|referral/,
  email: ['em', 'email', 'mail', 'newsletter'],
  sms: ['sms', 'mms'],
  qr: ['qr', 'qrcode'],
  push: ['push', 'pushnotification'],
};

const sources = {
  paid: ['gdn'],
  social: /^\b(ig|fb)\b|(.*(meta|tiktok|facebook|snapchat|twitter|igshopping|instagramlinkedin).*)$/,
  search: /google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask|newsshowcase/,
  video: /youtube|vimeo|twitch|dailymotion|wistia/,
  display: /optumib2b|jun|googleads|dv360|microsoft|flipboard|programmatic|yext|gdn|banner/,
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
const RULES = (origin) => ([
  // PAID
  { type: 'paid', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: anyOf(mediums.paidsearch), tracking: none },
  { type: 'paid', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: anyOf(mediums.paidsocial), tracking: none },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: notEmpty, utmMedium: anyOf(mediums.socialall), tracking: any },
  { type: 'paid', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: any, utmMedium: anyOf(mediums.display), tracking: any },
  { type: 'paid', category: 'display', referrer: anyOf(referrers.ad), utmSource: any, utmMedium: any, tracking: any },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: anyOf(sources.display), utmMedium: any, tracking: any },
  { type: 'paid', category: 'affiliate', referrer: any, utmSource: any, utmMedium: anyOf(mediums.affiliate), tracking: any },

  // low prio PAIDs
  { type: 'paid', category: 'search', referrer: none, utmSource: anyOf(sources.search), utmMedium: any, tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(origin), utmSource: any, utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(origin), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },

  // EARNED
  { type: 'earned', category: 'search', referrer: anyOf(referrers.search), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'search', referrer: anyOf(referrers.search), utmSource: any, utmMedium: not(mediums.paidall), tracking: not(paidTrackingParams) },
  { type: 'earned', category: 'social', referrer: anyOf(referrers.social), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'social', referrer: not(origin), utmSource: any, utmMedium: anyOf(mediums.organicsocial), tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(referrers.video), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(referrers.video), utmSource: any, utmMedium: not(mediums.paidall), tracking: none },
  { type: 'earned', category: 'referral', referrer: not(origin), utmSource: none, utmMedium: none, tracking: none },

  // OWNED
  { type: 'owned', category: 'direct', referrer: none, utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'internal', referrer: anyOf(origin), utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: any, tracking: anyOf(emailTrackingParams) },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: anyOf(mediums.email), tracking: any },
  { type: 'owned', category: 'sms', referrer: none, utmSource: any, utmMedium: anyOf(mediums.sms), tracking: none },
  { type: 'owned', category: 'qr', referrer: none, utmSource: any, utmMedium: anyOf(mediums.qr), tracking: none },
  { type: 'owned', category: 'push', referrer: none, utmSource: any, utmMedium: anyOf(mediums.push), tracking: none },

  // FALLBACK
  { type: 'owned', category: 'uncategorized', referrer: any, utmSource: any, utmMedium: any, tracking: any },
]);

export function classifyTrafficSource(url, referrer, utmSource, utmMedium, trackingParams) {
  const { origin } = new URL(url);
  const rules = RULES(origin);

  const sanitize = (str) => (str || '').toLowerCase().replace(/[^a-zA-Z0-9]/, '');

  const { type, category } = rules.find((rule) => (
    rule.referrer(referrer)
    && rule.utmSource(sanitize(utmSource))
    && rule.utmMedium(sanitize(utmMedium))
    && rule.tracking(trackingParams)
  ));

  if (type === 'owned' && category === 'uncategorized') {
    console.log(`referrer: ${referrer}, source: ${utmSource}, medium: ${utmMedium}, tracking: ${trackingParams}`);
  }

  return {
    type,
    category,
  };
}
