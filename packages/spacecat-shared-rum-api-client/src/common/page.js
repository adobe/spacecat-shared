/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { COOKIE_CONSENT_SELECTORS } from './constants.js';

const uncategorized = 'uncategorized';

function canClassifyPage(pageTypes) {
  return pageTypes !== undefined && pageTypes != null;
}

export function getPageType(bundle, pageTypes) {
  if (!canClassifyPage(pageTypes)) {
    return uncategorized;
  }

  const pageTypeEntries = Object.entries(pageTypes);
  if (!pageTypeEntries || pageTypeEntries.length === 0) {
    return uncategorized;
  }

  const classify = ([, regEx]) => {
    if (regEx instanceof RegExp) {
      return regEx.test(bundle.url);
    }

    return new RegExp(regEx).test(bundle.url);
  };

  const entry = pageTypeEntries.find(classify);

  if (entry === null || entry?.[0] === '' || entry?.[0] === 'other') {
    return uncategorized;
  }
  return entry?.[0] ?? uncategorized;
}

export function isConsentClick(source) {
  if (typeof source !== 'string' || !source) {
    return false;
  }

  const sourceLower = source.toLowerCase();
  return COOKIE_CONSENT_SELECTORS.some((keyword) => sourceLower.includes(keyword.toLowerCase()));
}
