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
import { gzipSync } from 'zlib';
/* eslint-env mocha */

export const EVARS_KEY = 'eVars';
export const EVENTS_KEY = 'events';

export function getNextDay(dateString, offset) {
  if (offset < 0) {
    throw new Error('Offset must be a positive number');
  }
  const currentDate = !dateString ? new Date() : new Date(dateString);
  currentDate.setUTCDate(currentDate.getDate() + (offset || 1));
  return currentDate.toISOString().split('T')[0];
}

export function getPreviousDay(dateString, offset) {
  if (offset < 0) {
    throw new Error('Offset must be a positive number');
  }
  const currentDate = !dateString ? new Date() : new Date(dateString);
  currentDate.setUTCDate(currentDate.getDate() - (offset || 1));
  return currentDate.toISOString().split('T')[0];
}

export function parseDates(inputText) {
  if (!inputText) {
    return [];
  }

  const segments = inputText.split(';');

  const dates = segments.reduce((acc, segment) => {
    const trimmedSegment = segment.trim();
    if (trimmedSegment.includes(',')) {
      const [startDate, endDate] = trimmedSegment.split(',');
      if (startDate > endDate) {
        throw new Error('Start date cannot be after end date');
      }
      let currentDate;
      try {
        currentDate = new Date(`${startDate}T00:00:00.000Z`);
      } catch (error) {
        throw new Error(`Invalid start date ${startDate}`);
      }
      let finalDate;
      try {
        finalDate = new Date(`${endDate}T00:00:00.000Z`);
      } catch (error) {
        throw new Error(`Invalid end date ${endDate}`);
      }
      while (currentDate <= finalDate) {
        acc.push(currentDate.toISOString().split('T')[0]);
        currentDate.setUTCDate(currentDate.getDate() + 1);
      }
    } else if (trimmedSegment) {
      acc.push(trimmedSegment);
    }
    return acc;
  }, []);

  return dates;
}

export function validateConfig(config) {
  if (!config || Object.keys(config).length === 0) {
    throw new Error('No configuration found');
  }
  if (!config.domain) {
    throw new Error('Missing domain from project configuration');
  }
  if (config.timezone && !config.timezone.startsWith('UTC')) {
    throw new Error('Invalid timezone in project configuration. Timezones should start with UTC.');
  }
  ['reportSuiteID', 'visitorID', 'userAgent', 'pageURL'].forEach((key) => {
    if (!config.rum2aaMapping[key]
            || (!config.rum2aaMapping[key].rumField && !config.rum2aaMapping[key].default)) {
      throw new Error(`Missing default or value mapping for ${key} in project configuration under rum2aaMapping section`);
    }
  });
  if (!config.rum2aaMapping[EVARS_KEY]) {
    throw new Error('Missing eVars mapping in project configuration under rum2aaMapping section');
  }
  Object.entries(config.rum2aaMapping[EVARS_KEY]).forEach(([entryKey, entryValue]) => {
    if (!entryKey.startsWith('eVar')) {
      throw new Error(`Invalid specification under eVars, should be eVar$NUMBER, not ${entryValue}`);
    }
    if (!entryValue.rumField && !entryValue.default) {
      throw new Error(`Missing default or value mapping for evar ${entryValue} in project configuration under rum2aaMapping section`);
    }
  });
  if (!config.rum2aaMapping[EVENTS_KEY]) {
    throw new Error('Missing events mapping in project configuration under rum2aaMapping section');
  }
  Object.entries(config.rum2aaMapping[EVENTS_KEY]).forEach(([entryKey, entryValue]) => {
    if (!entryKey.startsWith('event')) {
      throw new Error(`Invalid specification under events, should be event$NUMBER, not ${entryKey}`);
    }
    if (!entryValue.rumField && !entryValue.default) {
      throw new Error(`Missing default or value mapping for event ${entryValue} in project configuration under rum2aaMapping section`);
    }
  });
}

export function stringToUint8Array(content) {
  return Uint8Array.from(content, (char) => char.charCodeAt(0));
}

export function createArchive(content) {
  return gzipSync(content);
}
