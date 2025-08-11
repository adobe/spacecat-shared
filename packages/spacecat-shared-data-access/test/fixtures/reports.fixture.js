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

const reports = [
  {
    reportId: 'a1b2c3d4-e5f6-7890-abcd-1234567890ab',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    reportType: 'optimization',
    reportPeriod: {
      startDate: '2025-06-01T09:00:00Z',
      endDate: '2025-06-30T09:00:00Z',
    },
    comparisonPeriod: {
      startDate: '2025-05-01T09:00:00Z',
      endDate: '2025-05-31T09:00:00Z',
    },
    storagePath: '/reports/5d6d4439-6659-46c2-b646-92d110fa5a52/optimization/a1b2c3d4-e5f6-7890-abcd-1234567890ab/',
    status: 'success',
    createdAt: '2025-07-14T10:00:00Z',
    updatedAt: '2025-07-14T10:30:00Z',
  },
  {
    reportId: 'b2c3d4e5-f6a7-8901-bcda-2345678901bc',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    reportType: 'performance',
    reportPeriod: {
      startDate: '2025-07-01T09:00:00Z',
      endDate: '2025-07-31T09:00:00Z',
    },
    comparisonPeriod: {
      startDate: '2025-06-01T09:00:00Z',
      endDate: '2025-06-30T09:00:00Z',
    },
    storagePath: '/reports/78fec9c7-2141-4600-b7b1-ea5c78752b91/performance/b2c3d4e5-f6a7-8901-bcda-2345678901bc/',
    status: 'processing',
    createdAt: '2025-08-01T09:00:00Z',
    updatedAt: '2025-08-01T09:30:00Z',
  },
];

export default reports;
