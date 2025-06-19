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

import { ScrapeJob } from '../../src/index.js';

const scrapeJobs = [
  {
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    baseURL: 'https://example-2.com/cars',
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
    scrapeQueueId: 'Q-321',
    options: {
      [ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT]: true,
      [ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER]: false,
    },
    customHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    status: ScrapeJob.ScrapeJobStatus.RUNNING,
    startedAt: '2023-11-15T03:46:40.000Z',
  },
  {
    scrapeJobId: 'C4E7AEE7-5CB1-48C6-9E5F-3963BAD4F5FD',
    baseURL: 'https://example-2.com/cars',
    processingType: ScrapeJob.ScrapeProcessingType.FORM,
    scrapeQueueId: 'Q-321',
    options: {
      [ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT]: true,
      [ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER]: false,
    },
    customHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    status: ScrapeJob.ScrapeJobStatus.RUNNING,
    startedAt: '2023-11-15T03:46:40.000Z',
  },
  {
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    baseURL: 'https://example-2.com/cars3',
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
    scrapeQueueId: 'Q-321',
    options: {
      [ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT]: true,
      [ScrapeJob.ScrapeOptions.PAGE_LOAD_TIMEOUT]: 10000,
      [ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER]: true,
      [ScrapeJob.ScrapeOptions.WAIT_FOR_SELECTOR]: 'body',
      [ScrapeJob.ScrapeOptions.SCREENSHOT_TYPES]: [
        ScrapeJob.ScrapeScreenshotType.SCROLL,
        ScrapeJob.ScrapeScreenshotType.BLOCK,
      ],
    },
    customHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    status: ScrapeJob.ScrapeJobStatus.RUNNING,
    startedAt: '2023-11-15T03:46:40.000Z',
  },
];

export default scrapeJobs;
