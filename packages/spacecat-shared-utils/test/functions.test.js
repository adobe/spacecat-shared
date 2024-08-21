/*
 * Copyright 2023 Adobe. All rights reserved.
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
/* eslint-disable no-unused-expressions */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  hasText,
  isBoolean,
  isArray,
  isInteger,
  isValidDate,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNumber,
  isObject,
  isNonEmptyObject,
  isString,
  toBoolean,
  arrayEquals,
  isValidUrl,
  dateAfterDays,
  deepEqual,
} from '../src/index.js';

describe('Shared functions', () => {
  describe('Commons', () => {
    it('is iso date', () => {
      const invalidDates = [
        '',
        '2011-10-05',
        '2011-10-05T14:48:00.000',
        'Wed Oct 05 2011 16:48:00 GMT+0200 (CEST)',
        '2011-13-01T14:48:00.000Z',
        '2011-00-01T14:48:00.000Z',
      ];

      invalidDates.forEach((date) => expect(isIsoDate(date)).to.be.false);

      expect(isIsoDate('2011-10-05T14:48:00.000Z')).to.be.true;
    });

    it('is iso date with time offset', () => {
      const invalidOffsetDates = [
        '',
        '2019-11-15',
        '2019-11-05T14:43:00.000',
        'Wed Oct 11 2019 14:43:00 GMT+0200 (CEST)',
      ];

      invalidOffsetDates.forEach((date) => expect(isIsoTimeOffsetsDate(date)).to.be.false);

      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000Z')).to.be.true;
      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000-00:00')).to.be.true;
      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000+05:11')).to.be.true;
    });

    it('has text', () => {
      const invalidTexts = [
        null,
        undefined,
        123,
        [],
        ['dasd'],
        {},
        { asd: 'dsa' },
        '',
      ];

      invalidTexts.forEach((value) => expect(hasText(value)).to.be.false);

      expect(hasText('a')).to.be.true;
      expect(hasText('1')).to.be.true;
      expect(hasText('a12dsamklda')).to.be.true;
    });

    it('is array', () => {
      const invalidArrays = [
        true,
        {},
        { asd: 'dsa' },
        '',
        'dasd',
        NaN,
        Infinity,
        -Infinity,
        123,
      ];

      invalidArrays.forEach((value) => expect(isArray(value)).to.be.false);
      expect(isArray([])).to.be.true;
      expect(isArray(['abc'])).to.be.true;
    });

    it('is boolean', () => {
      const invalidBooleans = [
        null,
        undefined,
        [],
        ['dasd'],
        {},
        { asd: 'dsa' },
        '',
        'dasd',
        NaN,
        Infinity,
        -Infinity,
        123,
      ];

      invalidBooleans.forEach((value) => expect(isBoolean(value)).to.be.false);

      expect(isBoolean('true')).to.be.true;
      expect(isBoolean('True')).to.be.true;
      expect(isBoolean('false')).to.be.true;
      expect(isBoolean('False')).to.be.true;
      expect(isBoolean(true)).to.be.true;
      expect(isBoolean(false)).to.be.true;
    });

    it('is number', () => {
      const invalidNumbers = [
        null,
        undefined,
        [],
        ['dasd'],
        {},
        { asd: 'dsa' },
        '',
        'dasd',
        NaN,
        Infinity,
        -Infinity,
      ];

      invalidNumbers.forEach((value) => expect(isNumber(value)).to.be.false);

      expect(isNumber(0)).to.be.true;
      expect(isNumber(123)).to.be.true;
      expect(isNumber(-123)).to.be.true;
      expect(isNumber(12.3)).to.be.true;
    });

    it('is integer', () => {
      const invalidIntegers = [
        null,
        undefined,
        [],
        ['dasd'],
        {},
        { asd: 'dsa' },
        '',
        'dasd',
        NaN,
        Infinity,
        -Infinity,
        12.3,
      ];

      invalidIntegers.forEach((value) => expect(isInteger(value)).to.be.false);

      expect(isInteger(0)).to.be.true;
      expect(isInteger(123)).to.be.true;
      expect(isInteger(-123)).to.be.true;
    });

    it('is object', () => {
      const invalidObjects = [
        null,
        undefined,
        123,
        'dasd',
        [],
        ['dasd'],
      ];

      invalidObjects.forEach((value) => expect(isObject(value)).to.be.false);

      expect(isObject({})).to.be.true;
      expect(isObject({ asd: 'dsa' })).to.be.true;
    });

    it('non empty object', () => {
      const invalidObjects = [
        null,
        undefined,
        123,
        'dasd',
        [],
        ['dasd'],
        {},
      ];

      invalidObjects.forEach((value) => expect(isNonEmptyObject(value)).to.be.false);

      expect(isNonEmptyObject({})).to.be.false;
      expect(isNonEmptyObject({ asd: 'dsa' })).to.be.true;
    });

    it('is string', () => {
      const invalidStrings = [
        null,
        undefined,
        123,
        [],
        ['dasd'],
        {},
        { asd: 'dsa' },
      ];

      invalidStrings.forEach((value) => expect(isString(value)).to.be.false);

      expect(isString('')).to.be.true;
      expect(isString('dasd')).to.be.true;
    });

    it('toBoolean', () => {
      const invalidBooleans = [
        undefined,
        null,
        [],
        'foo',
        {},
        NaN,
        Infinity,
        -Infinity,
        123,
      ];

      invalidBooleans.forEach((value) => expect(() => toBoolean(value)).to.throw(Error, 'Not a boolean value'));

      expect(toBoolean('true')).to.be.true;
      expect(toBoolean('True')).to.be.true;
      expect(toBoolean('false')).to.be.false;
      expect(toBoolean('False')).to.be.false;
      expect(toBoolean(true)).to.be.true;
      expect(toBoolean(false)).to.be.false;
    });

    it('array equals', () => {
      expect(arrayEquals([], 1)).to.be.false;
      expect(arrayEquals(1, [])).to.be.false;
      expect(arrayEquals([1], [2, 3])).to.be.false;
      expect(arrayEquals([1, 4], [2, 3])).to.be.false;
      expect(arrayEquals([1, 2], [1, 2])).to.be.true;
    });
  });

  describe('isValidUrl', () => {
    it('returns false for invalid Url', async () => {
      const invalidUrls = [
        null,
        undefined,
        1234,
        true,
        'example.com',
        'www.example.com',
        '255.255.255.256',
        'ftp://abc.com',
      ];

      invalidUrls.forEach((url) => expect(isValidUrl(url)).to.be.false);
    });

    it('returns true for valid url', async () => {
      expect(isValidUrl('http://abc.xyz')).to.be.true;
      expect(isValidUrl('https://abc.xyz')).to.be.true;
    });
  });

  describe('isValidDate', () => {
    it('returns false for invalid date', async () => {
      const invalidDates = [
        null,
        undefined,
        1234,
        true,
        '2019-11-11T14:43:89.000-00:00',
        'invalid date',
      ];

      invalidDates.forEach((date) => expect(isValidDate(date)).to.be.false);
    });

    it('returns true for valid date', async () => {
      expect(isValidDate(new Date())).to.be.true;
      expect(isValidDate(new Date('2022-01-01T01:23:45.678-00:00'))).to.be.true;
      expect(isValidDate(new Date('2022-01-01T01:23:45.678Z'))).to.be.true;
    });
  });

  describe('dateAfterDays', () => {
    const sandbox = sinon.createSandbox();

    const mockDate = '2023-11-27T12:30:01.124Z';
    const sevenDaysLaterExpected = '2023-12-04T12:30:01.124Z';
    const sevenDaysEarlierExpected = '2023-11-20T12:30:01.124Z';

    before('setup', function () {
      this.clock = sandbox.useFakeTimers({
        now: new Date(mockDate).getTime(),
      });
    });

    after('clean', () => {
      sandbox.restore();
    });

    it('returns days after now', async () => {
      const sevenDaysLater = dateAfterDays(7);
      expect(sevenDaysLater.toISOString()).to.equal(sevenDaysLaterExpected);
    });

    it('returns days after a fix date', async () => {
      const dateString = '2023-11-15T12:30:01.124Z';
      const expectedDateString = '2023-11-17T12:30:01.124Z';
      const sevenDaysLater = dateAfterDays(2, dateString);
      expect(sevenDaysLater.toISOString()).to.equal(expectedDateString);
    });

    it('returns days before now', async () => {
      const sevenDaysEarlier = dateAfterDays(-7);
      expect(sevenDaysEarlier.toISOString()).to.equal(sevenDaysEarlierExpected);
    });
  });

  describe('deepEqual', () => {
    it('returns true for two identical primitive values', () => {
      expect(deepEqual(1, 1)).to.be.true;
      expect(deepEqual('hello', 'hello')).to.be.true;
      expect(deepEqual(true, true)).to.be.true;
    });

    it('returns false for two different primitive values', () => {
      expect(deepEqual(1, 2)).to.be.false;
      expect(deepEqual('hello', 'world')).to.be.false;
      expect(deepEqual(true, false)).to.be.false;
    });

    it('returns true for two identical arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).to.be.true;
      expect(deepEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).to.be.true;
    });

    it('returns false for two different arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).to.be.false;
      expect(deepEqual(['a', 'b', 'c'], ['a', 'b', 'd'])).to.be.false;
    });

    it('returns true for two identical objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).to.be.true;
      expect(deepEqual({ x: 'hello', y: 'world' }, { x: 'hello', y: 'world' })).to.be.true;
    });

    it('returns false for two different objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).to.be.false;
      expect(deepEqual({ x: 'hello', y: 'world' }, { x: 'hello', y: 'earth' })).to.be.false;
    });

    it('returns true for deeply nested identical objects', () => {
      const obj1 = { a: { b: { c: 1 } }, d: 2 };
      const obj2 = { a: { b: { c: 1 } }, d: 2 };
      expect(deepEqual(obj1, obj2)).to.be.true;
    });

    it('returns false for deeply nested different objects', () => {
      const obj1 = { a: { b: { c: 1 } }, d: 2 };
      const obj2 = { a: { b: { c: 2 } }, d: 2 };
      expect(deepEqual(obj1, obj2)).to.be.false;
    });

    it('returns true for two identical Date objects', () => {
      const date1 = new Date('2021-01-01');
      const date2 = new Date('2021-01-01');
      expect(deepEqual(date1, date2)).to.be.true;
    });

    it('returns false for two different Date objects', () => {
      const date1 = new Date('2021-01-01');
      const date2 = new Date('2022-01-01');
      expect(deepEqual(date1, date2)).to.be.false;
    });

    it('returns true for two identical RegExp objects', () => {
      const regex1 = /test/i;
      const regex2 = /test/i;
      expect(deepEqual(regex1, regex2)).to.be.true;
    });

    it('returns false for two different RegExp objects', () => {
      const regex1 = /test/i;
      const regex2 = /test/g;
      expect(deepEqual(regex1, regex2)).to.be.false;
    });

    it('returns false for objects with different constructors', () => {
      function Person(name) {
        this.name = name;
      }
      const person1 = new Person('John');
      const person2 = { name: 'John' };
      expect(deepEqual(person1, person2)).to.be.false;
    });

    it('returns true for nested arrays', () => {
      const arr1 = [1, [2, [3, 4]]];
      const arr2 = [1, [2, [3, 4]]];
      expect(deepEqual(arr1, arr2)).to.be.true;
    });

    it('returns false for different nested arrays', () => {
      const arr1 = [1, [2, [3, 4]]];
      const arr2 = [1, [2, [4, 3]]];
      expect(deepEqual(arr1, arr2)).to.be.false;
    });

    it('returns false for arrays of different lengths', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3, 4];
      expect(deepEqual(arr1, arr2)).to.be.false;
    });

    it('returns false for objects with different number of keys', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1 };
      expect(deepEqual(obj1, obj2)).to.be.false;
    });

    it('returns true for objects with identical keys and values in different order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, b: 2, a: 1 };
      expect(deepEqual(obj1, obj2)).to.be.true;
    });

    it('returns true for objects with function properties when functions are ignored', () => {
      const obj1 = { a: 1, b: () => 2 };
      const obj2 = { a: 1, b: () => 3 };
      expect(deepEqual(obj1, obj2)).to.be.true;
    });

    it('returns true for objects with different function references when functions are ignored', () => {
      const func1 = () => 2;
      const func2 = () => 3;
      const obj1 = { a: 1, b: func1 };
      const obj2 = { a: 1, b: func2 };
      expect(deepEqual(obj1, obj2)).to.be.true;
    });
  });
});
