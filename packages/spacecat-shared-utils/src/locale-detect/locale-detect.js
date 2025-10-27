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

import * as cheerio from 'cheerio';

import { hasText, isNonEmptyObject, isValidUrl } from '../functions.js';
import { tracingFetch } from '../tracing-fetch.js';
import { indicators } from './indicators.js';

export async function detectLocale(config) {
  const { baseUrl, indicatorFuncs = indicators } = config;

  // Abort if baseUrl was not provided or cannot be parsed
  if (!baseUrl || !isValidUrl(baseUrl)) {
    throw new Error('Invalid baseUrl');
  }
  const indicatorResults = [];

  const parsedBaseUrl = new URL(baseUrl);

  // If not provided, fetch HTML and headers
  let { html, headers } = config;
  if (!hasText(config.html)) {
    const response = await tracingFetch(baseUrl, { timeout: 5000 });
    headers = response.headers;
    html = await response.text();
  } else if (!isNonEmptyObject(config.headers)) {
    const response = await tracingFetch(baseUrl, { timeout: 5000, method: 'HEAD' });
    headers = response.headers;
  }

  const $ = cheerio.load(html);

  // Execute language detection indicators
  for (const indicator of indicatorFuncs) {
    const results = indicator({ baseUrl: parsedBaseUrl, headers, $ });
    indicatorResults.push(...results);
  }

  // Derive locale from results
  const summary = indicatorResults.reduce((acc, indicator) => {
    if (indicator.region) {
      acc.region[indicator.region] = (acc.region[indicator.region] || 0) + 1;
    }
    if (indicator.language) {
      acc.language[indicator.language] = (acc.language[indicator.language] || 0) + 1;
    }
    return acc;
  }, { region: {}, language: {} });
  const region = Object.keys(summary.region).length > 0 ? Object.keys(summary.region).sort((a, b) => summary.region[b] - summary.region[a])[0] : 'US';
  const language = Object.keys(summary.language).length > 0 ? Object.keys(summary.language).sort((a, b) => summary.language[b] - summary.language[a])[0] : 'en';

  return {
    region,
    language,
  };
}
