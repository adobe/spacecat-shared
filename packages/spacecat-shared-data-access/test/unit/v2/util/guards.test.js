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

    it('throws an error if array does not contain valid types', () => {
      expect(() => guardArray('testProperty', [1, 2, 3], 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of strings');
    });

    it('allows specifying type as number', () => {
      expect(() => guardArray('testProperty', [1, 2, 3], 'TestEntity', 'number', false))
        .not.to.throw();
    });

    it('throws an error if array contains wrong type when expecting numbers', () => {
      expect(() => guardArray('testProperty', [1, '2', 3], 'TestEntity', 'number', false))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of numbers');
    });

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardArray('testProperty', null, 'TestEntity', 'string', true)).not.to.throw();
    });

    it('allows specifying type as uuid', () => {
      expect(() => guardArray('testProperty', ['ef39921f-9a02-41db-b491-02c98987d956', 'a3d4b59d-6e1f-4a6d-8ee4-4bfc1d9a9182'], 'TestEntity', 'uuid', false))
        .not.to.throw();
    });

    it('throws an error if array contains invalid UUIDs when expecting UUIDs', () => {
      expect(() => guardArray('testProperty', ['not-a-uuid', 'another-bad-uuid'], 'TestEntity', 'uuid', false))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of uuids');
    });

    it('allows specifying type as boolean', () => {
      expect(() => guardArray('testProperty', [true, false, true], 'TestEntity', 'boolean'))
        .not.to.throw();
    });

    it('throws an error if array contains wrong type when expecting booleans', () => {
      expect(() => guardArray('testProperty', [true, 'false', true], 'TestEntity', 'boolean'))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of booleans');
    });

    it('allows specifying type as object', () => {
      expect(() => guardArray('testProperty', [{ key: 'value' }, { anotherKey: 'anotherValue' }], 'TestEntity', 'object'))
        .not.to.throw();
    });

    it('throws an error if array contains wrong type when expecting objects', () => {
      expect(() => guardArray('testProperty', [{ key: 'value' }, 'notAnObject'], 'TestEntity', 'object'))
        .to.throw('Validation failed in TestEntity: testProperty must be a non-empty array of objects');
    });

    it('throws an error if an unsupported type is specified', () => {
      expect(() => guardArray('testProperty', ['value1', 'value2'], 'TestEntity', 'unsupportedType', false))
        .to.throw('Unsupported type: unsupportedType');
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

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardEnum('testProperty', null, ['VALUE1', 'VALUE2'], 'TestEntity', true)).not.to.throw();
    });
  });

  describe('guardId', () => {
    it('throws an error if value is not a valid ID', () => {
      expect(() => guardId('testId', 12345, 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testId must be a valid UUID');
    });

    it('does not throw if value is a valid ID', () => {
      expect(() => guardId('testId', 'ef39921f-9a02-41db-b491-02c98987d956', 'TestEntity'))
        .not.to.throw();
    });

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardId('testId', null, 'TestEntity', true)).not.to.throw();
    });
  });

  describe('guardMap', () => {
    it('throws an error if value is not an object', () => {
      expect(() => guardMap('testProperty', 'notAnObject', 'TestEntity'))
        .to.throw('Validation failed in TestEntity: testProperty must be an object');
    });

    it('does not throw if value is an object', () => {
      expect(() => guardMap('testProperty', { key: 'value' }, 'TestEntity')).not.to.throw();
    });

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardMap('testProperty', null, 'TestEntity', true))
        .not.to.throw();
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

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardNumber('testProperty', null, 'TestEntity', true)).not.to.throw();
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

    it('does not throw if value is null and nullable is true', () => {
      expect(() => guardString('testProperty', null, 'TestEntity', true)).not.to.throw();
    });

    it('does not throw if value is undefined and nullable is true', () => {
      expect(() => guardString('testProperty', undefined, 'TestEntity', true)).not.to.throw();
    });
  });
});
