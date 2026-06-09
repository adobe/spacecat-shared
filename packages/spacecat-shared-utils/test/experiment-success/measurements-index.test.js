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
import { clearRegistry, getCalculators } from '../../src/experiment-success/registry.js';

describe('measurements/index (auto-registration)', () => {
  before(async () => {
    // Importing measurements/index.js triggers registerCalculator side effects
    await import('../../src/experiment-success/measurements/index.js');
  });

  after(() => {
    clearRegistry();
  });

  it('registers all three generic calculators under *', () => {
    const calculators = getCalculators('any-type');
    expect(calculators).to.have.lengthOf(3);
  });

  it('registers PromptImprovementCalculator with the correct key', () => {
    const calculators = getCalculators('any-type');
    const keys = calculators.map((C) => C.MEASUREMENT_KEY);
    expect(keys).to.include('promptImprovement');
  });

  it('registers UrlPresenceCalculator with the correct key', () => {
    const calculators = getCalculators('any-type');
    const keys = calculators.map((C) => C.MEASUREMENT_KEY);
    expect(keys).to.include('urlPresence');
  });

  it('registers ContentInsightsCalculator with the correct key', () => {
    const calculators = getCalculators('any-type');
    const keys = calculators.map((C) => C.MEASUREMENT_KEY);
    expect(keys).to.include('contentInsights');
  });
});
