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

export const GRANULARITY = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
};

export const COOKIE_CONSENT_SELECTORS = [
  // OneTrust
  'onetrust',
  '.onetrust-banner',
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
  '#ot-sdk-cookie-policy',
  '.ot-sdk-container',
  '.ot-sdk-row',
  '.ot-sdk-column',
  '.ot-sdk-show-settings',
  '#ot-',
  '.ot-',

  // Cookiebot / Usercentrics
  '#CybotCookiebotDialog',
  '.CybotCookiebotDialog',
  '#CookiebotWidget',
  '.CookiebotWidget',
  '.cookie-consent__banner',
  '.cookie-consent__dialog',
  '.cookie-consent__button',

  // TrustArc
  'truste-',
  '#truste-',
  '#truste-consent-banner',
  '.truste-consent-banner',
  '#truste-consent-button',
  '.truste-consent-button',
  '.truste-consent-text',
  '.truste-consent-close',

  // CookieYes
  '#cookieyes-banner',
  '.cky-consent',
  '.cky-banner',
  '.cky-btn',
  '.cky-btn-accept',
  '.cky-btn-reject',
  '.cky-btn-settings',

  // Termly
  '#termly-consent-banner',
  '.termly-consent-banner',
  '.termly-consent-button',
  '.termly-consent-text',
  '.termly-consent-close',

  // CookieScript
  '#cookiescript_injected',
  '.cookiescript-consent',
  '.cookiescript-banner',
  '.cookiescript-btn',
  '.cookiescript-btn-accept',
  '.cookiescript-btn-reject',
  '.cookiescript-btn-settings',

  // CookieFirst
  '#cookiefirst-root',
  '.cookiefirst-banner',
  '.cookiefirst-button',
  '.cookiefirst-text',
  '.cookiefirst-close',

  // Quantcast Choice
  '#qc-cmp2-ui',
  '.qc-cmp2-ui',
  '.qc-cmp2-summary',
  '.qc-cmp2-footer',
  '.qc-cmp2-header',
  '.qc-cmp2-buttons',
  '.qc-cmp2-button',
  '.qc-cmp2-button-accept',
  '.qc-cmp2-button-reject',

  // Crownpeak (Evidon)
  '#evidon-banner',
  '.evidon-banner',
  '.evidon-button',
  '.evidon-text',
  '.evidon-close',

  // Popupsmart
  '#popupsmart-consent',
  '.popupsmart-consent',
  '.popupsmart-banner',
  '.popupsmart-button',
  '.popupsmart-text',
  '.popupsmart-close',
];
