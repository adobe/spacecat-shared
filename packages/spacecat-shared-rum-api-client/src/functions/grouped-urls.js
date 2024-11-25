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

const BUNDLE_TYPE = {
  GROUP: 'group',
  URL: 'url',
};

const findMatchingPattern = (url, groupedURLs) => {
  for (const group of groupedURLs) {
    const regexPattern = new RegExp(
      `^${group.pattern.replace(/\*/g, '.*')}$`,
    );
    if (regexPattern.test(url)) {
      return group;
    }
  }
  return null;
};

const mapBundlesToGroupOrUrl = (bundles, groupedURLs) => {
  const urlToGroupMap = new Map();

  for (const bundle of bundles) {
    const urlGroup = findMatchingPattern(bundle.url, groupedURLs);

    urlToGroupMap.set(
      bundle.url,
      urlGroup
        ? {
          type: BUNDLE_TYPE.GROUP,
          name: urlGroup.name,
          pattern: urlGroup.pattern,
        }
        : {
          type: BUNDLE_TYPE.URL,
          url: bundle.url,
        },
    );
  }

  return urlToGroupMap;
};

export {
  mapBundlesToGroupOrUrl,
  BUNDLE_TYPE,
};
