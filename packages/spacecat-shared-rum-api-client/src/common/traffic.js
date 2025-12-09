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

import { hasText, prependSchema } from '@adobe/spacecat-shared-utils';
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
export function getSecondLevelDomain(url) {
  if (!hasText(url)) return url;
  if (url === '(direct)') return '';

  try {
    const uri = new URI(prependSchema(url));
    const tld = uri.tld();
    return uri.hostname().split(`.${tld}`)[0];
    /* c8 ignore next 4 */
  } catch (error) {
    // future-proof for the cases where url cannot be parsed for some reason
    return url;
  }
}

/*
 * --------- DEFINITIONS ----------------
 */

// Referrer related
const referrers = {
  search: /google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask/,
  social: /^\b((www\.)?x)\b|(.*(facebook|tiktok|snapchat|twitter|pinterest|reddit|linkedin|threads|quora|discord|tumblr|mastodon|bluesky|instagram).*)$/,
  ad: /googlesyndication|2mdn|doubleclick|syndicatedsearch/,
  video: /youtube|vimeo|twitch|dailymotion|wistia/,
  llm: /\b(chatgpt|openai)\b|perplexity|claude|gemini\.google|copilot\.microsoft|m365\.cloud|(^|\.)?meta$|deepseek|(^|\.)?mistral$/,
};

const mediums = {
  paidall: /^\bpp\b|(.*(cp[acmuv]|ppc|paid).*)$/, // matches 'pp', *cp[acmuv]*, *ppc*, *paid*
  paidsearch: /google|paidsearch|sea|sem|maps/,
  paidsocial: /paidsocial|socialpaid|fbig|facebook|gnews|instagram|line|linkedin|metasearch/,
  organic: /organic/,
  socialall: /^\b(soc)\b|(.*(social).*)$/,
  display: /display|banner|poster|placement|image|dcm|businesslistings/,
  video: /video/,
  affiliate: /^aff|(.*(patrocinados|referral)).*$/,
  email: ['em', 'email', 'mail', 'newsletter'],
  sms: ['sms', 'mms'],
  qr: ['qr', 'qrcode'],
  push: ['push', 'pushnotification'],
};

const sources = {
  social: /^\b(ig|fb|x|soc|ln)\b|(.*(meta|tiktok|facebook|snapchat|twitter|igshopping|instagram|linkedin|reddit).*)$/,
  search: /^\b(goo)\b|(.*(sea|google|yahoo|bing|yandex|baidu|duckduckgo|brave|ecosia|aol|startpage|ask).*)$/,
  video: /youtube|vimeo|twitch|dailymotion|wistia/,
  display: /optumib2b|jun|googleads|dv360|dv36|microsoft|flipboard|programmatic|yext|gdn|banner|newsshowcase/,
  affiliate: /brandreward|yieldkit|fashionistatop|partner|linkbux|stylesblog|linkinbio|affiliate/,
  email: /sfmc|email/,
  llm: /chatgpt|openai|perplexity|claude|gemini|copilot|metaai|deepseek|mistral/,
};

/**
 * Vendor classification rules from https://github.com/adobe/helix-website/blob/main/tools/oversight/acquisition.js#L12
 * Added dailymotion, twitch to the list
 * Using full word match for social media shorts like ig, fb, x
 */
const vendorClassifications = [
  { regex: /google|googleads|google-ads|google_search|google_deman|adwords|dv360|gdn|doubleclick|dbm|gmb|gemini/i, result: 'google' },
  { regex: /instagram|\b(ig)\b|\b(Insta)\b/i, result: 'instagram' },
  { regex: /facebook|\b(fb)\b|meta/i, result: 'facebook' },
  { regex: /bing/i, result: 'bing' },
  { regex: /tiktok/i, result: 'tiktok' },
  { regex: /youtube|yt/i, result: 'youtube' },
  { regex: /linkedin|\b(ln)\b/i, result: 'linkedin' },
  { regex: /twitter|^\b(x)\b/i, result: 'x' },
  { regex: /snapchat/i, result: 'snapchat' },
  { regex: /microsoft|copilot|m365\.cloud/i, result: 'microsoft' },
  { regex: /pinterest/i, result: 'pinterest' },
  { regex: /reddit/i, result: 'reddit' },
  { regex: /spotify/i, result: 'spotify' },
  { regex: /criteo/i, result: 'criteo' },
  { regex: /taboola/i, result: 'taboola' },
  { regex: /outbrain/i, result: 'outbrain' },
  { regex: /yahoo/i, result: 'yahoo' },
  { regex: /marketo/i, result: 'marketo' },
  { regex: /eloqua/i, result: 'eloqua' },
  { regex: /substack/i, result: 'substack' },
  { regex: /line/i, result: 'line' },
  { regex: /yext/i, result: 'yext' },
  { regex: /teads/i, result: 'teads' },
  { regex: /yandex/i, result: 'yandex' },
  { regex: /baidu/i, result: 'baidu' },
  { regex: /amazon|ctv/i, result: 'amazon' },
  { regex: /dailymotion/i, result: 'dailymotion' },
  { regex: /twitch/i, result: 'twitch' },
  { regex: /\b(chatgpt|openai)\b/i, result: 'openai' },
  { regex: /perplexity/i, result: 'perplexity' },
  { regex: /claude/i, result: 'claude' },
  { regex: /deepseek/i, result: 'deepseek' },
  { regex: /mistral/i, result: 'mistral' },
  { regex: /meta\.ai/i, result: 'meta' },
  { regex: /direct/i, result: 'direct' },
];

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

/* c8 ignore next 1 */
const none = (input) => (Array.isArray(input) ? input.length === 0 : !hasText(input));

const not = (truth) => (text) => {
  if (!hasText(text)) return false;
  if (Array.isArray(truth)) return !truth.includes(text);
  if (truth instanceof RegExp) return !truth.test(text);
  return truth !== text;
};

const notEmpty = (text) => hasText(text);

// overrides
const OVERRIDES = [
  { when: (ctx) => (ctx.utmSource || '').toLowerCase() === 'chatgpt.com', set: { type: 'earned', category: 'llm', vendor: 'openai' } },
  // meta ai: when referrer is 'meta', set vendor to 'meta' (not 'facebook')
  { when: (ctx) => ctx.type === 'earned' && ctx.category === 'llm' && /(^|\.)meta$/i.test(ctx.referrerDomain), set: { vendor: 'meta' } },
  // meta ai: when utm_source is 'meta.ai', set vendor to 'meta' (not 'facebook')
  { when: (ctx) => ctx.type === 'earned' && ctx.category === 'llm' && /^meta\.ai$/i.test(ctx.utmSource || ''), set: { vendor: 'meta' } },
];

function applyOverrides(classification, context) {
  const override = OVERRIDES.find((rule) => rule.when(context));
  return override ? { ...classification, ...override.set } : classification;
}

// allowed known vendors per category
const ALLOWED_VENDORS = {
  earned: {
    llm: ['openai', 'claude', 'perplexity', 'microsoft', 'google', 'deepseek', 'mistral', 'meta'],
    search: ['google', 'bing', 'yahoo', 'yandex', 'baidu', 'duckduckgo', 'brave', 'ecosia', 'aol'],
    social: null, // any vendor allowed
    video: ['youtube', 'vimeo', 'twitch', 'tiktok', 'dailymotion'],
    referral: null, // any vendor allowed
  },
  paid: {
    search: ['google', 'bing', 'yahoo', 'yandex', 'baidu', 'microsoft'],
    social: null, // any vendor allowed
    video: ['youtube', 'vimeo', 'twitch', 'dailymotion'],
    display: null, // any vendor allowed
    affiliate: null, // any vendor allowed
    uncategorized: null, // any vendor allowed
  },
  owned: {
    direct: ['direct'],
    internal: null, // any vendor allowed
    email: null, // any vendor allowed
    sms: null, // any vendor allowed
    qr: null, // any vendor allowed
    push: null, // any vendor allowed
    uncategorized: null, // any vendor allowed
  },
};

/**
 * Validates if a vendor is allowed for the given type/category combination.
 * @param {string} type - Traffic type (earned, paid, owned)
 * @param {string} category - Traffic category (llm, search, social, etc.)
 * @param {string} vendor - Vendor name to validate
 * @returns {string} The vendor if allowed, empty string otherwise
 */
function validateVendor(type, category, vendor) {
  if (!vendor) return '';

  const allowedVendors = ALLOWED_VENDORS[type]?.[category];

  // null/undefined means any vendor is allowed
  if (!allowedVendors) return vendor;

  // Check if vendor is in the allowed list
  return allowedVendors.includes(vendor) ? vendor : '';
}

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
  { type: 'paid', category: 'search', referrer: none, utmSource: anyOf(sources.search), utmMedium: none, tracking: anyOf(paidTrackingParams) },

  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: anyOf(mediums.paidsocial), tracking: none },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: any, utmMedium: any, tracking: anyOf(paidTrackingParams) },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: notEmpty, utmMedium: anyOf(mediums.socialall), tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.paidsocial), tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.paidall), tracking: any },
  { type: 'paid', category: 'social', referrer: anyOf(referrers.social), utmSource: notEmpty, utmMedium: notEmpty, tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: anyOf(mediums.socialall), tracking: any },
  { type: 'paid', category: 'social', referrer: none, utmSource: anyOf(sources.social), utmMedium: any, tracking: anyOf(paidTrackingParams) },

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
  { type: 'earned', category: 'llm', referrer: anyOf(referrers.llm), utmSource: any, utmMedium: any, tracking: none },
  { type: 'earned', category: 'llm', referrer: any, utmSource: anyOf(sources.llm), utmMedium: any, tracking: none },
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

export function extractTrafficHints(bundle) {
  /* c8 ignore next 1 */
  const findEvent = (checkpoint, source = '') => bundle.events.find((e) => e.checkpoint === checkpoint && (!source || e.source === source)) || {};

  const referrer = findEvent('enter').source || '';
  const utmSource = findEvent('utm', 'utm_source').target || '';
  const utmMedium = findEvent('utm', 'utm_medium').target || '';
  const tracking = findEvent('paid').checkpoint || findEvent('email').checkpoint || '';
  const trackingSource = findEvent('paid').source || findEvent('email').source || '';
  const trackingTarget = findEvent('paid').target || findEvent('email').target || '';

  return {
    url: bundle.url,
    weight: bundle.weight,
    referrer,
    utmSource,
    utmMedium,
    tracking,
    trackingSource,
    trackingTarget,
  };
}

/**
 * Returns the name of the vendor obtained from respective order: referrer, utmSource, utmMedium.
 * For example: facebook instead of www.facebook.com
 * @param {*} referrer
 */
export function classifyVendor(referrer, utmSource, utmMedium) {
  const result = vendorClassifications.find(({ regex }) => {
    if (regex.test(referrer)) return true;
    if (regex.test(utmSource)) return true;
    if (regex.test(utmMedium)) return true;
    return false;
  });
  return result ? result.result : '';
}

export function classifyTrafficSource(url, referrer, utmSource, utmMedium, trackingEvent) {
  const secondLevelDomain = getSecondLevelDomain(url);
  const rules = RULES(secondLevelDomain);

  const referrerDomain = getSecondLevelDomain(referrer);

  const sanitize = (str) => (str || '').toLowerCase().replace(/[^a-zA-Z0-9]/, '');

  const match = rules.find((rule) => (
    rule.referrer(referrerDomain)
    && rule.utmSource(sanitize(utmSource))
    && rule.utmMedium(sanitize(utmMedium))
    && rule.tracking(trackingEvent)
  ));
  let { type, category } = match;
  let vendor = classifyVendor(referrerDomain, utmSource, utmMedium);

  // apply overrides
  const overridden = applyOverrides(
    { type, category, vendor },
    { type, category, utmSource, utmMedium, referrerDomain },
  );
  type = overridden.type;
  category = overridden.category;
  vendor = overridden.vendor;

  // validate vendor against allowed vendors for this type/category
  const validatedVendor = validateVendor(type, category, vendor);

  return {
    type,
    category,
    vendor: validatedVendor,
  };
}

export function classifyTraffic(bundle) {
  const {
    url,
    weight,
    referrer,
    utmSource,
    utmMedium,
    tracking,
    trackingSource,
    trackingTarget,
  } = extractTrafficHints(bundle);

  let source = utmSource;

  // When there are no explicit UTM parameters, fall back to tracking source
  // as the classification source. This lets "paid + google (tracking_source)"
  // behave like "paid + google (utm_source)" without mutating actual UTMs.
  if (!source && !utmMedium && trackingSource) {
    source = trackingSource;
  }

  return {
    url,
    weight,
    trackingSource,
    trackingTarget,
    ...classifyTrafficSource(url, referrer, source, utmMedium, tracking),
  };
}
