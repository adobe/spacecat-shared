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

/**
 * Module-level registry for experiment success measurement calculators.
 * Generic calculators are registered under '*' and are returned first
 * for every opportunityType. Type-specific calculators are returned after.
 */
const registry = new Map();

/**
 * Registers a calculator class for a given opportunity type.
 * Use '*' to register a generic calculator that applies to all opportunity types.
 *
 * @param {string} opportunityType - The opportunity type key, or '*' for generic.
 * @param {Function} CalculatorClass - The calculator class to register.
 */
export function registerCalculator(opportunityType, CalculatorClass) {
  if (!registry.has(opportunityType)) {
    registry.set(opportunityType, []);
  }
  registry.get(opportunityType).push(CalculatorClass);
}

/**
 * Returns all calculators applicable for a given opportunity type.
 * Generic calculators (registered under '*') are returned first,
 * followed by type-specific calculators.
 *
 * @param {string} opportunityType - The opportunity type to look up.
 * @returns {Function[]} Array of calculator classes.
 */
export function getCalculators(opportunityType) {
  const generic = registry.get('*') || [];
  const specific = opportunityType !== '*' ? (registry.get(opportunityType) || []) : [];
  return [...generic, ...specific];
}

/**
 * Clears the entire registry. Intended for test isolation only.
 */
export function clearRegistry() {
  registry.clear();
}
