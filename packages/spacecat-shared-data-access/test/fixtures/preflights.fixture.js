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

// siteId values reference sites.fixture.js
// asyncJobId values reference async-jobs.fixture.js
// Lifecycle fields started_at / result / error live on async_jobs only
// (SITES-47254) — fetched via getAsyncJob() when needed.
const preflights = [
  {
    preflightId: 'a1b2c3d4-0001-4000-8000-000000000001',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    asyncJobId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
    url: 'https://www.example.com/page1',
    status: 'IN_PROGRESS',
    createdBy: { email: 'user1@example.com', displayName: 'User One' },
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
  },
  {
    preflightId: 'a1b2c3d4-0002-4000-8000-000000000002',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    asyncJobId: 'c4d5e6f7-2b3c-4d5e-9f01-234567890abc',
    url: 'https://www.example.com/page2',
    status: 'COMPLETED',
    createdBy: { email: 'user2@example.com', displayName: 'User Two' },
    createdAt: '2025-06-01T11:00:00.000Z',
    updatedAt: '2025-06-01T11:05:00.000Z',
    endedAt: '2025-06-01T11:05:00.000Z',
  },
  {
    preflightId: 'a1b2c3d4-0003-4000-8000-000000000003',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    asyncJobId: '12d221bb-0c9f-497e-b509-f37e4bf97d29',
    url: 'https://www.another-site.com/home',
    status: 'FAILED',
    createdBy: { email: 'user3@example.com', displayName: 'User Three' },
    createdAt: '2025-06-02T09:00:00.000Z',
    updatedAt: '2025-06-02T09:01:00.000Z',
    endedAt: '2025-06-02T09:01:00.000Z',
  },
];

export default preflights;
