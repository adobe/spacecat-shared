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
  OPPORTUNITY_GRANT_CONFIG,
  getTokenGrantConfig,
  getTokenGrantConfigByOpportunity,
  getTokenTypeForOpportunity,
  getCurrentCycle,
} from '../src/token-grant-config.js';

describe('OPPORTUNITY_GRANT_CONFIG', () => {
  it('is frozen and cannot be modified', () => {
    expect(Object.isFrozen(OPPORTUNITY_GRANT_CONFIG)).to.be.true;
    expect(Object.isFrozen(OPPORTUNITY_GRANT_CONFIG.cwv)).to.be.true;
  });

  it('contains expected opportunity names', () => {
    expect(OPPORTUNITY_GRANT_CONFIG).to.have.all.keys(
      'cwv',
      'broken-backlinks',
      'alt-text',
    );
  });

  it('each entry has tokensPerCycle, cycle, and cycleFormat', () => {
    for (const entry of Object.values(OPPORTUNITY_GRANT_CONFIG)) {
      expect(entry).to.have.property('tokensPerCycle').that.is.a('number');
      expect(entry).to.have.property('cycle').that.is.a('string');
      expect(entry).to.have.property('cycleFormat').that.is.a('string');
    }
  });
});

describe('getTokenTypeForOpportunity', () => {
  it('converts opportunity name to token type key', () => {
    expect(getTokenTypeForOpportunity('cwv')).to.equal('grant_cwv');
    expect(getTokenTypeForOpportunity('broken-backlinks'))
      .to.equal('grant_broken_backlinks');
    expect(getTokenTypeForOpportunity('alt-text'))
      .to.equal('grant_alt_text');
  });
});

describe('TOKEN_GRANT_CONFIG', () => {
  it('is frozen and cannot be modified', () => {
    expect(Object.isFrozen(TOKEN_GRANT_CONFIG)).to.be.true;
    expect(Object.isFrozen(TOKEN_GRANT_CONFIG.grant_cwv)).to.be.true;
  });

  it('contains token types derived from opportunity names', () => {
    expect(TOKEN_GRANT_CONFIG).to.have.all.keys(
      'grant_cwv',
      'grant_broken_backlinks',
      'grant_alt_text',
    );
  });

  it('each entry has tokensPerCycle, cycle, and cycleFormat', () => {
    for (const entry of Object.values(TOKEN_GRANT_CONFIG)) {
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
    const expected = String(new Date().getUTCMonth() + 1)
      .padStart(2, '0');
    expect(result).to.equal(expected);
  });

  it('returns the format string unchanged when no placeholders match', () => {
    expect(getCurrentCycle('weekly')).to.equal('weekly');
  });
});

describe('getTokenGrantConfig', () => {
  it('returns config with currentCycle for a known token type', () => {
    const config = getTokenGrantConfig('grant_cwv');
    expect(config).to.have.property('tokensPerCycle', 3);
    expect(config).to.have.property('cycle', 'monthly');
    expect(config).to.have.property('cycleFormat', 'YYYY-MM');
    expect(config).to.have.property('currentCycle').that.is.a('string');
    expect(config.currentCycle).to.equal(getCurrentCycle('YYYY-MM'));
  });

  it('returns correct tokensPerCycle for each token type', () => {
    expect(getTokenGrantConfig('grant_cwv').tokensPerCycle)
      .to.equal(3);
    expect(getTokenGrantConfig('grant_broken_backlinks').tokensPerCycle)
      .to.equal(3);
    expect(getTokenGrantConfig('grant_alt_text').tokensPerCycle)
      .to.equal(3);
  });

  it('returns undefined for an unknown token type', () => {
    expect(getTokenGrantConfig('nonexistent_type')).to.be.undefined;
  });

  it('returns undefined when called with no argument', () => {
    expect(getTokenGrantConfig()).to.be.undefined;
  });

  it('does not mutate the frozen config', () => {
    const config = getTokenGrantConfig('grant_cwv');
    config.tokensPerCycle = 999;
    const fresh = getTokenGrantConfig('grant_cwv');
    expect(fresh.tokensPerCycle).to.equal(3);
  });
});

describe('getTokenGrantConfigByOpportunity', () => {
  it('returns config with currentCycle and tokenType', () => {
    const config = getTokenGrantConfigByOpportunity('cwv');
    expect(config).to.have.property('tokensPerCycle', 3);
    expect(config).to.have.property('cycle', 'monthly');
    expect(config).to.have.property('cycleFormat', 'YYYY-MM');
    expect(config).to.have.property('currentCycle').that.is.a('string');
    expect(config).to.have.property('tokenType', 'grant_cwv');
  });

  it('works for hyphenated opportunity names', () => {
    const config = getTokenGrantConfigByOpportunity('broken-backlinks');
    expect(config).to.have.property('tokenType', 'grant_broken_backlinks');
    expect(config).to.have.property('tokensPerCycle', 3);
  });

  it('returns undefined for an unknown opportunity name', () => {
    expect(getTokenGrantConfigByOpportunity('nonexistent'))
      .to.be.undefined;
  });

  it('returns undefined when called with no argument', () => {
    expect(getTokenGrantConfigByOpportunity()).to.be.undefined;
  });
});
