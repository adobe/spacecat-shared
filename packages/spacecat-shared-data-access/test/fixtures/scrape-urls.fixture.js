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

const scrapeUrls = [
  {
    scrapeUrlId: 'dd92aba6-5509-44a5-afbb-f56e6c4544ed',
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    url: 'https://example-1.com/cars/1',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '531b69c9-0059-42cf-a19d-302d932e22c7',
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    url: 'https://example-1.com/cars/2',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '4cb51b53-f8c6-4975-841d-6ca54489aba4',
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    url: 'https://example-1.com/cars/3',
    status: ScrapeJob.ScrapeUrlStatus.PENDING,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '7aab39a1-a677-461c-a79c-ee7d64c4dd35',
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    url: 'https://example-1.com/cars/4',
    status: ScrapeJob.ScrapeUrlStatus.PENDING,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '5ffc1fa0-9920-43c5-8228-f13354dd2f25',
    scrapeJobId: '021cbb7d-0772-45c6-967c-86a0a598b7dd',
    url: 'https://example-1.com/cars/5',
    status: ScrapeJob.ScrapeUrlStatus.FAILED,
    reason: 'Failed to scrape the URL: Something went wrong. Oops!',
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  // 2
  {
    scrapeUrlId: '59896102-0f4b-4fff-a4cb-e45fd3b5b6b0',
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    url: 'https://example-2.com/cars/1',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '033f7342-c49e-45fd-8026-19b8220bf887',
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    url: 'https://example-2.com/cars/2',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: 'f38a0810-21c9-4bf6-bdeb-6c0c32c38f62',
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    url: 'https://example-2.com/cars/3',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: '480f058f-dde3-4149-ace0-25b14f13d597',
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    url: 'https://example-2.com/cars/4',
    status: ScrapeJob.ScrapeUrlStatus.COMPLETE,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
  {
    scrapeUrlId: 'c5b2c409-6074-4379-a06d-06ca85e8b5d6',
    scrapeJobId: '72113a4d-ca45-4c35-bd2e-29bb0ec03435',
    url: 'https://example-1.com/cars/5',
    status: ScrapeJob.ScrapeUrlStatus.STOPPED,
    processingType: ScrapeJob.ScrapeProcessingType.DEFAULT,
  },
];

export default scrapeUrls;
