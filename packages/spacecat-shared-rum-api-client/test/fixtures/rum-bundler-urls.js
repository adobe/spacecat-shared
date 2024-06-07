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
export function generateHourlyDates(interval) {
  const endDateTime = new Date(); // Current date and time in UTC
  const startDateTime = new Date(endDateTime.getTime() - interval * 24 * 60 * 60 * 1000);
  const result = [];

  for (let date = startDateTime; date <= endDateTime; date.setUTCHours(date.getUTCHours() + 1)) {
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hour = date.getUTCHours().toString().padStart(2, '0');
    result.push([year, month, day, hour]);
  }

  return result.slice(1);
}

export function generateDailyDates(interval) {
  const endDateTime = new Date(); // Current date and time in UTC
  const startDateTime = new Date(endDateTime.getTime() - interval * 24 * 60 * 60 * 1000);
  const result = [];

  for (let date = startDateTime; date <= endDateTime; date.setUTCDate(date.getUTCDate() + 1)) {
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    result.push([year, month, day]);
  }

  return result;
}

export function generateRumBundles(dates, checkpoints) {
  const result = {};
  for (const date of dates) {
    result[date.join()] = {
      rumBundles: [{
        id: date.join(),
        weight: 100,
        events: checkpoints.map((checkpoint) => ({ checkpoint })),
      }],
    };
  }

  return result;
}
