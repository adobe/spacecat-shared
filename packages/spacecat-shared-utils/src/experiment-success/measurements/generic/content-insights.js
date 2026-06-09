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
 * Measures new content insights (cited lines) that appeared after the experiment.
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
 *   citedLines: Record<url, string[]>
 * }
 */
export default class ContentInsightsCalculator extends BaseMeasurement {
  static MEASUREMENT_KEY = 'contentInsights';

  // eslint-disable-next-line class-methods-use-this
  async compute({ runs = [], targetUrls = [] } = {}) {
    // For each (url, platform) pair, collect unique lines from baseline and post runs.
    // Structure: url → platform → phase → Set<line>
    const lineMap = new Map(); // key: `${url}|${platform}` → { baseline: Set, post: Set }

    for (const run of runs) {
      const { phase, platform, citedLines = {} } = run;
      for (const url of targetUrls) {
        const lines = citedLines[url];
        if (lines && Array.isArray(lines)) {
          const key = `${url}|${platform}`;
          if (!lineMap.has(key)) {
            lineMap.set(key, { baseline: new Set(), post: new Set() });
          }
          for (const line of lines) {
            lineMap.get(key)[phase].add(line);
          }
        }
      }
    }

    // Collect all platforms seen
    const allPlatforms = new Set();
    for (const run of runs) {
      allPlatforms.add(run.platform);
    }

    let totalNewInsights = 0;
    let urlsWithNewInsights = 0;
    const byUrl = {};

    for (const url of targetUrls) {
      byUrl[url] = {};
      let urlHasNewLines = false;

      for (const platform of allPlatforms) {
        const key = `${url}|${platform}`;
        const phases = lineMap.get(key) || { baseline: new Set(), post: new Set() };
        const newLines = [...phases.post].filter((line) => !phases.baseline.has(line));

        byUrl[url][platform] = {
          newLines,
          count: newLines.length,
        };

        if (newLines.length > 0) {
          totalNewInsights += newLines.length;
          urlHasNewLines = true;
        }
      }

      if (urlHasNewLines) {
        urlsWithNewInsights += 1;
      }
    }

    return {
      key: ContentInsightsCalculator.MEASUREMENT_KEY,
      value: { totalNewInsights, urlsWithNewInsights, byUrl },
    };
  }
}
