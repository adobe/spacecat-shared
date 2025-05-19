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

import { hasText, isNonEmptyObject, isString } from '@adobe/spacecat-shared-utils';
import classifyConsent from '@adobe/rum-distiller/consent.js';

const uncategorized = 'uncategorized';

export function getPageType(bundle, pageTypes) {
  if (!isNonEmptyObject(pageTypes)) {
    return uncategorized;
  }

  const pageTypeEntries = Object.entries(pageTypes);

  const classify = ([, regEx]) => {
    if (regEx instanceof RegExp) {
      return regEx.test(bundle.url);
    }

    return new RegExp(regEx).test(bundle.url);
  };

  const entry = pageTypeEntries.find(classify);

  if (!hasText(entry?.[0]) || entry?.[0] === 'other | Other Pages') {
    return uncategorized;
  }
  return entry?.[0] ?? uncategorized;
}

export function isConsentClick(source) {
  const consent = isString(source) ? classifyConsent(source?.toLocaleLowerCase()) : undefined;
  return !(consent === undefined);
}
