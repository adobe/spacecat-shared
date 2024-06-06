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
/* eslint-disable no-await-in-loop */

import { hasText } from '@adobe/spacecat-shared-utils';
import { fetch } from '../utils.js';
import { GRANULARITY } from './constants.js';

const BASE_URL = 'https://rum.fastly-aem.page/bundles';
const HOURS_IN_DAY = 24;
const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * HOURS_IN_DAY;

const CHUNK_SIZE = 31;

function filterBundles(checkpoints = []) {
  return (bundle) => {
    if (checkpoints.length > 0) {
      const events = bundle.events.filter((event) => checkpoints.includes(event.checkpoint));
      return {
        ...bundle,
        events,
      };
    }
    return bundle;
  };
}

function constructUrl(domain, date, granularity, domainkey) {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hour = granularity.toUpperCase() === GRANULARITY.HOURLY ? `/${date.getUTCHours().toString().padStart(2, '0')}` : '';

  return `${BASE_URL}/${domain}/${year}/${month}/${day}${hour}?domainkey=${domainkey}`;
}

function getUrlChunks(urls, chunkSize) {
  return Array(Math.ceil(urls.length / chunkSize))
    .fill()
    .map((_, index) => urls.slice(index * chunkSize, (index + 1) * chunkSize));
}

async function fetchBundles(opts = {}) {
  const {
    domain,
    domainkey,
    interval = 7,
    granularity = GRANULARITY.DAILY,
    checkpoints = [],
  } = opts;

  if (!hasText(domain) || !hasText(domainkey)) {
    throw new Error('Missing required parameters');
  }

  const multiplier = granularity.toUpperCase() === GRANULARITY.HOURLY ? ONE_HOUR : ONE_DAY;
  const range = granularity.toUpperCase() === GRANULARITY.HOURLY
    ? interval * HOURS_IN_DAY
    : interval + 1;

  const urls = [];
  const currentDate = new Date();

  for (let i = 0; i < range; i += 1) {
    const date = new Date(currentDate.getTime() - i * multiplier);
    urls.push(constructUrl(domain, date, granularity, domainkey));
  }

  const chunks = getUrlChunks(urls, CHUNK_SIZE);

  const result = [];
  for (const chunk of chunks) {
    const responses = await Promise.all(chunk.map((url) => fetch(url)));
    const bundles = await Promise.all(responses.map((response) => response.json()));
    result.push(...bundles.flatMap((b) => b.rumBundles.map(filterBundles(checkpoints))));
  }
  return result;
}

export {
  fetchBundles,
};
