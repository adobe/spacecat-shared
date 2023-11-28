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

import {
  hasText,
  isBoolean,
  isInteger,
  isValidDate,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNumber,
  isObject,
  isString,
  toBoolean,
  arrayEquals,
  isValidUrl,
} from '../src/functions.js';

describe('Shared functions', () => {
  describe('Commons', () => {
    it('is iso date', () => {
      expect(isIsoDate('')).to.be.false;
      expect(isIsoDate('2011-10-05')).to.be.false;
      expect(isIsoDate('2011-10-05T14:48:00.000')).to.be.false;
      expect(isIsoDate('Wed Oct 05 2011 16:48:00 GMT+0200 (CEST)')).to.be.false;

      expect(isIsoDate('2011-10-05T14:48:00.000Z')).to.be.true;
    });

    it('is iso date with time offset', () => {
      expect(isIsoTimeOffsetsDate('')).to.be.false;
      expect(isIsoTimeOffsetsDate('2019-11-15')).to.be.false;
      expect(isIsoTimeOffsetsDate('2019-11-05T14:43:00.000')).to.be.false;
      expect(isIsoTimeOffsetsDate('Wed Oct 11 2019 14:43:00 GMT+0200 (CEST)')).to.be.false;

      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000Z')).to.be.true;
      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000-00:00')).to.be.true;
      expect(isIsoTimeOffsetsDate('2019-11-11T14:43:00.000+05:11')).to.be.true;
    });

    it('has text', () => {
      expect(hasText()).to.be.false;
      expect(hasText(null)).to.be.false;
      expect(hasText(undefined)).to.be.false;
      expect(hasText(123)).to.be.false;
      expect(hasText({})).to.be.false;
      expect(hasText([])).to.be.false;
      expect(hasText(['asd'])).to.be.false;
      expect(hasText({ asd: 'dsa' })).to.be.false;
      expect(hasText('')).to.be.false;

      expect(hasText('a')).to.be.true;
      expect(hasText('1')).to.be.true;
      expect(hasText('a12dsamklda')).to.be.true;
    });

    it('is boolean', () => {
      expect(isBoolean()).to.be.false;
      expect(isBoolean(null)).to.be.false;
      expect(isBoolean(undefined)).to.be.false;
      expect(isBoolean([])).to.be.false;
      expect(isBoolean('foo')).to.be.false;
      expect(isBoolean({})).to.be.false;
      expect(isBoolean(NaN)).to.be.false;
      expect(isBoolean(Infinity)).to.be.false;
      expect(isBoolean(-Infinity)).to.be.false;
      expect(isBoolean(-Infinity)).to.be.false;
      expect(isBoolean(123)).to.be.false;

      expect(isBoolean('true')).to.be.true;
      expect(isBoolean('false')).to.be.true;
      expect(isBoolean(true)).to.be.true;
      expect(isBoolean(false)).to.be.true;
    });

    it('is number', () => {
      expect(isNumber()).to.be.false;
      expect(isNumber(null)).to.be.false;
      expect(isNumber(undefined)).to.be.false;
      expect(isNumber([])).to.be.false;
      expect(isNumber(['dasd'])).to.be.false;
      expect(isNumber({})).to.be.false;
      expect(isNumber({ asd: 'dsa' })).to.be.false;
      expect(isNumber('')).to.be.false;
      expect(isNumber('dasd')).to.be.false;
      expect(isNumber(NaN)).to.be.false;
      expect(isNumber(Infinity)).to.be.false;
      expect(isNumber(-Infinity)).to.be.false;

      expect(isNumber(0)).to.be.true;
      expect(isNumber(123)).to.be.true;
      expect(isNumber(-123)).to.be.true;
      expect(isNumber(12.3)).to.be.true;
    });

    it('is integer', () => {
      expect(isInteger()).to.be.false;
      expect(isInteger(null)).to.be.false;
      expect(isInteger(undefined)).to.be.false;
      expect(isInteger([])).to.be.false;
      expect(isInteger(['dasd'])).to.be.false;
      expect(isInteger({})).to.be.false;
      expect(isInteger({ asd: 'dsa' })).to.be.false;
      expect(isInteger('')).to.be.false;
      expect(isInteger('dasd')).to.be.false;
      expect(isInteger(NaN)).to.be.false;
      expect(isInteger(Infinity)).to.be.false;
      expect(isInteger(-Infinity)).to.be.false;
      expect(isInteger(12.3)).to.be.false;

      expect(isInteger(0)).to.be.true;
      expect(isInteger(123)).to.be.true;
      expect(isInteger(-123)).to.be.true;
    });

    it('is object', () => {
      expect(isObject()).to.be.false;
      expect(isObject(null)).to.be.false;
      expect(isObject(undefined)).to.be.false;
      expect(isObject(123)).to.be.false;
      expect(isObject('dasd')).to.be.false;
      expect(isObject([])).to.be.false;
      expect(isObject(['dasd'])).to.be.false;

      expect(isObject({})).to.be.true;
      expect(isObject({ asd: 'dsa' })).to.be.true;
    });

    it('is string', () => {
      expect(isString()).to.be.false;
      expect(isString(null)).to.be.false;
      expect(isString(undefined)).to.be.false;
      expect(isString(123)).to.be.false;
      expect(isString([])).to.be.false;
      expect(isString(['dasd'])).to.be.false;
      expect(isString({})).to.be.false;
      expect(isString({ asd: 'dsa' })).to.be.false;

      expect(isString('')).to.be.true;
      expect(isString('dasd')).to.be.true;
    });

    it('toBoolean', () => {
      expect(() => toBoolean()).to.throw('Not a boolean value');
      expect(() => toBoolean(null)).to.throw('Not a boolean value');
      expect(() => toBoolean(undefined)).to.throw('Not a boolean value');
      expect(() => toBoolean([])).to.throw('Not a boolean value');
      expect(() => toBoolean('foo')).to.throw('Not a boolean value');
      expect(() => toBoolean({})).to.throw('Not a boolean value');
      expect(() => toBoolean(NaN)).to.throw('Not a boolean value');
      expect(() => toBoolean(Infinity)).to.throw('Not a boolean value');
      expect(() => toBoolean(-Infinity)).to.throw('Not a boolean value');
      expect(() => toBoolean(-Infinity)).to.throw('Not a boolean value');
      expect(() => toBoolean(123)).to.throw('Not a boolean value');

      expect(toBoolean('true')).to.be.true;
      expect(toBoolean('false')).to.be.false;
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
      expect(isValidUrl(null)).to.be.false;
      expect(isValidUrl(undefined)).to.be.false;
      expect(isValidUrl('dummy')).to.be.false;
      expect(isValidUrl(1234)).to.be.false;
      expect(isValidUrl(true)).to.be.false;
      expect(isValidUrl('example.com')).to.be.false;
      expect(isValidUrl('www.example.com')).to.be.false;
      expect(isValidUrl('255.255.255.256')).to.be.false;
      expect(isValidUrl('ftp://abc.com')).to.be.false;
    });

    it('returns true for valid url', async () => {
      expect(isValidUrl('http://abc.xyz')).to.be.true;
      expect(isValidUrl('https://abc.xyz')).to.be.true;
    });
  });

  describe('isValidDate', () => {
    it('returns false for invalid date', async () => {
      expect(isValidDate(null)).to.be.false;
      expect(isValidDate(undefined)).to.be.false;
      expect(isValidDate({})).to.be.false;
      expect(isValidDate([])).to.be.false;
      expect(isValidDate(1234)).to.be.false;
      expect(isValidDate('1234')).to.be.false;
      expect(isValidDate(new Date('2019-11-11T14:43:89.000-00:00'))).to.be.false;
      expect(isValidDate(new Date('invalid date'))).to.be.false;
    });

    it('returns true for valid date', async () => {
      expect(isValidDate(new Date())).to.be.true;
      expect(isValidDate(new Date('2022-01-01T01:23:45.678-00:00'))).to.be.true;
      expect(isValidDate(new Date('2022-01-01T01:23:45.678Z'))).to.be.true;
    });
  });
});
