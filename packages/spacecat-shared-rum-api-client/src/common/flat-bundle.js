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

/**
 * This utility class is designed to flatten checkpoints of RUM bundles served from the
 * RUM bundler API. Its primary purpose is to simplify data juggling.
 *
 * RUM bundles are returned grouped by id. Often, there's a need to further group the bundles by
 * another checkpoint such as URL, source, or target. By using this class, RUM bundles can be
 * flattened for easier implementation of all required grouping operations.
 *
 * This class extends the standard Array class, to make all standard functions such as filter, map,
 * and reduce available for use with this class as well.
 *
 * For instance, when the RUM bundler returns "bundles" in the following format:
 *
 * ```json
 * [
 *   {
 *     "id": "BSX",
 *     "time": "2024-05-26T05:00:02.706Z",
 *     "url": "https://www.aem.live/developer/tutorial",
 *     "weight": 100,
 *     "events": [
 *       {
 *         "checkpoint": "navigate",
 *         "target": "visible",
 *         "source": "https://www.aem.live/docs/",
 *         "timeDelta": 2706.199951171875
 *       },
 *       {
 *         "checkpoint": "loadresource",
 *         "target": 4,
 *         "source": "https://www.aem.live/new-nav.plain.html",
 *         "timeDelta": 2707.699951171875
 *       },
 *       {
 *         "checkpoint": "play",
 *         "source": "https://www.hlx.live/developer/videos/tutorial-step1.mp4",
 *         "timeDelta": 12671.89990234375
 *       },
 *       {
 *         "checkpoint": "viewmedia",
 *         "target": "https://www.aem.live/developer/media_1c03ad909a87a4e318a33e780b93e4a1f8e7581a3.png",
 *         "timeDelta": 43258.39990234375
 *       }
 *     ]
 *   }
 * ]
 * ```
 *
 * After flattening, the FlatBundle appears as follows:
 *
 * ```json
 * [
 *   {
 *     "id": "BSX",
 *     "time": "2024-05-26T05:00:02.706Z",
 *     "url": "https://www.aem.live/developer/tutorial",
 *     "weight": 100,
 *     "checkpoint": "navigate",
 *     "target": "visible",
 *     "source": "https://www.aem.live/docs/",
 *     "timeDelta": 2706.199951171875
 *   },
 *   {
 *     "id": "BSX",
 *     "time": "2024-05-26T05:00:02.706Z",
 *     "url": "https://www.aem.live/developer/tutorial",
 *     "weight": 100,
 *     "checkpoint": "loadresource",
 *     "target": 4,
 *     "source": "https://www.aem.live/new-nav.plain.html",
 *     "timeDelta": 2707.699951171875
 *   },
 *   {
 *     "id": "BSX",
 *     "time": "2024-05-26T05:00:02.706Z",
 *     "url": "https://www.aem.live/developer/tutorial",
 *     "weight": 100,
 *     "checkpoint": "play",
 *     "source": "https://www.hlx.live/developer/videos/tutorial-step1.mp4",
 *     "timeDelta": 12671.89990234375
 *   },
 *   {
 *     "id": "BSX",
 *     "time": "2024-05-26T05:00:02.706Z",
 *     "url": "https://www.aem.live/developer/tutorial",
 *     "weight": 100,
 *     "checkpoint": "viewmedia",
 *     "target": "https://www.aem.live/developer/media_1c03ad909a87a4e318a33e780b93e4a1f8e7581a3.png",
 *     "timeDelta": 43258.39990234375
 *   }
 * ]
 *
 * ```
 *
 * @extends Array
 */
export class FlatBundle extends Array {
  static fromArray(array) {
    const flattened = array.flatMap((bundle) => {
      const temp = { ...bundle };
      delete temp.events;
      return bundle.events.map((event) => ({
        ...temp,
        ...event,
      }));
    });

    Object.setPrototypeOf(flattened, FlatBundle.prototype);
    return flattened;
  }

  /**
   * Groups FlatBundles by one or more keys. For example, this method can be used to
   * group Flat Bundles by url and source as shown below:
   *
   * ```js
   * FlatBundle.fromArray(bundles)
   *     .groupBy('url', 'source');
   * ```
   * The output of this code returns a nested object with keys ("url", "source") and
   * "items", nested to the depth of the number of keys used for grouping.
   *
   * An example response for grouping by url and source could be like:
   *
   * ```json
   * [
   *   {
   *     "url": "some-url",
   *     "items": [
   *       { "source": "source1", "items": [] },
   *       { "source": "source2", "items": [] }
   *     ]
   *   },
   *   {
   *     "url": "some-other-url",
   *     "items": [
   *       { "source": "source3", "items": [] }
   *     ]
   *   }
   * ]
   * ```
   *
   *
   * @param {...string} keys - The keys to group by.
   * @returns {Array} The grouped flat bundles.
   */
  groupBy(...keys) {
    // Initialize the result as an empty array
    const result = [];

    // Create a map to hold references to the current levels
    const map = new Map();

    // Iterate over each item in the array
    for (const item of this) {
      let currentLevel = result;
      let mapLevel = map;

      // Iterate over each key to build the nested structure
      for (const key of keys) {
        const groupValue = item[key];

        // Check if the group already exists
        if (!mapLevel.has(groupValue)) {
          // Create a new group if it doesn't exist
          const newGroup = { [key]: groupValue, items: [] };
          currentLevel.push(newGroup);
          mapLevel.set(groupValue, { group: newGroup, nextMap: new Map() });
        }

        // Move to the next level
        const { group, nextMap } = mapLevel.get(groupValue);
        currentLevel = group.items;
        mapLevel = nextMap;
      }

      // Add the item to the final level
      currentLevel.push(item);
    }

    return result;
  }
}
