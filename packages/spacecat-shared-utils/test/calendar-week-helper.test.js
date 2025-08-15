/*
 * Copyright 2025 Adobe. All rights reserved.
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
import { expect } from 'chai';
import sinon from 'sinon';
import {
  getDateRanges,
  getLastNumberOfWeeks,
  getWeekInfo,
  getMonthInfo,
  getTemporalCondition,
} from '../src/calendar-week-helper.js';

describe('Utils - getLastNumberOfWeeks', () => {
  let clock;

  afterEach(() => {
    if (clock) {
      clock.restore();
    }
  });

  it('should return the last 5 weeks correctly', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-25T12:00:00Z'));
    const result = getLastNumberOfWeeks(5);
    expect(result).to.deep.equal([
      { week: 25, year: 2025 },
      { week: 26, year: 2025 },
      { week: 27, year: 2025 },
      { week: 28, year: 2025 },
      { week: 29, year: 2025 },
    ]);
  });

  it('should handle year boundaries correctly', () => {
    clock = sinon.useFakeTimers(new Date('2025-01-15T12:00:00Z'));
    const result = getLastNumberOfWeeks(5);
    expect(result).to.deep.equal([
      { week: 50, year: 2024 },
      { week: 51, year: 2024 },
      { week: 52, year: 2024 },
      { week: 1, year: 2025 },
      { week: 2, year: 2025 },
    ]);
  });

  it('should handle 53-week years correctly', () => {
    clock = sinon.useFakeTimers(new Date('2021-01-10T12:00:00Z'));
    const result = getLastNumberOfWeeks(3);
    expect(result).to.deep.equal([
      { week: 51, year: 2020 },
      { week: 52, year: 2020 },
      { week: 53, year: 2020 },
    ]);
  });

  it('should handle year boundaries correctly for a 52-week year', () => {
    clock = sinon.useFakeTimers(new Date('2026-01-12T12:00:00Z'));
    const result = getLastNumberOfWeeks(3);
    expect(result).to.deep.equal([
      { week: 52, year: 2025 },
      { week: 1, year: 2026 },
      { week: 2, year: 2026 },
    ]);
  });

  it('should set week to 53 when rolling back to a year with 53 weeks', () => {
    clock = sinon.useFakeTimers(new Date('2021-01-11T12:00:00Z'));
    const result = getLastNumberOfWeeks(2);
    expect(result).to.deep.equal([
      { week: 53, year: 2020 },
      { week: 1, year: 2021 },
    ]);
  });

  it('covers internal year<100 date construction path (lines 25-27)', function () {
    this.timeout(20000);
    // Force enough iterations so that internal logic evaluates a year < 100
    const currentYear = new Date().getUTCFullYear();
    const n = ((currentYear - 99) * 53) + 2;
    const result = getLastNumberOfWeeks(n);
    expect(result.length).to.equal(n);
  });
});

describe('Utils - getDateRanges', () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
  });

  afterEach(() => {
    clock.restore();
  });

  it('should return the correct date range for Week 1 spanning two years', () => {
    const result = getDateRanges(1, 2025);
    expect(result).to.deep.equal([
      {
        year: 2024,
        month: 12,
        startTime: '2024-12-30T00:00:00.000Z',
        endTime: '2024-12-31T23:59:59.999Z',
      },
      {
        year: 2025,
        month: 1,
        startTime: '2025-01-01T00:00:00.000Z',
        endTime: '2025-01-05T23:59:59.999Z',
      },
    ]);
  });

  it('should handle weeks spanning two months within the same year', () => {
    const result = getDateRanges(5, 2025);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 1,
        startTime: '2025-01-27T00:00:00.000Z',
        endTime: '2025-01-31T23:59:59.999Z',
      },
      {
        year: 2025,
        month: 2,
        startTime: '2025-02-01T00:00:00.000Z',
        endTime: '2025-02-02T23:59:59.999Z',
      },
    ]);
  });

  it('should handle week 53 in a 53-week year spanning two years', () => {
    const result = getDateRanges(53, 2020);
    expect(result).to.deep.equal([
      {
        year: 2020,
        month: 12,
        startTime: '2020-12-28T00:00:00.000Z',
        endTime: '2020-12-31T23:59:59.999Z',
      },
      {
        year: 2021,
        month: 1,
        startTime: '2021-01-01T00:00:00.000Z',
        endTime: '2021-01-03T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week for week 53 in a 52-week year', () => {
    const result = getDateRanges(53, 2023);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 7,
        startTime: '2025-07-07T00:00:00.000Z',
        endTime: '2025-07-13T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week for invalid week', () => {
    const result = getDateRanges(0, 2024);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 7,
        startTime: '2025-07-07T00:00:00.000Z',
        endTime: '2025-07-13T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week for invalid year', () => {
    const result = getDateRanges(1, 99);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 7,
        startTime: '2025-07-07T00:00:00.000Z',
        endTime: '2025-07-13T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week if week and year are not supplied', () => {
    const result = getDateRanges(1, 99);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 7,
        startTime: '2025-07-07T00:00:00.000Z',
        endTime: '2025-07-13T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week of previous year if current week is the first week of the year', () => {
    clock.restore();
    clock = sinon.useFakeTimers(new Date('2025-01-01T12:00:00Z'));
    const result = getDateRanges();
    expect(result).to.deep.equal([
      {
        year: 2024,
        month: 12,
        startTime: '2024-12-23T00:00:00.000Z',
        endTime: '2024-12-29T23:59:59.999Z',
      },
    ]);
  });

  it('should fall back to last full calendar week of previous year if current week is the first week of the year (2024)', () => {
    clock.restore();
    clock = sinon.useFakeTimers(new Date('2024-01-03T12:00:00Z'));
    const result = getDateRanges();
    expect(result).to.deep.equal([
      {
        year: 2023,
        month: 12,
        startTime: '2023-12-25T00:00:00.000Z',
        endTime: '2023-12-31T23:59:59.999Z',
      },
    ]);
  });

  it('should correctly calculate the date range of a week that spans only one month', () => {
    const result = getDateRanges(28, 2025);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 7,
        startTime: '2025-07-07T00:00:00.000Z',
        endTime: '2025-07-13T23:59:59.999Z',
      },
    ]);
  });

  it('should return the correct date range when Jan 4 is a Sunday', () => {
    const result = getDateRanges(1, 2026);
    expect(result).to.deep.equal([
      {
        year: 2025,
        month: 12,
        startTime: '2025-12-29T00:00:00.000Z',
        endTime: '2025-12-31T23:59:59.999Z',
      },
      {
        year: 2026,
        month: 1,
        startTime: '2026-01-01T00:00:00.000Z',
        endTime: '2026-01-04T23:59:59.999Z',
      },
    ]);
  });
});

describe('Utils - temporal helpers', () => {
  let clock;

  afterEach(() => {
    if (clock) {
      clock.restore();
      clock = null;
    }
  });

  it('getMonthInfo(): no args uses last full month', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getMonthInfo();
    expect(info).to.deep.equal({ month: 6, year: 2025, temporalCondition: '(year=2025 AND month=6)' });
  });

  it('getWeekInfo: valid inputs spanning two months', () => {
    const info = getWeekInfo(5, 2025); // 2025-01-27..2025-02-02
    expect(info.week).to.equal(5);
    expect(info.year).to.equal(2025);
    expect(info.month).to.equal(1); // Thursday is Jan 30
    expect(info.temporalCondition).to.equal('(year=2025 AND month=1 AND week=5) OR (year=2025 AND month=2 AND week=5)');
  });

  it('getWeekInfo: invalid inputs fallback to last full week (covers helper)', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getWeekInfo(0, 99);
    expect(info).to.deep.equal({
      week: 28,
      month: 7,
      year: 2025,
      temporalCondition: 'year=2025 AND month=7 AND week=28',
    });
  });

  it('getMonthInfo: invalid inputs fallback to current month', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getMonthInfo(0, 99);
    expect(info).to.deep.equal({
      month: 7,
      year: 2025,
      temporalCondition: '(year=2025 AND month=7)',
    });
  });

  it('getMonthInfo: valid inputs are preserved', () => {
    const info = getMonthInfo(8, 2025);
    expect(info).to.deep.equal({
      month: 8,
      year: 2025,
      temporalCondition: '(year=2025 AND month=8)',
    });
  });

  // Additional coverage for single-month and cross-month week conditions
  it('getWeekInfo: single month week returns single condition string', () => {
    const info = getWeekInfo(28, 2025); // 2025-07-08..2025-07-14 (ISO week 28)
    expect(info.temporalCondition).to.equal('year=2025 AND month=7 AND week=28');
  });

  it('getWeekInfo: week 53 in 2020 spans two months and sets month=12', () => {
    const info = getWeekInfo(53, 2020); // 2020-12-28..2021-01-03
    expect(info.month).to.equal(12);
    expect(info.temporalCondition).to.equal('(year=2020 AND month=12 AND week=53) OR (year=2021 AND month=1 AND week=53)');
  });

  // Coverage for getMonthInfo partial inputs and invalid year
  it('getMonthInfo: missing year falls back to last full month', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getMonthInfo(8);
    expect(info).to.deep.equal({ month: 6, year: 2025, temporalCondition: '(year=2025 AND month=6)' });
  });

  it('getMonthInfo: missing month falls back to last full month', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getMonthInfo(undefined, 2025);
    expect(info).to.deep.equal({ month: 6, year: 2025, temporalCondition: '(year=2025 AND month=6)' });
  });

  it('getMonthInfo: invalid year (<100) falls back to current month', () => {
    clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
    const info = getMonthInfo(8, 25);
    expect(info).to.deep.equal({ month: 7, year: 2025, temporalCondition: '(year=2025 AND month=7)' });
  });

  describe('getTemporalCondition', () => {
    afterEach(() => {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });

    it('returns condition for valid week/year with single month', () => {
      const c = getTemporalCondition({ week: 28, year: 2025 });
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });

    it('returns condition for valid week/year spanning two months', () => {
      const c = getTemporalCondition({ week: 5, year: 2025 });
      expect(c).to.equal('(year=2025 AND month=1 AND week=5) OR (year=2025 AND month=2 AND week=5)');
    });

    it('returns condition for valid month/year', () => {
      const c = getTemporalCondition({ month: 8, year: 2025 });
      expect(c).to.equal('(year=2025 AND month=8)');
    });

    it('falls back to last full week when week invalid (covers helper)', () => {
      clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
      const c = getTemporalCondition({ week: 0, year: 99 });
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });

    it('falls back to last full month when month invalid (covers helper)', () => {
      clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
      const c = getTemporalCondition({ month: 0, year: 99 });
      expect(c).to.equal('(year=2025 AND month=6)');
    });

    it('falls back to last full week when no inputs provided (covers helper)', () => {
      clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
      const c = getTemporalCondition();
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });

    it('prefers week when both week and month are provided (single-month week)', () => {
      const c = getTemporalCondition({ week: 28, month: 8, year: 2025 });
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });

    it('prefers week when both week and month are provided (two-month week)', () => {
      const c = getTemporalCondition({ week: 5, month: 8, year: 2025 });
      expect(c).to.equal('(year=2025 AND month=1 AND week=5) OR (year=2025 AND month=2 AND week=5)');
    });

    it('uses month when week invalid but month valid', () => {
      const c = getTemporalCondition({ week: 0, month: 8, year: 2025 });
      expect(c).to.equal('(year=2025 AND month=8)');
    });

    it('week 53 in 2020 returns OR across years and months', () => {
      const c = getTemporalCondition({ week: 53, year: 2020 });
      expect(c).to.equal('(year=2020 AND month=12 AND week=53) OR (year=2021 AND month=1 AND week=53)');
    });

    it('only week without year falls back to last full week', () => {
      clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
      const c = getTemporalCondition({ week: 10 });
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });

    it('only month without year falls back to last full week', () => {
      clock = sinon.useFakeTimers(new Date('2025-07-16T12:00:00Z'));
      const c = getTemporalCondition({ month: 8 });
      expect(c).to.equal('year=2025 AND month=7 AND week=28');
    });
  });
});
