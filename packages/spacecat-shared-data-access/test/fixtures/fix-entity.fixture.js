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

const fixEntityFixtures = [
  {
    opportunityId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    status: 'PENDING',
    type: 'CONTENT_UPDATE',
    changeDetails: {
      description: 'Fixes a broken internal link issue',
      changes: [
        { page: 'page', oldValue: 'http://example.com/old', newValue: 'http://example.com/new' },
      ],
    },
    executedBy: 'developer123',
    executedAt: '2025-01-01T12:00:00Z',
    publishedAt: '2025-01-02T12:00:00Z',
  },
  {
    opportunityId: '1c2f3e4d-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
    status: 'DEPLOYED',
    type: 'REDIRECT_UPDATE',
    changeDetails: {
      description: 'Adds a new feature to the dashboard',
      changes: [
        { page: 'redirects', cell: 'A33:B33' },
      ],
    },
    executedBy: 'developer456',
    executedAt: '2025-02-01T10:00:00Z',
    publishedAt: '2025-02-02T10:00:00Z',
  },
  {
    opportunityId: '2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q',
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
    executedAt: '2025-03-01T08:00:00Z',
    publishedAt: null,
  },
];

export default fixEntityFixtures;
