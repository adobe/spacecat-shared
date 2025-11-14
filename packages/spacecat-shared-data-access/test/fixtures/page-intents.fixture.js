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

const pageIntents = [
  {
    pageIntentId: '9207cd0b-f8e0-4dde-a33b-e074b470ed8e',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    url: 'https://example0.com/page0',
    pageIntent: 'INFORMATIONAL',
    topic: 'firefly',
    analysisStatus: 'SUCCESS',
    analysisAttempts: 1,
    lastAnalysisAt: '2025-11-07T10:00:00.000Z',
  },
  {
    pageIntentId: 'e61a9beb-d3ec-4d53-8652-1b6b43127b3e',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    url: 'https://example1.com/page1',
    pageIntent: 'NAVIGATIONAL',
    topic: 'photoshop',
    analysisStatus: 'FAILED',
    analysisAttempts: 3,
    lastAnalysisAt: '2025-11-07T11:30:00.000Z',
    analysisError: {
      code: 'INVALID_RESPONSE',
      message: 'AI model returned invalid page intent format',
      details: {
        rawResponse: 'UNKNOWN_INTENT',
        attemptedAt: '2025-11-07T11:30:00.000Z',
      },
    },
  },
  {
    pageIntentId: '36fc2fe4-6fd4-45dd-8cf3-2f1aedf778e3',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    url: 'https://example2.com/page2',
    pageIntent: 'TRANSACTIONAL',
    topic: 'express',
  },
  {
    pageIntentId: '898c80c6-61a9-4636-ab99-756a8d9d1a51',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    url: 'https://example3.com/page3',
    pageIntent: 'COMMERCIAL',
    topic: 'analytics',
  },
  {
    pageIntentId: '78bb0d8d-456d-494d-86c3-13218dd573b5',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    url: 'https://example4.com/page4',
    pageIntent: 'INFORMATIONAL',
    topic: 'design',
  },
  {
    pageIntentId: '9112343b-0c7b-4595-a796-79b386bb1b7a',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    url: 'https://example5.com/page5',
    pageIntent: 'NAVIGATIONAL',
    topic: 'marketing',
  },
  {
    pageIntentId: '86a1d72d-727f-4e4e-af18-0e68828d96a1',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    url: 'https://example6.com/page6',
    pageIntent: 'TRANSACTIONAL',
    topic: 'sales',
  },
  {
    pageIntentId: '8e6f3171-2f2f-47f0-9c7f-53322ef1c230',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    url: 'https://example7.com/page7',
    pageIntent: 'COMMERCIAL',
    topic: 'support',
  },
  {
    pageIntentId: '9adf7286-95c5-411a-aa37-44fb9b73a47a',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    url: 'https://example8.com/page8',
    pageIntent: 'INFORMATIONAL',
    topic: 'blog',
  },
  {
    pageIntentId: 'd3dad39c-d8cb-4946-846f-64df2c97cd37',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    url: 'https://example9.com/page9',
    pageIntent: 'NAVIGATIONAL',
    topic: 'careers',
  },
];

export default pageIntents;
