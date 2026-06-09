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
import BaseMeasurement from '../../src/experiment-success/base-measurement.js';

describe('BaseMeasurement', () => {
  describe('constructor', () => {
    it('stores the context on the instance', () => {
      const ctx = { log: () => {} };
      const instance = new BaseMeasurement(ctx);
      expect(instance.context).to.equal(ctx);
    });
  });

  describe('compute (abstract)', () => {
    it('throws an error if compute is not overridden', async () => {
      const instance = new BaseMeasurement({});
      try {
        await instance.compute({});
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.include('must implement compute(runData)');
      }
    });
  });

  describe('MEASUREMENT_KEY (abstract static)', () => {
    it('throws an error if MEASUREMENT_KEY is accessed on the base class', () => {
      expect(() => BaseMeasurement.MEASUREMENT_KEY).to.throw('Subclass must define static MEASUREMENT_KEY');
    });
  });
});
