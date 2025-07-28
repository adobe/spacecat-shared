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
import { getDateRanges, getLastNumberOfWeeks } from '../src/calendar-week-helper.js';

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
    // January 10, 2021, belongs to the last week of the 53-week year 2020
    clock = sinon.useFakeTimers(new Date('2021-01-10T12:00:00Z'));
    const result = getLastNumberOfWeeks(3);
    expect(result).to.deep.equal([
      { week: 51, year: 2020 },
      { week: 52, year: 2020 },
      { week: 53, year: 2020 },
    ]);
  });

  it('should handle year boundaries correctly for a 52-week year', () => {
    // 2025 is a 52-week year.
    // Setting date to early 2026, so we go back to 2025.
    clock = sinon.useFakeTimers(new Date('2026-01-12T12:00:00Z')); // Monday of Week 3, 2026
    const result = getLastNumberOfWeeks(3);
    expect(result).to.deep.equal([
      { week: 52, year: 2025 },
      { week: 1, year: 2026 },
      { week: 2, year: 2026 },
    ]);
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
