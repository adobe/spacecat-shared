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
 * Abstract base class for experiment success measurement calculators.
 * Subclasses must override `compute(runData)` and provide a static `MEASUREMENT_KEY`.
 */
export default class BaseMeasurement {
  /**
   * @param {object} context - Shared context (config, logger, etc.).
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Computes the measurement from the provided run data.
   * Subclasses must override this method.
   *
   * @param {object} runData - Input data for the measurement computation.
   * @returns {Promise<object>} The computed measurement result.
   */
  // eslint-disable-next-line no-unused-vars
  async compute(runData) {
    throw new Error(`${this.constructor.name} must implement compute(runData)`);
  }

  /**
   * The unique key identifying this measurement type.
   * Subclasses must override this static getter.
   *
   * @returns {string} The measurement key.
   */
  static get MEASUREMENT_KEY() {
    throw new Error('Subclass must define static MEASUREMENT_KEY');
  }
}
