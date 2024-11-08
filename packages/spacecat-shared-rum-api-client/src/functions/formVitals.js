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

import { FlatBundle } from '../common/flat-bundle.js';

function collectFormVitals(groupedByUrlId) {
  const { url, items: itemsByUrlId } = groupedByUrlId;

  const result = itemsByUrlId
    .flatMap((item) => item.items)
    .reduce((acc, cur) => {
      // Check for 'viewblock' checkpoint
      if (cur && cur.checkpoint === 'viewblock' && cur.source === '.form') {
        acc.isFormViewPresent = true;
      } else if (cur && cur.checkpoint === 'formsubmit') {
        acc.isFormSubmitPresent = true;
        // for business adobe com  cur.source.toLowerCase().includes('#mktoButton_new')
      } else if (cur && cur.checkpoint === 'click' && cur.source && /\bform\b/.test(cur.source.toLowerCase())) {
        acc.isFormSubmitButtonClickPresent = true;
      }
      return acc;
    }, {
      isFormViewPresent: false,
      isFormSubmitPresent: false,
      isFormSubmitButtonClickPresent: false,
    });

  // Check if any condition was met; if not, return undefined
  const { isFormViewPresent, isFormSubmitPresent, isFormSubmitButtonClickPresent } = result;
  if (!isFormViewPresent && !isFormSubmitPresent && !isFormSubmitButtonClickPresent) {
    return undefined;
  }

  return {
    url,
    isFormViewPresent: result.isFormViewPresent,
    isFormSubmitPresent: result.isFormSubmitPresent,
    isFormSubmitButtonClickPresent: result.isFormSubmitButtonClickPresent,
  };
}

function handler(bundles) {
  return FlatBundle.fromArray(bundles)
    .groupBy('url', 'id')
    .map(collectFormVitals)
    .filter((item) => item !== undefined)
    .sort((a, b) => b.views - a.views); // sort desc by views
}

export default {
  handler,
  checkpoints: ['viewblock', 'formsubmit', 'click'],
};
