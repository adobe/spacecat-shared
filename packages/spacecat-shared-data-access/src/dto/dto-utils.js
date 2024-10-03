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

/**
 * Parse the given Epoch timestamp, in seconds, to a Date object.
 * @param {number} epochInSeconds - The Epoch timestamp in seconds.
 * @returns {Date} A new Date object set to the given timestamp.
 */
export function parseEpochToDate(epochInSeconds) {
  const milliseconds = epochInSeconds * 1000;
  return new Date(milliseconds);
}

/**
 * Convert the given Date object to an Epoch timestamp, in seconds.
 * @param {Date} date - The Date object to convert.
 * @returns {number} The Epoch timestamp in seconds.
 */
export function convertDateToEpochSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}
