/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';
import PromptImprovementCalculator from '../../src/experiment-success/measurements/generic/prompt-improvement.js';

function makeRun(overrides = {}) {
  return {
    phase: 'baseline',
    platform: 'chatgpt_paid',
    prompt: 'prompt-a',
    branded: false,
    isError: false,
    targetCitations: 0,
    ...overrides,
  };
}

describe('PromptImprovementCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new PromptImprovementCalculator({});
  });

  it('has the correct MEASUREMENT_KEY', () => {
    expect(PromptImprovementCalculator.MEASUREMENT_KEY).to.equal('promptImprovement');
  });

  it('returns key promptImprovement in the result', async () => {
    const result = await calculator.compute({ runs: [] });
    expect(result.key).to.equal('promptImprovement');
  });

  it('counts improved vs noImpact prompts correctly', async () => {
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'prompt-a', targetCitations: 2 }),
      makeRun({ phase: 'post', prompt: 'prompt-a', targetCitations: 10 }), // delta=8 > 5 → improved
      makeRun({ phase: 'baseline', prompt: 'prompt-b', targetCitations: 5 }),
      makeRun({ phase: 'post', prompt: 'prompt-b', targetCitations: 7 }), // delta=2 ≤ 5 → noImpact
    ];
    const { value } = await calculator.compute({ runs });
    expect(value.improvedCount).to.equal(1);
    expect(value.noImpactCount).to.equal(1);
  });

  it('computes citationDelta and pctChange correctly', async () => {
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'prompt-a', targetCitations: 10 }),
      makeRun({ phase: 'post', prompt: 'prompt-a', targetCitations: 20 }), // delta=10 > 5
    ];
    const { value } = await calculator.compute({ runs });
    expect(value.preTotalCitations).to.equal(10);
    expect(value.postTotalCitations).to.equal(20);
    expect(value.citationDelta).to.equal(10);
    expect(value.pctChange).to.equal(100);
  });

  it('returns pctChange=0 when preTotalCitations is 0', async () => {
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'prompt-a', targetCitations: 0 }),
      makeRun({ phase: 'post', prompt: 'prompt-a', targetCitations: 10 }), // delta=10 > 5
    ];
    const { value } = await calculator.compute({ runs });
    expect(value.pctChange).to.equal(0);
  });

  it('counts organicWins (branded=false improved prompts)', async () => {
    const runs = [
      makeRun({
        phase: 'baseline', prompt: 'organic', branded: false, targetCitations: 1,
      }),
      makeRun({
        phase: 'post', prompt: 'organic', branded: false, targetCitations: 10,
      }), // delta=9 → improved organic
      makeRun({
        phase: 'baseline', prompt: 'branded', branded: true, targetCitations: 1,
      }),
      makeRun({
        phase: 'post', prompt: 'branded', branded: true, targetCitations: 10,
      }), // delta=9 → improved branded
    ];
    const { value } = await calculator.compute({ runs });
    expect(value.organicWins.count).to.equal(1);
    expect(value.organicWins.prompts).to.deep.equal(['organic']);
  });

  it('computes per-platform breakdown for improved prompts', async () => {
    const runs = [
      makeRun({
        phase: 'baseline', prompt: 'prompt-a', platform: 'chatgpt_paid', targetCitations: 4,
      }),
      makeRun({
        phase: 'post', prompt: 'prompt-a', platform: 'chatgpt_paid', targetCitations: 12,
      }), // delta=8 → improved; platform pre=4, post=12
    ];
    const { value } = await calculator.compute({ runs });
    expect(value.byPlatform.chatgpt_paid.pre).to.equal(4);
    expect(value.byPlatform.chatgpt_paid.post).to.equal(12);
    expect(value.byPlatform.chatgpt_paid.delta).to.equal(8);
    expect(value.byPlatform.chatgpt_paid.pctChange).to.equal(200);
  });

  it('uses custom threshold', async () => {
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'prompt-a', targetCitations: 0 }),
      makeRun({ phase: 'post', prompt: 'prompt-a', targetCitations: 3 }), // delta=3 > 2 with threshold=2
    ];
    const { value } = await calculator.compute({ runs, threshold: 2 });
    expect(value.improvedCount).to.equal(1);
    expect(value.threshold).to.equal(2);
  });

  it('skips runs where isError=true', async () => {
    const runs = [
      makeRun({
        phase: 'baseline', prompt: 'prompt-a', targetCitations: 0, isError: true,
      }),
      makeRun({
        phase: 'post', prompt: 'prompt-a', targetCitations: 100, isError: true,
      }),
    ];
    const { value } = await calculator.compute({ runs });
    // Both runs are errors — prompt never accumulates enough delta
    expect(value.improvedCount).to.equal(0);
  });

  it('returns zero counts for empty runs', async () => {
    const { value } = await calculator.compute({ runs: [] });
    expect(value.improvedCount).to.equal(0);
    expect(value.noImpactCount).to.equal(0);
    expect(value.preTotalCitations).to.equal(0);
    expect(value.postTotalCitations).to.equal(0);
  });

  it('includes all three standard platforms in byPlatform', async () => {
    const { value } = await calculator.compute({ runs: [] });
    expect(value.byPlatform).to.have.all.keys('chatgpt_paid', 'chatgpt_free', 'perplexity');
  });

  it('handles prompt with only post-phase data (no baseline), falls back to pre=0', async () => {
    // Only a post run, no baseline → delta = post - 0 = post
    const runs = [
      makeRun({ phase: 'post', prompt: 'post-only', targetCitations: 20 }),
    ];
    const { value } = await calculator.compute({ runs, threshold: 5 });
    // delta = 20 > 5 → improved; pre = 0 → pctChange = 0
    expect(value.improvedCount).to.equal(1);
    expect(value.preTotalCitations).to.equal(0);
    expect(value.pctChange).to.equal(0);
  });

  it('handles prompt with only baseline-phase data (no post), falls back to post=0', async () => {
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'baseline-only', targetCitations: 10 }),
    ];
    const { value } = await calculator.compute({ runs, threshold: 5 });
    // delta = 0 - 10 = -10, not > threshold → noImpact
    expect(value.noImpactCount).to.equal(1);
    expect(value.improvedCount).to.equal(0);
  });

  it('computes pctChange correctly for per-platform when platform pre=0', async () => {
    // improved prompt but the specific platform has pre=0
    const runs = [
      makeRun({ phase: 'baseline', prompt: 'prompt-a', targetCitations: 10 }),
      makeRun({
        phase: 'post', prompt: 'prompt-a', platform: 'chatgpt_free', targetCitations: 20,
      }), // delta > 5
    ];
    const { value } = await calculator.compute({ runs, threshold: 5 });
    // chatgpt_free has pre=0 (no baseline run on chatgpt_free) → pctChange=0
    expect(value.byPlatform.chatgpt_free.pctChange).to.equal(0);
  });
});
