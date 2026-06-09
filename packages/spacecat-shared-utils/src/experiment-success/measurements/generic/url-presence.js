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

import BaseMeasurement from '../../base-measurement.js';

/**
 * Measures URL presence changes between baseline and post phases.
 *
 * Input shape:
 * {
 *   runs: RunRecord[],
 *   targetUrls: string[]
 * }
 *
 * RunRecord: {
 *   phase: 'baseline' | 'post',
 *   platform: string,
 *   citedUrls: string[]
 * }
 */
export default class UrlPresenceCalculator extends BaseMeasurement {
  static MEASUREMENT_KEY = 'urlPresence';

  // eslint-disable-next-line class-methods-use-this
  async compute({ runs = [], targetUrls = [] } = {}) {
    // For each (url, platform) pair, track whether the URL appeared in baseline or post runs.
    // key format: `${url}|${platform}` → { baseline: boolean, post: boolean }
    const urlPlatformPhase = new Map();

    // Collect all platforms seen
    const allPlatforms = new Set();
    for (const run of runs) {
      allPlatforms.add(run.platform);
    }

    // Build presence sets
    for (const run of runs) {
      const { phase, platform, citedUrls = [] } = run;
      for (const url of targetUrls) {
        const key = `${url}|${platform}`;
        if (!urlPlatformPhase.has(key)) {
          urlPlatformPhase.set(key, { baseline: false, post: false });
        }
        if (citedUrls.includes(url)) {
          urlPlatformPhase.get(key)[phase] = true;
        }
      }
    }

    // Classify each (url, platform) pair
    const summary = {
      gained: 0, lost: 0, maintained: 0, absent: 0,
    };
    const byUrl = {};

    for (const url of targetUrls) {
      byUrl[url] = {};
      for (const platform of allPlatforms) {
        const key = `${url}|${platform}`;
        const presence = urlPlatformPhase.get(key) || { baseline: false, post: false };
        const { baseline, post } = presence;

        let status;
        const pre = baseline ? 1 : 0;
        const postVal = post ? 1 : 0;
        const delta = postVal - pre;

        if (!baseline && post) {
          status = 'gained';
          summary.gained += 1;
        } else if (baseline && !post) {
          status = 'lost';
          summary.lost += 1;
        } else if (baseline && post) {
          status = 'maintained';
          summary.maintained += 1;
        } else {
          status = 'absent';
          summary.absent += 1;
        }

        byUrl[url][platform] = {
          status, pre, post: postVal, delta,
        };
      }
    }

    return {
      key: UrlPresenceCalculator.MEASUREMENT_KEY,
      value: { summary, byUrl },
    };
  }
}
