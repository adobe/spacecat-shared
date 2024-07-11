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

const VARIANT_CHECKPOINT = 'variant';

function getOrCreateLanguageObject(languageInsights, language) {
  let languageObject = languageInsights.find((l) => l.language === language);
  if (!languageObject) {
    languageObject = {
      language,
      count: 0, // Tracks the total number of events for this page language
      mismatches: {
        type1: {
          preferredLanguages: {}, // Type 1 mismatches
        },
        type2: {
          preferredLanguages: {}, // Type 2 mismatches
        },
        type3: {
          preferredLanguages: {}, // Type 3 mismatches
        },
      },
      regions: {}, // Tracks the count of events for each region
    };
    languageInsights.push(languageObject);
  }
  return languageObject;
}

function handler(bundles) {
  const languageInsights = [];

  for (const bundle of bundles) {
    let preferredLanguages = [];
    let pageLanguage = null;
    let userRegion = null;

    for (const event of bundle.events) {
      if (event.checkpoint === VARIANT_CHECKPOINT) {
        const { target, source } = event;

        if (source === 'preferred-languages') {
          preferredLanguages = target.split(',').map((lang) => lang.trim());
        }

        if (source === 'page-language') {
          pageLanguage = target;
        }

        if (source === 'user-region') {
          userRegion = target;
        }
      }
    }

    if (pageLanguage) {
      const languageObject = getOrCreateLanguageObject(languageInsights, pageLanguage);
      languageObject.count += 1; // Increment the total count for this page language

      // Type 1 Mismatch: List out each mismatch if the preferred language list
      // does not contain the page language
      const isType1Mismatch = !preferredLanguages.includes(pageLanguage);
      if (isType1Mismatch) {
        preferredLanguages.forEach((preferredLanguage) => {
          if (!languageObject.mismatches.type1.preferredLanguages[preferredLanguage]) {
            languageObject.mismatches.type1.preferredLanguages[preferredLanguage] = 1;
          } else {
            languageObject.mismatches.type1.preferredLanguages[preferredLanguage] += 1;
          }
        });
      }

      // Type 2 Mismatch: Count as one mismatch if any preferred language
      // is different from page language
      const isType2Mismatch = preferredLanguages.some(
        (preferredLanguage) => preferredLanguage !== pageLanguage,
      );
      if (isType2Mismatch) {
        const preferredLanguage = preferredLanguages.join(',');
        if (!languageObject.mismatches.type2.preferredLanguages[preferredLanguage]) {
          languageObject.mismatches.type2.preferredLanguages[preferredLanguage] = 1;
        } else {
          languageObject.mismatches.type2.preferredLanguages[preferredLanguage] += 1;
        }
      }

      // Type 3 Mismatch: Compare each language in preferred language list to page language,
      // and count each mismatch
      preferredLanguages.forEach((preferredLanguage) => {
        if (preferredLanguage !== pageLanguage) {
          if (!languageObject.mismatches.type3.preferredLanguages[preferredLanguage]) {
            languageObject.mismatches.type3.preferredLanguages[preferredLanguage] = 1;
          } else {
            languageObject.mismatches.type3.preferredLanguages[preferredLanguage] += 1;
          }
        }
      });

      // Track regions
      if (userRegion) {
        if (!languageObject.regions[userRegion]) {
          languageObject.regions[userRegion] = 1;
        } else {
          languageObject.regions[userRegion] += 1;
        }
      }
    }
  }

  return languageInsights;
}

export default {
  handler,
  checkpoints: VARIANT_CHECKPOINT,
};
