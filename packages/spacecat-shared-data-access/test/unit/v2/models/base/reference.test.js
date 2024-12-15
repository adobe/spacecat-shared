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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

import Reference from '../../../../../src/v2/models/base/reference.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('Reference', () => {
  describe('constructor', () => {
    it('creates a new reference with the correct properties', () => {
      const reference = new Reference('has_many', 'Test');

      expect(reference).to.be.an('object');
      expect(reference).to.deep.equal({
        options: {},
        target: 'Test',
        type: 'has_many',
      });
    });

    it('creates a new reference from JSON', () => {
      const reference = Reference.fromJSON({
        options: {},
        target: 'Test',
        type: 'has_many',
      });

      expect(reference).to.be.an('object');
      expect(reference).to.deep.equal({
        options: {},
        target: 'Test',
        type: 'has_many',
      });
    });

    it('throws an error for an invalid type', () => {
      expect(() => new Reference('invalid', 'Test')).to.throw('Invalid reference type: invalid');
    });

    it('throws an error for an invalid target', () => {
      expect(() => new Reference('has_many', '')).to.throw('Invalid target');
    });
  });

  describe('isValidType', () => {
    it('returns true for a valid type', () => {
      expect(Reference.isValidType('has_many')).to.be.true;
    });

    it('returns false for an invalid type', () => {
      expect(Reference.isValidType('invalid')).to.be.false;
    });
  });

  describe('accessors', () => {
    it('returns the target', () => {
      const reference = new Reference('has_many', 'Test');

      expect(reference.getTarget()).to.equal('Test');
    });

    it('returns the type', () => {
      const reference = new Reference('has_many', 'Test');

      expect(reference.getType()).to.equal('has_many');
    });

    it('returns true for removeDependents', () => {
      const reference = new Reference('has_many', 'Test', { removeDependents: true });

      expect(reference.isRemoveDependents()).to.be.true;
    });

    it('returns false for removeDependents', () => {
      const reference = new Reference('has_many', 'Test', { removeDependents: false });

      expect(reference.isRemoveDependents()).to.be.false;
    });
  });
});
