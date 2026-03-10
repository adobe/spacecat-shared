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

/* eslint-env mocha */

import { expect } from 'chai';

import {
  TOKEN_GRANT_CONFIG,
  getTokenGrantConfig,
  getCurrentCycle,
} from '../src/token-grant-config.js';

describe('TOKEN_GRANT_CONFIG', () => {
  it('is frozen and cannot be modified', () => {
    expect(Object.isFrozen(TOKEN_GRANT_CONFIG)).to.be.true;
    expect(Object.isFrozen(TOKEN_GRANT_CONFIG.monthly_suggestion_cwv)).to.be.true;
  });

  it('contains expected token types', () => {
    expect(TOKEN_GRANT_CONFIG).to.have.all.keys(
      'monthly_suggestion_cwv',
      'monthly_suggestion_broken_backlinks',
      'monthly_suggestion_alt_text',
    );
  });

  it('each entry has tokensPerCycle, cycle, and cycleFormat', () => {
    for (const [, entry] of Object.entries(TOKEN_GRANT_CONFIG)) {
      expect(entry).to.have.property('tokensPerCycle').that.is.a('number');
      expect(entry).to.have.property('cycle').that.is.a('string');
      expect(entry).to.have.property('cycleFormat').that.is.a('string');
    }
  });
});

describe('getCurrentCycle', () => {
  it('formats YYYY-MM using UTC date', () => {
    const result = getCurrentCycle('YYYY-MM');
    const now = new Date();
    const expected = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    expect(result).to.equal(expected);
  });

  it('formats YYYY alone', () => {
    const result = getCurrentCycle('YYYY');
    expect(result).to.equal(String(new Date().getUTCFullYear()));
  });

  it('formats MM alone with zero-padding', () => {
    const result = getCurrentCycle('MM');
    const expected = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    expect(result).to.equal(expected);
  });

  it('returns the format string unchanged when no placeholders match', () => {
    expect(getCurrentCycle('weekly')).to.equal('weekly');
  });
});

describe('getTokenGrantConfig', () => {
  it('returns config with currentCycle for a known token type', () => {
    const config = getTokenGrantConfig('monthly_suggestion_cwv');
    expect(config).to.have.property('tokensPerCycle', 5);
    expect(config).to.have.property('cycle', 'monthly');
    expect(config).to.have.property('cycleFormat', 'YYYY-MM');
    expect(config).to.have.property('currentCycle').that.is.a('string');
    expect(config.currentCycle).to.equal(getCurrentCycle('YYYY-MM'));
  });

  it('returns correct tokensPerCycle for each token type', () => {
    expect(getTokenGrantConfig('monthly_suggestion_cwv').tokensPerCycle).to.equal(5);
    expect(getTokenGrantConfig('monthly_suggestion_broken_backlinks').tokensPerCycle).to.equal(10);
    expect(getTokenGrantConfig('monthly_suggestion_alt_text').tokensPerCycle).to.equal(20);
  });

  it('returns undefined for an unknown token type', () => {
    expect(getTokenGrantConfig('nonexistent_type')).to.be.undefined;
  });

  it('returns undefined when called with no argument', () => {
    expect(getTokenGrantConfig()).to.be.undefined;
  });

  it('does not mutate the frozen config', () => {
    const config = getTokenGrantConfig('monthly_suggestion_cwv');
    config.tokensPerCycle = 999;
    const fresh = getTokenGrantConfig('monthly_suggestion_cwv');
    expect(fresh.tokensPerCycle).to.equal(5);
  });
});
