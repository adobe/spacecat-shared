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
export function getTemporalCondition({ week, month, year } = {}) {
  const hasWeek = Number.isInteger(week) && Number.isInteger(year);
  const hasMonth = Number.isInteger(month) && Number.isInteger(year);

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
