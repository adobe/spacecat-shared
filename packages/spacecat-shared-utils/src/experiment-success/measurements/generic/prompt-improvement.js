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

const PLATFORMS = ['chatgpt_paid', 'chatgpt_free', 'perplexity'];

/**
 * Measures prompt-level citation improvement between baseline and post phases.
 *
 * Input shape:
 * {
 *   runs: RunRecord[],
 *   threshold?: number   (default 5)
 * }
 *
 * RunRecord: {
 *   phase: 'baseline' | 'post',
 *   platform: string,
 *   prompt: string,
 *   branded: boolean,
 *   isError: boolean,
 *   targetCitations: number
 * }
 */
export default class PromptImprovementCalculator extends BaseMeasurement {
  static MEASUREMENT_KEY = 'promptImprovement';

  // eslint-disable-next-line class-methods-use-this
  async compute({ runs = [], threshold = 5 } = {}) {
    // 1. Filter out error runs
    const validRuns = runs.filter((r) => !r.isError);

    // 2. Aggregate targetCitations by prompt+phase and prompt+phase+platform
    // key format: `${prompt}|${phase}` → { citations, branded }
    const promptPhase = new Map();
    // key format: `${prompt}|${platform}|${phase}` → citations
    const promptPlatformPhase = new Map();

    for (const run of validRuns) {
      const {
        prompt, phase, platform, targetCitations, branded,
      } = run;

      // Per-prompt per-phase aggregation
      const ppKey = `${prompt}|${phase}`;
      if (!promptPhase.has(ppKey)) {
        promptPhase.set(ppKey, { citations: 0, branded, prompt });
      }
      promptPhase.get(ppKey).citations += targetCitations;

      // Per-prompt per-platform per-phase aggregation
      const pppKey = `${prompt}|${platform}|${phase}`;
      if (!promptPlatformPhase.has(pppKey)) {
        promptPlatformPhase.set(pppKey, 0);
      }
      promptPlatformPhase.set(pppKey, promptPlatformPhase.get(pppKey) + targetCitations);
    }

    // 3. Collect all unique prompts
    const promptSet = new Set();
    for (const [key] of promptPhase) {
      const [prompt] = key.split('|');
      promptSet.add(prompt);
    }

    // 4. Compute delta per prompt
    const improved = [];
    const noImpact = [];

    for (const prompt of promptSet) {
      const preKey = `${prompt}|baseline`;
      const postKey = `${prompt}|post`;
      const pre = promptPhase.has(preKey) ? promptPhase.get(preKey).citations : 0;
      const post = promptPhase.has(postKey) ? promptPhase.get(postKey).citations : 0;
      const delta = post - pre;

      // Determine branded: take from any available record (at least one must exist
      // since prompt was collected from promptPhase keys)
      const brandedRecord = promptPhase.get(preKey) || promptPhase.get(postKey);
      const { branded } = brandedRecord;

      if (delta > threshold) {
        improved.push({
          prompt, pre, post, delta, branded,
        });
      } else {
        noImpact.push({
          prompt, pre, post, delta,
        });
      }
    }

    // 5. Compute stats on improved prompts
    const preTotalCitations = improved.reduce((sum, p) => sum + p.pre, 0);
    const postTotalCitations = improved.reduce((sum, p) => sum + p.post, 0);
    const citationDelta = postTotalCitations - preTotalCitations;
    const pctChange = preTotalCitations > 0
      ? Math.round((citationDelta / preTotalCitations) * 10000) / 100
      : 0;

    const organicWins = improved.filter((p) => !p.branded);

    // 6. Compute per-platform breakdown across improved prompts
    const byPlatform = {};
    for (const platform of PLATFORMS) {
      let pre = 0;
      let post = 0;
      for (const p of improved) {
        const preKey = `${p.prompt}|${platform}|baseline`;
        const postKey = `${p.prompt}|${platform}|post`;
        pre += promptPlatformPhase.get(preKey) || 0;
        post += promptPlatformPhase.get(postKey) || 0;
      }
      const platDelta = post - pre;
      const platPctChange = pre > 0
        ? Math.round((platDelta / pre) * 10000) / 100
        : 0;
      byPlatform[platform] = {
        pre, post, delta: platDelta, pctChange: platPctChange,
      };
    }

    return {
      key: PromptImprovementCalculator.MEASUREMENT_KEY,
      value: {
        improvedCount: improved.length,
        noImpactCount: noImpact.length,
        preTotalCitations,
        postTotalCitations,
        citationDelta,
        pctChange,
        threshold,
        byPlatform,
        organicWins: {
          count: organicWins.length,
          prompts: organicWins.map((p) => p.prompt),
        },
      },
    };
  }
}
