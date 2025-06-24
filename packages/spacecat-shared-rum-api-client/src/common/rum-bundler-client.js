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

const BASE_URL = 'https://bundles.aem.page/bundles';
const HOURS_IN_DAY = 24;
const ONE_HOUR = 1000 * 60 * 60;
const ONE_DAY = ONE_HOUR * HOURS_IN_DAY;

const CHUNK_SIZE = 31;

function isBotTraffic(bundle) {
  return bundle?.userAgent?.includes('bot');
}

function filterEvents(checkpoints = []) {
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

function generateUrlsForDateRange(startDate, endDate, domain, granularity, domainkey) {
  const urls = [];
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);

  while (currentDate <= endDateTime) {
    urls.push(constructUrl(domain, currentDate, granularity, domainkey));

    if (granularity.toUpperCase() === GRANULARITY.HOURLY) {
      currentDate.setUTCHours(currentDate.getUTCHours() + 1);
    } else {
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  return urls;
}

/* c8 ignore start */
/*
 * throw-away code for a single customer who customized the experimentation engine
 * this code will be removed once they start using the default exp engine
 *
 * this function fetches experiment manifests, then merges variants data into controls data
 *
 * ie:
 *
 * if the customer runs for an experiment where variants are as following:
 *   control: /
 *   challenger-1: /a1/
 *   challenger-2: /a2/
 *
 * then data for the `/a1/` and `/a2` are counted towards `/`'s data
 */
async function mergeBundlesWithSameId(bundles) {
  if (!bundles[0]?.url?.includes('bamboohr.com')) return bundles;
  const prodBaseUrl = 'https://www.bamboohr.com/experiments/';
  const previewBaseUrl = 'https://main--bamboohr-website--bamboohr.hlx.page/experiments/archive/';
  const manifestUrls = [
    ...new Set(bundles.flatMap((bundle) => bundle.events
      .filter((e) => e.checkpoint === 'experiment')
      .map((e) => e.source))),
  ];
  const manifestUrlPromises = manifestUrls.map(async (experiment) => {
    try {
      const response = await fetch(`${prodBaseUrl}${experiment}/manifest.json`);
      if (!response.ok) {
        throw new Error('manifest request failed');
      }
      const data = await response.json();
      return { url: `${prodBaseUrl}${experiment}/manifest.json`, data };
    } catch {
      try {
        const previewUrlResponse = await fetch(`${previewBaseUrl}${experiment}/manifest.json`);
        if (!previewUrlResponse.ok) {
          throw new Error('manifest request failed');
        }
        const previewUrlData = await previewUrlResponse.json();
        return { url: `${previewBaseUrl}${experiment}/manifest.json`, data: previewUrlData };
      } catch {
        return { url: `${previewBaseUrl}${experiment}/manifest.json`, data: null };
      }
    }
  });
  const experiments = await Promise.all(manifestUrlPromises);
  let hasSeenPages = false; // required for multi-page experiments
  const variants = (await Promise.all(experiments.map((e) => e.data)))
    .filter((json) => json && Object.keys(json).length > 0)
    .flatMap((json) => json.experiences?.data ?? [])
    .filter((data) => {
      if (data.Name === 'Pages') {
        hasSeenPages = true;
      } else if (['Percentage Split', 'Label', 'Blocks'].includes(data.Name)) {
        // reset the flag when we see the next experiment
        hasSeenPages = false;
      }
      return data.Name === 'Pages' || (hasSeenPages && data.Name === '');
    });

  const mapping = variants.reduce((acc, cur) => {
    Object.entries(cur)
      .filter(([k]) => !['Name', 'Control'].includes(k))
      .forEach(([, v]) => {
        acc[new URL(v).pathname] = new URL(cur.Control).pathname;
      });
    return acc;
  }, {});

  const variantPaths = Object.keys(mapping);

  const getControlPath = (url) => {
    const path = new URL(url).pathname;
    if (variantPaths.includes(path)) return mapping[path];
    return path;
  };

  const byIdAndPath = bundles.reduce((acc, cur) => {
    const controlPath = getControlPath(cur.url);
    const key = `${cur.id}-${controlPath}`;
    if (!acc[key]) acc[key] = [];
    if (variantPaths.includes(new URL(cur.url).pathname)) {
      // eslint-disable-next-line no-param-reassign
      cur.url = new URL(controlPath, cur.url).href;
    }
    acc[key].push(cur);
    return acc;
  }, {});

  const merged = Object.entries(byIdAndPath).flatMap(([, v]) => {
    let value = v;
    if (v.length > 1) {
      v[0].events.push(...v.slice(1).flatMap((bundle) => bundle.events));
      value = [v[0]];
    }
    return value;
  });

  return Object.values(merged);
}
/* c8 ignore end */

async function fetchBundles(opts, log) {
  const {
    domain,
    domainkey,
    interval = 7,
    granularity = GRANULARITY.DAILY,
    checkpoints = [],
    filterBotTraffic = true,
    startTime,
    endTime,
  } = opts;

  if (!hasText(domain) || !hasText(domainkey)) {
    throw new Error('Missing required parameters');
  }

  // Validate startTime and endTime if provided
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid startTime or endTime format. Use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")');
    }

    if (start >= end) {
      throw new Error('startTime must be before endTime');
    }
  }

  let urls = [];

  if (startTime && endTime) {
    // Use custom date range
    urls = generateUrlsForDateRange(startTime, endTime, domain, granularity, domainkey);
  } else {
    // Use existing interval-based logic
    const multiplier = granularity.toUpperCase() === GRANULARITY.HOURLY ? ONE_HOUR : ONE_DAY;
    const range = granularity.toUpperCase() === GRANULARITY.HOURLY
      ? interval * HOURS_IN_DAY
      : interval + 1;

    const currentDate = new Date();

    for (let i = 0; i < range; i += 1) {
      const date = new Date(currentDate.getTime() - i * multiplier);
      urls.push(constructUrl(domain, date, granularity, domainkey));
    }
  }

  const chunks = getUrlChunks(urls, CHUNK_SIZE);

  let totalTransferSize = 0;

  const result = [];
  for (const chunk of chunks) {
    // eslint-disable-next-line no-loop-func
    const responses = await Promise.all(chunk.map(async (url) => {
      const response = await fetch(url);
      totalTransferSize += parseInt(response.headers.get('content-length'), 10);
      return response;
    }));
    const bundles = await Promise.all(responses.map((response) => response.json()));
    bundles.forEach((b) => {
      b.rumBundles
        .filter((bundle) => !filterBotTraffic || !isBotTraffic(bundle))
        .map(filterEvents(checkpoints))
        .forEach((bundle) => result.push(bundle));
    });
  }
  log.info(`Retrieved RUM bundles. Total transfer size (in KB): ${(totalTransferSize / 1024).toFixed(2)}`);
  return mergeBundlesWithSameId(result);
}

export {
  fetchBundles,
};
