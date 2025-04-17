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

const asyncJobs = [
  {
    asyncJobId: 'b3b1c2e0-1a2b-4c3d-8e9f-1234567890ab',
    status: 'IN_PROGRESS',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    startedAt: '2025-01-01T00:00:00.000Z',
    metadata: {
      submittedBy: 'user1',
      jobType: 'test',
      tags: ['tag1', 'tag2'],
    },
  },
  {
    asyncJobId: 'c4d5e6f7-2b3c-4d5e-9f01-234567890abc',
    status: 'COMPLETED',
    createdAt: '2025-01-02T00:00:00.000Z',
    updatedAt: '2025-01-02T01:00:00.000Z',
    startedAt: '2025-01-02T00:00:00.000Z',
    endedAt: '2025-01-02T01:00:00.000Z',
    recordExpiresAt: 1767312000,
    resultLocation: 's3://bucket/results/job-uuid-2.json',
    resultType: 'S3',
    metadata: {
      submittedBy: 'user2',
      jobType: 'export',
      tags: ['export'],
    },
  },
  {
    asyncJobId: '12d221bb-0c9f-497e-b509-f37e4bf97d29',
    status: 'FAILED',
    createdAt: '2025-01-03T00:00:00.000Z',
    updatedAt: '2025-01-03T00:10:00.000Z',
    startedAt: '2025-01-03T00:00:00.000Z',
    endedAt: '2025-01-03T00:10:00.000Z',
    recordExpiresAt: 1767398400,
    error: {
      code: 'ERR_TIMEOUT',
      message: 'Job timed out',
      details: { timeout: 300 },
    },
    metadata: {
      submittedBy: 'user3',
      jobType: 'import',
      tags: ['import', 'timeout'],
    },
  },
  {
    asyncJobId: 'f1a7b60a-6c6c-490d-9020-f56360788d34',
    status: 'COMPLETED',
    createdAt: '2025-01-04T00:00:00.000Z',
    updatedAt: '2025-01-04T00:05:00.000Z',
    startedAt: '2025-01-04T00:00:00.000Z',
    endedAt: '2025-01-04T00:05:00.000Z',
    recordExpiresAt: 1767484800,
    resultType: 'INLINE',
    result: { value: 42 },
    metadata: {
      submittedBy: 'user4',
      jobType: 'calculation',
      tags: ['inline'],
    },
  },
];

export default asyncJobs;
