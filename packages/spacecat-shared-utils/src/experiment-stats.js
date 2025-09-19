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
/* c8 ignore start */

import jStat from 'jstat-esm';

export function round(value, decimalPlaces) {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/**
 * Calculates the confidence level for an A/B test using Welch's t-test.
 * See https://experienceleague.adobe.com/en/docs/target/using/reports/statistical-methodology/statistical-calculations
 *
 * @param {number} controlMetrics - Number of conversions in the control variant.
 * @param {number} controlSamples - Total number of visitors in the control variant.
 * @param {number} testMetrics - Number of conversions in the test variant.
 * @param {number} testSamples - Total number of visitors in the test variant.
 * @returns {number} Confidence percentage (0-100), or 0 if inputs are invalid.
 */
export function calculateConfidence(controlMetrics, controlSamples, testMetrics, testSamples) {
  // 1. Validate inputs to prevent errors with small sample sizes
  if (controlSamples <= 1 || testSamples <= 1 || controlMetrics < 0 || testMetrics < 0) {
    return 0;
  }

  // 2. Calculate conversion rates for both variants
  const controlRate = controlMetrics / controlSamples;
  const testRate = testMetrics / testSamples;

  // 3. For binary metrics (e.g., conversion), variance is calculated as rate * (1 - rate)
  const controlVariance = controlRate * (1 - controlRate);
  const testVariance = testRate * (1 - testRate);

  // 4. Calculate the standard error for each variant
  const controlStdError = Math.sqrt(controlVariance / controlSamples);
  const testStdError = Math.sqrt(testVariance / testSamples);

  // 5. Calculate the combined standard error of the difference
  const standardErrorDiff = Math.sqrt(controlStdError ** 2 + testStdError ** 2);

  // Avoid division by zero if there's no variance
  if (standardErrorDiff === 0) {
    // If rates are identical and variance is zero, they are the same with 100% confidence
    return 100;
  }

  // 6. Calculate the t-statistic
  const tStat = (testRate - controlRate) / standardErrorDiff;

  // 7. Calculate the degrees of freedom using the Welch-Satterthwaite equation
  const dfNumerator = (controlStdError ** 2 + testStdError ** 2) ** 2;
  const dfDenominator = (controlStdError ** 2) ** 2 / (controlSamples - 1)
    + (testStdError ** 2) ** 2 / (testSamples - 1);

  const degreesOfFreedom = dfNumerator / dfDenominator;

  // 8. Calculate the two-tailed p-value using the student's t-distribution
  const pValue = jStat.ttest(tStat, degreesOfFreedom, 2); // 2 for a two-tailed test

  // 9. Convert the p-value to a confidence level
  const confidence = (1 - pValue) * 100;
  const roundedConfidence = round(confidence, 2);

  // 10. Ensure the result is within the valid 0-100 range
  return Math.min(Math.max(roundedConfidence, 0), 100);
}
/* c8 ignore end */
