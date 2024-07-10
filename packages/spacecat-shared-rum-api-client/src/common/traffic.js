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
const searchEngines = /^(https?:\/\/)?(.*\.)?(google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask)\.(.*)(\/|$)/;
const socialMedias = /^(https?:\/\/)?(.*\.)?(facebook|tiktok|snapchat|x|twitter|pinterest|reddit|linkedin|threads|quora|discord|tumblr|mastodon|bluesky|instagram)\.(.*)(\/|$)/;
const adNetworks = /googlesyndication|2mdn/;
const videoPlatforms = /^(https?:\/\/)?(.*\.)?(youtube|vimeo|twitch|dailymotion|wistia)\.(.*)(\/|$)/;

// UTM Source related
const paidDisplaySources = ['gdn'];

// UTM Medium related
// matches 'pp', *cp[acmuv]*, *ppc*, *paid*
const paidUTMMediums = /^\bpp\b|(.*(cp[acmuv]|ppc|paid|display|banner|poster|placement).*)$/;
const searchEngineUTMMediums = ['google', 'paidsearch', 'paidsearchnb', 'sea', 'sem'];
const socialMediaUTMMediums = ['facebook', 'gnews', 'instagramfeed', 'instagramreels', 'instagramstories', 'line', 'linkedin', 'metasearch', 'organicsocialown', 'paidsocial', 'social', 'sociallinkedin', 'socialpaid'];
const affiliateUTMMediums = ['aff', 'affiliate', 'affiliatemarketing'];
const organicUTMMediums = ['organicsocial'];
const emailUTMMediums = ['em', 'email', 'mail', 'newsletter'];
const smsUTMMediums = ['sms', 'mms'];
const qrUTMMediums = ['qr', 'qrcode'];
const pushUTMMediums = ['push', 'pushnotification'];

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
  { type: 'paid', category: 'search', referrer: anyOf(searchEngines), utmSource: any, utmMedium: anyOf(searchEngineUTMMediums), tracking: none },
  { type: 'paid', category: 'search', referrer: anyOf(searchEngines), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'social', referrer: anyOf(socialMedias), utmSource: any, utmMedium: anyOf(socialMediaUTMMediums), tracking: none },
  { type: 'paid', category: 'social', referrer: anyOf(socialMedias), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'video', referrer: anyOf(videoPlatforms), utmSource: any, utmMedium: anyOf(paidUTMMediums), tracking: any },
  { type: 'paid', category: 'video', referrer: anyOf(videoPlatforms), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: any, utmMedium: anyOf(paidUTMMediums), tracking: any },
  { type: 'paid', category: 'display', referrer: anyOf(adNetworks), utmSource: any, utmMedium: any, tracking: any },
  { type: 'paid', category: 'display', referrer: notEmpty, utmSource: anyOf(paidDisplaySources), utmMedium: any, tracking: any },
  { type: 'paid', category: 'affiliate', referrer: notEmpty, utmSource: any, utmMedium: anyOf(affiliateUTMMediums), tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(origin), utmSource: any, utmMedium: anyOf(paidUTMMediums), tracking: any },
  { type: 'paid', category: 'uncategorized', referrer: not(origin), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },

  // EARNED
  { type: 'earned', category: 'search', referrer: anyOf(searchEngines), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'search', referrer: anyOf(searchEngines), utmSource: any, utmMedium: not(paidUTMMediums), tracking: not(paidTrackingParams) },
  { type: 'earned', category: 'social', referrer: anyOf(socialMedias), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'social', referrer: not(origin), utmSource: any, utmMedium: anyOf(organicUTMMediums), tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(videoPlatforms), utmSource: none, utmMedium: none, tracking: none },
  { type: 'earned', category: 'video', referrer: anyOf(videoPlatforms), utmSource: any, utmMedium: not(paidUTMMediums), tracking: none },
  { type: 'earned', category: 'referral', referrer: not(origin), utmSource: none, utmMedium: none, tracking: none },

  // OWNED
  { type: 'owned', category: 'direct', referrer: none, utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'internal', referrer: anyOf(origin), utmSource: none, utmMedium: none, tracking: none },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: any, tracking: anyOf(emailTrackingParams) },
  { type: 'owned', category: 'email', referrer: any, utmSource: any, utmMedium: anyOf(emailUTMMediums), tracking: any },
  { type: 'owned', category: 'sms', referrer: none, utmSource: any, utmMedium: anyOf(smsUTMMediums), tracking: none },
  { type: 'owned', category: 'qr', referrer: none, utmSource: any, utmMedium: anyOf(qrUTMMediums), tracking: none },
  { type: 'owned', category: 'push', referrer: none, utmSource: any, utmMedium: anyOf(pushUTMMediums), tracking: none },

  // FALLBACK
  { type: 'owned', category: 'uncategorized', referrer: any, utmSource: any, utmMedium: any, tracking: any },
]);

export function classifyTrafficSource(url, referrer, utmSource, utmMedium, trackingParams) {
  const { origin } = new URL(url);
  const rules = RULES(origin);

  const { type, category } = rules.find((rule) => (
    rule.referrer(referrer)
    && rule.utmSource(utmSource)
    && rule.utmMedium(utmMedium)
    && rule.tracking(trackingParams)
  ));

  return {
    type,
    category,
  };
}
