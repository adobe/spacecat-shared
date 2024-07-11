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

/*
 * This file processes bundles of events to generate insights on languages and regions.
 * It focuses on the "variant" checkpoint, handling preferred language, page language, and user region.
 */

const VARIANT_CHECKPOINT = 'variant';

function getOrCreateLanguageObject(languageInsights, language) {
  let languageObject = languageInsights.find((l) => l.language === language);
  if (!languageObject) {
    languageObject = {
      language,
      count: 0,
      mismatches: {
        preferredLanguages: {},
        regions: {},
      },
    };
    languageInsights.push(languageObject);
  }
  return languageObject;
}

function handler(bundles) {
  const languageInsights = [];

  for (const bundle of bundles) {
    let preferredLanguage = null;
    let pageLanguage = null;
    let userRegion = null;

    for (const event of bundle.events) {
      if (event.checkpoint === VARIANT_CHECKPOINT) {
        const { target, source } = event;

        if (source === 'preferred-languages') {
          preferredLanguage = target;
        }

        if (source === 'page-language') {
          pageLanguage = target;
        }

        if (source === 'user-region') {
          userRegion = target;
        }
      }
    }

    if (preferredLanguage && pageLanguage && preferredLanguage !== pageLanguage) {
      const languageObject = getOrCreateLanguageObject(languageInsights, pageLanguage);
      languageObject.count += 1;
      if (!languageObject.mismatches.preferredLanguages[preferredLanguage]) {
        languageObject.mismatches.preferredLanguages[preferredLanguage] = 1;
      } else {
        languageObject.mismatches.preferredLanguages[preferredLanguage] += 1;
      }
    }

    if (pageLanguage && userRegion) {
      const languageObject = getOrCreateLanguageObject(languageInsights, pageLanguage);
      languageObject.count += 1;
      if (!languageObject.mismatches.regions[userRegion]) {
        languageObject.mismatches.regions[userRegion] = 1;
      } else {
        languageObject.mismatches.regions[userRegion] += 1;
      }
    }
  }

  return languageInsights;
}

export default{
    handler,
    checkpoints: VARIANT_CHECKPOINT,
}

async () => {
    const languageInsights = await handler(bundle.rumBundles);
    console.log(JSON.stringify(languageInsights, null, 2))
}