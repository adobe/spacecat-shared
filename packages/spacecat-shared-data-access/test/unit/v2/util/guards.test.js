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
import {
  guardArray,
  guardEnum,
  guardId,
  guardMap,
  guardNumber,
  guardString,
} from '../../../../src/index.js';

chaiUse(chaiAsPromised);

// Guards Unit Tests
describe('Guards', () => {
  describe('guardArray', () => {
    it('throws an error if value is not an array', () => {
      expect(() => guardArray('testProperty', 'notArray', 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of strings');
    });

    it('does not throw if value is an array with strings', () => {
      expect(() => guardArray('testProperty', ['1', '2', '3'], 'TestEntity'))
        .not.to.throw();
    });
  });

  describe('guardEnum', () => {
    it('throws an error if value is not in the allowed enum values', () => {
      expect(() => guardEnum('testProperty', 'INVALID', ['VALUE1', 'VALUE2'], 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be one of VALUE1,VALUE2');
    });

    it('does not throw if value is in the allowed enum values', () => {
      expect(() => guardEnum('testProperty', 'VALUE1', ['VALUE1', 'VALUE2'], 'TestEntity'))
        .not.to.throw();
    });
  });

  describe('guardId', () => {
    it('throws an error if value is not a valid ID (not a string or empty)', () => {
      expect(() => guardId('testId', 12345, 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testId must be a valid UUID');
      expect(() => guardId('testId', '', 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testId must be a valid UUID');
    });

    it('does not throw if value is a valid ID (non-empty string)', () => {
      expect(() => guardId('testId', 'ef39921f-9a02-41db-b491-02c98987d956', 'TestEntity'))
        .not.to.throw();
    });
  });

  describe('guardMap', () => {
    it('throws an error if value is not an object', () => {
      expect(() => guardMap('testProperty', 'notAnObject', 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be an object');
      expect(() => guardMap('testProperty', null, 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be an object');
    });

    it('does not throw if value is an object', () => {
      expect(() => guardMap('testProperty', { key: 'value' }, 'TestEntity')).not.to.throw();
    });
  });

  describe('guardNumber', () => {
    it('throws an error if value is not a number', () => {
      expect(() => guardNumber('testProperty', 'notANumber', 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be a number');
    });

    it('does not throw if value is a number', () => {
      expect(() => guardNumber('testProperty', 123, 'TestEntity'))
        .not.to.throw();
    });
  });

  describe('guardString', () => {
    it('throws an error if value is not a string', () => {
      expect(() => guardString('testProperty', 123, 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty is required');
    });

    it('does not throw if value is a string', () => {
      expect(() => guardString('testProperty', 'validString', 'TestEntity'))
        .not.to.throw();
    });
  });
});
