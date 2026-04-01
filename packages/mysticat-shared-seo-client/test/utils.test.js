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

import {
  parseCsvResponse, coerceValue, getLimit, toApiDate, fromApiDate, todayISO,
  buildFilter, buildQueryParams, extractBrand, INTENT_CODES,
} from '../src/utils.js';

describe('utils', () => {
  describe('parseCsvResponse', () => {
    it('parses semicolon-delimited CSV with headers', () => {
      const csv = 'Name;Age;City\nAlice;30;NYC\nBob;25;LA';
      const result = parseCsvResponse(csv);
      expect(result).to.deep.equal([
        { Name: 'Alice', Age: '30', City: 'NYC' },
        { Name: 'Bob', Age: '25', City: 'LA' },
      ]);
    });

    it('handles double-quoted fields (export_escape=1)', () => {
      const csv = '"Name";"Age";"City"\n"Alice";"30";"NYC"';
      const result = parseCsvResponse(csv);
      expect(result).to.deep.equal([
        { Name: 'Alice', Age: '30', City: 'NYC' },
      ]);
    });

    it('handles semicolons inside quoted fields', () => {
      const csv = 'Title;Url\n"Products; Services - Adobe";"https://example.com/a;b"';
      const result = parseCsvResponse(csv);
      expect(result).to.deep.equal([
        { Tt: 'Products; Services - Adobe', Ur: 'https://example.com/a;b' },
      ]);
    });

    it('handles escaped quotes inside quoted fields', () => {
      const csv = 'Title;Value\n"She said ""hello""";42';
      const result = parseCsvResponse(csv);
      expect(result[0].Tt).to.equal('She said "hello"');
    });

    it('returns empty array for empty input', () => {
      expect(parseCsvResponse('')).to.deep.equal([]);
      expect(parseCsvResponse(null)).to.deep.equal([]);
      expect(parseCsvResponse(undefined)).to.deep.equal([]);
    });

    it('returns empty array for header-only CSV', () => {
      expect(parseCsvResponse('Name;Age')).to.deep.equal([]);
    });

    it('handles missing values', () => {
      const csv = 'A;B;C\n1;;3';
      const result = parseCsvResponse(csv);
      expect(result).to.deep.equal([{ A: '1', B: '', C: '3' }]);
    });

    it('handles rows with fewer values than headers', () => {
      const csv = 'A;B;C\n1;2';
      const result = parseCsvResponse(csv);
      expect(result[0]).to.deep.equal({ A: '1', B: '2', C: '' });
    });

    it('handles single row', () => {
      const csv = 'X\n42';
      const result = parseCsvResponse(csv);
      expect(result).to.deep.equal([{ X: '42' }]);
    });

    it('normalizes known API header names to column codes', () => {
      const csv = 'Organic Keywords;Organic Traffic;Date\n100;5000;20240115';
      const result = parseCsvResponse(csv);
      expect(result[0]).to.deep.equal({ Or: '100', Ot: '5000', Dt: '20240115' });
    });

    it('keeps unknown headers as-is', () => {
      const csv = 'X0;CustomHeader\n42;foo';
      const result = parseCsvResponse(csv);
      expect(result[0]).to.deep.equal({ X0: '42', CustomHeader: 'foo' });
    });
  });

  describe('coerceValue', () => {
    it('coerces to int', () => {
      expect(coerceValue('42', 'int')).to.equal(42);
      expect(coerceValue('0', 'int')).to.equal(0);
      expect(coerceValue('-5', 'int')).to.equal(-5);
    });

    it('returns null for non-numeric int', () => {
      expect(coerceValue('abc', 'int')).to.equal(null);
    });

    it('coerces to float', () => {
      expect(coerceValue('3.14', 'float')).to.equal(3.14);
      expect(coerceValue('0.0', 'float')).to.equal(0);
    });

    it('returns null for non-numeric float', () => {
      expect(coerceValue('abc', 'float')).to.equal(null);
    });

    it('coerces to bool', () => {
      expect(coerceValue('true', 'bool')).to.equal(true);
      expect(coerceValue('1', 'bool')).to.equal(true);
      expect(coerceValue('True', 'bool')).to.equal(true);
      expect(coerceValue('false', 'bool')).to.equal(false);
      expect(coerceValue('0', 'bool')).to.equal(false);
    });

    it('returns string by default', () => {
      expect(coerceValue('hello', 'string')).to.equal('hello');
    });

    it('returns null for empty/null/undefined', () => {
      expect(coerceValue('', 'int')).to.equal(null);
      expect(coerceValue(null, 'int')).to.equal(null);
      expect(coerceValue(undefined, 'float')).to.equal(null);
    });
  });

  describe('getLimit', () => {
    it('returns the smaller of limit and upperLimit', () => {
      expect(getLimit(50, 100)).to.equal(50);
      expect(getLimit(200, 100)).to.equal(100);
      expect(getLimit(100, 100)).to.equal(100);
    });
  });

  describe('toApiDate', () => {
    it('converts YYYY-MM-DD to YYYYMM15', () => {
      expect(toApiDate('2024-01-29')).to.equal('20240115');
      expect(toApiDate('2025-11-10')).to.equal('20251115');
      expect(toApiDate('2023-03-12')).to.equal('20230315');
    });
  });

  describe('todayISO', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = todayISO();
      expect(result).to.match(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('fromApiDate', () => {
    it('converts YYYYMMDD to YYYY-MM-DD', () => {
      expect(fromApiDate('20240115')).to.equal('2024-01-15');
      expect(fromApiDate('20251210')).to.equal('2025-12-10');
    });

    it('returns null for empty/null input', () => {
      expect(fromApiDate('')).to.equal(null);
      expect(fromApiDate(null)).to.equal(null);
      expect(fromApiDate(undefined)).to.equal(null);
    });

    it('returns null for short strings', () => {
      expect(fromApiDate('short')).to.equal(null);
    });

    it('returns null for non-numeric strings', () => {
      expect(fromApiDate('abcdefgh')).to.equal(null);
    });
  });

  describe('INTENT_CODES', () => {
    it('has correct numeric values', () => {
      expect(INTENT_CODES.COMMERCIAL).to.equal(0);
      expect(INTENT_CODES.INFORMATIONAL).to.equal(1);
      expect(INTENT_CODES.NAVIGATIONAL).to.equal(2);
      expect(INTENT_CODES.TRANSACTIONAL).to.equal(3);
    });
  });

  describe('buildFilter', () => {
    it('builds a single filter', () => {
      const result = buildFilter([{
        sign: '+', field: 'Tg', op: 'Gt', value: '0',
      }]);
      expect(result).to.equal('+|Tg|Gt|0');
    });

    it('builds multiple filters', () => {
      const result = buildFilter([
        {
          sign: '+', field: 'Ph', op: 'Co', value: 'seo',
        },
        {
          sign: '+', field: 'Ph', op: 'Co', value: 'marketing',
        },
      ]);
      expect(result).to.equal('+|Ph|Co|seo|+|Ph|Co|marketing');
    });

    it('returns empty string for empty array', () => {
      expect(buildFilter([])).to.equal('');
    });

    it('strips pipe characters from values to prevent injection', () => {
      const result = buildFilter([{
        sign: '+', field: 'Ph', op: 'Co', value: 'seo|+|Ph|Eq|secret',
      }]);
      expect(result).to.equal('+|Ph|Co|seo+PhEqsecret');
    });
  });

  describe('extractBrand', () => {
    it('extracts brand from simple domain', () => {
      expect(extractBrand('adobe.com')).to.equal('adobe');
      expect(extractBrand('google.com')).to.equal('google');
    });

    it('strips www and protocol', () => {
      expect(extractBrand('www.adobe.com')).to.equal('adobe');
      expect(extractBrand('https://adobe.com')).to.equal('adobe');
      expect(extractBrand('http://www.adobe.com')).to.equal('adobe');
    });

    it('handles multi-part TLDs and subdomains', () => {
      expect(extractBrand('example.co.uk')).to.equal('example');
      expect(extractBrand('blog.adobe.com')).to.equal('adobe');
      expect(extractBrand('blog.example.co.uk')).to.equal('example');
    });

    it('handles empty input', () => {
      expect(extractBrand('')).to.equal('');
    });
  });

  describe('buildQueryParams', () => {
    it('merges defaults with overrides', () => {
      const result = buildQueryParams({ a: 1, b: 2 }, { b: 3, c: 4 });
      expect(result).to.deep.equal({ a: 1, b: 3, c: 4 });
    });

    it('returns defaults when no overrides given', () => {
      expect(buildQueryParams({ a: 1 }, {})).to.deep.equal({ a: 1 });
    });

    it('returns overrides when no defaults given', () => {
      expect(buildQueryParams({}, { c: 4 })).to.deep.equal({ c: 4 });
    });
  });
});
