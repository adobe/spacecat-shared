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

const fixEntities = [
  {
    opportunityId: '742c49a7-d61f-4c62-9f7c-3207f520ed1e',
    status: 'PENDING',
    type: 'CONTENT_UPDATE',
    changeDetails: {
      description: 'Fixes a broken internal link issue',
      changes: [
        { page: 'page', oldValue: 'http://example.com/old', newValue: 'http://example.com/new' },
      ],
    },
    executedBy: 'developer123',
    executedAt: '2025-01-09T23:21:55.834Z',
    publishedAt: '2025-01-10T23:21:55.834Z',
  },
  {
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    status: 'DEPLOYED',
    type: 'REDIRECT_UPDATE',
    changeDetails: {
      description: 'Adds a new feature to the dashboard',
      changes: [
        { page: 'redirects', cell: 'A33:B33' },
      ],
    },
    executedBy: 'developer456',
    executedAt: '2025-01-09T23:21:55.834Z',
    publishedAt: '2025-02-09T23:21:55.834Z',
  },
  {
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    status: 'FAILED',
    type: 'METADATA_UPDATE',
    changeDetails: {
      description: 'Updates content for the homepage',
      changes: [
        {
          field: 'description', oldValue: 'Welcome!', newValue: 'Hello World!', page: 'homepage',
        },
      ],
    },
    executedBy: 'developer789',
    executedAt: '2025-02-09T23:21:55.834Z',
    publishedAt: '2025-03-09T23:21:55.834Z',
  },
  {
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    status: 'ROLLED_BACK',
    type: 'METADATA_UPDATE',
    changeDetails: {
      description: 'Updates content for the details page',
      changes: [
        {
          field: 'description', oldValue: 'Hello World!', newValue: 'Welcome!', page: 'details',
        },
      ],
    },
    executedBy: 'developer789',
    executedAt: '2025-02-09T23:21:55.834Z',
    publishedAt: '2025-03-09T23:21:55.834Z',
  },
  {
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    status: 'FAILED',
    type: 'METADATA_UPDATE',
    changeDetails: {
      description: 'Updates content for the listing page',
      changes: [
        {
          field: 'description', oldValue: 'Hello World!', newValue: 'Welcome!', page: 'listing',
        },
      ],
    },
    executedBy: 'developer789',
    executedAt: '2025-02-09T23:21:55.834Z',
    publishedAt: '2025-03-09T23:21:55.834Z',
  },
  {
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    status: 'FAILED',
    type: 'METADATA_UPDATE',
    changeDetails: {
      description: 'Updates content for the reports page',
      changes: [
        {
          field: 'description', oldValue: 'Hello World!', newValue: 'Welcome!', page: 'report',
        },
      ],
    },
    executedBy: 'developer789',
    executedAt: '2025-02-09T23:21:55.834Z',
    publishedAt: '2025-03-09T23:21:55.834Z',
  },
];

export default fixEntities;
