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
import {
  startOfWeek as dfStartOfWeek,
  subWeeks,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';

const MILLIS_IN_DAY = 24 * 60 * 60 * 1000;
const MILLIS_IN_WEEK = 7 * MILLIS_IN_DAY;

function createUTCDate(year, month, day) {
  // If year is < 100, normalize to the current UTC year as requested
  if (!Number.isInteger(year) || year < 100) {
    const currentYear = new Date().getUTCFullYear();
    return new Date(Date.UTC(currentYear, month, day));
  }
  return new Date(Date.UTC(year, month, day));
}

function getFirstMondayOfYear(year) {
  const jan4 = createUTCDate(year, 0, 4);
  return createUTCDate(year, 0, 4 - (jan4.getUTCDay() || 7) + 1);
}

function has53CalendarWeeks(year) {
  const jan1 = createUTCDate(year, 0, 1);
  const dec31 = createUTCDate(year, 11, 31);
  return jan1.getUTCDay() === 4 || dec31.getUTCDay() === 4;
}

function isValidWeek(week, year) {
  if (!Number.isInteger(year) || year < 100 || !Number.isInteger(week) || week < 1) return false;
  if (week === 53) return has53CalendarWeeks(year);
  return week <= 52;
}

function isValidMonth(month, year) {
  return Number.isInteger(year)
  && year >= 100 && Number.isInteger(month) && month >= 1 && month <= 12;
}

// Get last full ISO week { week, year }
function getLastFullCalendarWeek() {
  const anchor = subWeeks(
    dfStartOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
    1,
  );
  return {
    week: getISOWeek(anchor),
    year: getISOWeekYear(anchor),
  };
}

// --- Week triples builder (UTC-safe) ---
function getWeekTriples(week, year) {
  const triplesSet = new Set();
  const firstMonday = getFirstMondayOfYear(year);
  const start = new Date(firstMonday.getTime() + (week - 1) * MILLIS_IN_WEEK);

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start.getTime() + i * MILLIS_IN_DAY);
    const month = d.getUTCMonth() + 1;
    const calYear = d.getUTCFullYear();
    triplesSet.add(`${calYear}-${month}-${week}`);
  }

  return Array.from(triplesSet).map((t) => {
    const [y, m, w] = t.split('-').map(Number);
    return { year: y, month: m, week: w };
  });
}

function buildWeeklyCondition(triples) {
  const parts = triples.map(({ year, month, week }) => `(year=${year} AND month=${month} AND week=${week})`);
  return parts.length === 1 ? parts[0] : parts.join(' OR ');
}

export function getDateRanges(week, year) {
  let effectiveWeek = week;
  let effectiveYear = year;

  if (!isValidWeek(effectiveWeek, effectiveYear)) {
    const lastFull = getLastFullCalendarWeek();
    effectiveWeek = lastFull.week;
    effectiveYear = lastFull.year;
  }

  const firstMonday = getFirstMondayOfYear(effectiveYear);
  const startDate = new Date(firstMonday.getTime() + (effectiveWeek - 1) * MILLIS_IN_WEEK);
  const endDate = new Date(startDate.getTime() + 6 * MILLIS_IN_DAY);
  endDate.setUTCHours(23, 59, 59, 999);

  const startMonth = startDate.getUTCMonth() + 1;
  const endMonth = endDate.getUTCMonth() + 1;
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();

  // Week in one month
  if (startMonth === endMonth) {
    return [{
      year: startYear,
      month: startMonth,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    }];
  }

  // Week spans two months
  const endOfFirstMonth = new Date(Date.UTC(
    startYear,
    startDate.getUTCMonth() + 1, // next month
    0, // last day prev month
    23,
    59,
    59,
    999,
  )).toISOString();

  const startOfSecondMonth = new Date(Date.UTC(
    endYear,
    endDate.getUTCMonth(),
    1,
  )).toISOString();

  return [
    {
      year: startYear,
      month: startMonth,
      startTime: startDate.toISOString(),
      endTime: endOfFirstMonth,
    },
    {
      year: endYear,
      month: endMonth,
      startTime: startOfSecondMonth,
      endTime: endDate.toISOString(),
    },
  ];
}

// --- Public: Get week info ---
export function getWeekInfo(inputWeek = null, inputYear = null) {
  let effectiveWeek = inputWeek;
  let effectiveYear = inputYear;

  if (!isValidWeek(effectiveWeek, effectiveYear)) {
    const lastFull = getLastFullCalendarWeek();
    effectiveWeek = lastFull.week;
    effectiveYear = lastFull.year;
  }

  const triples = getWeekTriples(effectiveWeek, effectiveYear);
  const thursday = new Date(
    getFirstMondayOfYear(effectiveYear).getTime()
    + (effectiveWeek - 1) * MILLIS_IN_WEEK + 3 * MILLIS_IN_DAY,
  );
  const month = thursday.getUTCMonth() + 1;

  return {
    week: effectiveWeek,
    year: effectiveYear,
    month,
    temporalCondition: buildWeeklyCondition(triples),
  };
}

// --- Public: Get month info ---
export function getMonthInfo(inputMonth = null, inputYear = null) {
  const now = new Date();
  const bothProvided = Number.isInteger(inputMonth) && Number.isInteger(inputYear);
  const validProvided = bothProvided && isValidMonth(inputMonth, inputYear);

  if (validProvided) {
    return { month: inputMonth, year: inputYear, temporalCondition: `(year=${inputYear} AND month=${inputMonth})` };
  }

  if (!bothProvided) {
    // No or partial inputs → last full month
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return {
      month: lastMonth.getUTCMonth() + 1,
      year: lastMonth.getUTCFullYear(),
      temporalCondition: `(year=${lastMonth.getUTCFullYear()} AND month=${lastMonth.getUTCMonth() + 1})`,
    };
  }

  // Both provided but invalid → current month
  const currMonth = now.getUTCMonth() + 1;
  const currYear = now.getUTCFullYear();
  return { month: currMonth, year: currYear, temporalCondition: `(year=${currYear} AND month=${currMonth})` };
}

// --- Public: Main decision function ---
export function getTemporalCondition({
  week,
  month,
  year,
  numSeries = 1,
} = {}) {
  const hasWeek = Number.isInteger(week) && week >= 1 && Number.isInteger(year);
  const hasMonth = Number.isInteger(month) && Number.isInteger(year);

  if (numSeries > 1) {
    if (!hasWeek && !hasMonth) {
      throw new Error('Missing required parameters: week or month');
    }

    const conditions = [];
    for (let i = 0; i < numSeries; i += 1) {
      if (hasWeek) {
        let currentWeek = week - i;
        let currentYear = year;
        if (currentWeek < 1) {
          currentWeek = has53CalendarWeeks(currentYear) ? 53 : 52;
          currentYear -= 1;
        }
        conditions.push(getWeekInfo(currentWeek, currentYear).temporalCondition);
      } else if (hasMonth) {
        let currentMonth = month - i;
        let currentYear = year;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear -= 1;
        }
        conditions.push(getMonthInfo(currentMonth, currentYear).temporalCondition);
      }
    }
    return conditions.join(' OR ');
  }

  if (hasWeek && isValidWeek(week, year)) {
    return getWeekInfo(week, year).temporalCondition;
  }

  if (hasMonth && isValidMonth(month, year)) {
    return getMonthInfo(month, year).temporalCondition;
  }

  // Fallbacks
  if (Number.isInteger(week) || (!hasWeek && !hasMonth)) {
    // default last full week
    return getWeekInfo().temporalCondition;
  }

  // Otherwise fall back to last full month
  return getMonthInfo().temporalCondition;
}

// Note: This function binds week exclusively to one year
export function getLastNumberOfWeeks(number) {
  const result = [];
  let { week, year } = getLastFullCalendarWeek();

  for (let i = 0; i < number; i += 1) {
    result.unshift({ week, year });

    week -= 1;
    if (week < 1) {
      year -= 1;
      week = has53CalendarWeeks(year) ? 53 : 52;
    }
  }

  return result;
}

/**
 * Checks if the given date is in the last calendar week of the previous year
 * @param {number} utcMonth - The UTC month as retrieved from date.getUTCMonth()
 * @param {number} utcDate - The UTC date as retrieved from date.getUTCDate()
 * @param {number} utcDay - The UTC day of the week as retrieved from date.getUTCDay()
 * @return {boolean} - if the date is in the previous year's last calendar week.
 */
function isInPreviousCalendarYear(utcMonth, utcDate, utcDay) {
  return (
    utcMonth === 0 // January
    && utcDate < 4 // before 4th January
    && ((utcDay + 6) % 7) > (utcDate + 2) // 1st: Fr, Sa, Su; 2nd: Sa, Su; 3rd: Su
  );
}

/**
 * Calculates the start date of the ISO calendar week for a given date.
 * This is the date of the Monday at 00:00 of the ISO week that contains the given date.
 * @param {number} utcFullYear - The UTC month as retrieved from date.getUTCFullYear()
 * @param {number} utcMonth - The UTC month as retrieved from date.getUTCMonth()
 * @param {number} utcDate - The UTC date as retrieved from date.getUTCDate()
 * @returns {Date} - The start date of the ISO calendar week.
 */
function isoCalendarWeekStart(utcFullYear, utcMonth, utcDate) {
  const utcMidnight = Date.UTC(utcFullYear, utcMonth, utcDate);
  const utcDay = new Date(utcMidnight).getUTCDay();

  // Adjust to Monday
  return new Date(utcMidnight - ((utcDay + 6) % 7) * MILLIS_IN_DAY);
}

/**
 * Checks whether the given date is in the first calendar week of the next year
 * @param {number} utcMonth - The UTC month as retrieved from date.getUTCMonth()
 * @param {number} utcDate - The UTC date as retrieved from date.getUTCDate()
 * @param {number} utcDay - The UTC day of the week as retrieved from date.getUTCDay()
 * @return {boolean} - if the date is in the next year's calendar week 1.
 */
function isInNextCalendarYear(utcMonth, utcDate, utcDay) {
  return (
    utcMonth === 11 // December
    && utcDate > 28 // after 28th December
    // 29th: Mo, 30th: Mo, Tu, 31st: Mo, Tu, We
    && (utcDate - 28) > ((utcDay + 6) % 7)
  );
}

/**
 * Calculates the start date of the ISO calendar week for a given date.
 * This is the date of the Monday at 00:00 of the ISO week that contains the given date.
 * @param {Date} date - The date to calculate the ISO calendar week start for.
 * @returns {Date} - The start date of the ISO calendar week.
 */
export function isoCalendarWeekMonday(date) {
  return isoCalendarWeekStart(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calculates the end date of the ISO calendar week for a given date.
 * This is the date of the Sunday at 23:59:59.999 of the ISO week that contains the given date.
 * @param {Date} date - The date to calculate the ISO calendar week start for.
 * @returns {Date} - The end date/time of the ISO calendar week.
 */
export function isoCalendarWeekSunday(date) {
  const monday = isoCalendarWeekStart(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(+monday + MILLIS_IN_WEEK - 1);
}

/**
 * @typedef {object} ISOCalendarWeek
 * @property {number} week - The ISO calendar week number (1-53).
 * @property {number} year - The year of the ISO calendar week.
 */

/**
 * Calculates the calendar week according to ISO 8601:
 * - Weeks start with Monday and end on Sunday.
 * - Each week's year is the Gregorian year in which the Thursday falls.
 * - It is the first week with a majority (4 or more) of its days in January.
 * - Its first day is the Monday nearest to 1 January.
 * - It has 4 January in it.
 * Hence the earliest possible first week extends
 * - from Monday 29 December (previous Gregorian year) to Sunday 4 January,
 * - the latest possible first week extends from Monday 4 January to Sunday 10 January.
 *
 * See: https://en.wikipedia.org/wiki/ISO_week_date
 *
 * @param {Date} date
 * @returns {ISOCalendarWeek}
 */
export function isoCalendarWeek(date) {
  const utcDay = date.getUTCDay();
  const utcDate = date.getUTCDate();
  const utcMonth = date.getUTCMonth();
  const utcYear = date.getUTCFullYear();

  if (isInNextCalendarYear(utcMonth, utcDate, utcDay)) {
    return { week: 1, year: utcYear + 1 };
  }

  if (isInPreviousCalendarYear(utcMonth, utcDate, utcDay)) {
    return isoCalendarWeek(isoCalendarWeekStart(utcYear, utcMonth, utcMonth));
  }

  // same calendar year

  const weekOneStart = isoCalendarWeekStart(utcYear, 0, 4);
  const weekZeroBased = Math.trunc((+date - +weekOneStart) / MILLIS_IN_WEEK);
  return { week: weekZeroBased + 1, year: utcYear };
}
