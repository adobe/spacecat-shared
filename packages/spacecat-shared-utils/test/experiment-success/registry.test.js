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

/* eslint-disable max-classes-per-file */
import { expect } from 'chai';
import {
  registerCalculator,
  getCalculators,
  clearRegistry,
} from '../../src/experiment-success/registry.js';

class GenericCalc {}
class AnotherGenericCalc {}
class TypeSpecificCalc {}

describe('experiment-success/registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe('registerCalculator', () => {
    it('registers a generic calculator under *', () => {
      registerCalculator('*', GenericCalc);
      const result = getCalculators('any-type');
      expect(result).to.include(GenericCalc);
    });

    it('registers a type-specific calculator', () => {
      registerCalculator('brand-presence', TypeSpecificCalc);
      const result = getCalculators('brand-presence');
      expect(result).to.include(TypeSpecificCalc);
    });

    it('allows multiple registrations for the same type', () => {
      registerCalculator('*', GenericCalc);
      registerCalculator('*', AnotherGenericCalc);
      const result = getCalculators('any-type');
      expect(result).to.deep.include(GenericCalc);
      expect(result).to.deep.include(AnotherGenericCalc);
    });
  });

  describe('getCalculators', () => {
    it('returns an empty array when no calculators are registered', () => {
      const result = getCalculators('unknown-type');
      expect(result).to.deep.equal([]);
    });

    it('returns only generic calculators for an unregistered type', () => {
      registerCalculator('*', GenericCalc);
      const result = getCalculators('unknown-type');
      expect(result).to.deep.equal([GenericCalc]);
    });

    it('returns generic calculators first, then type-specific', () => {
      registerCalculator('*', GenericCalc);
      registerCalculator('brand-presence', TypeSpecificCalc);
      const result = getCalculators('brand-presence');
      expect(result[0]).to.equal(GenericCalc);
      expect(result[1]).to.equal(TypeSpecificCalc);
    });

    it('does not return type-specific calculators for a different type', () => {
      registerCalculator('brand-presence', TypeSpecificCalc);
      const result = getCalculators('other-type');
      expect(result).to.not.include(TypeSpecificCalc);
    });

    it('returns only generic calculators when looking up * explicitly', () => {
      registerCalculator('*', GenericCalc);
      registerCalculator('brand-presence', TypeSpecificCalc);
      const result = getCalculators('*');
      expect(result).to.deep.equal([GenericCalc]);
      expect(result).to.not.include(TypeSpecificCalc);
    });
  });

  describe('clearRegistry', () => {
    it('removes all registered calculators', () => {
      registerCalculator('*', GenericCalc);
      registerCalculator('brand-presence', TypeSpecificCalc);
      clearRegistry();
      expect(getCalculators('brand-presence')).to.deep.equal([]);
      expect(getCalculators('any-type')).to.deep.equal([]);
    });
  });
});
