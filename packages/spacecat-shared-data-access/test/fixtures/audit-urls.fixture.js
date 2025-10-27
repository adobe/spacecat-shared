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

const auditUrls = [
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    url: 'https://example0.com/page-1',
    source: 'manual',
    audits: ['accessibility', 'broken-backlinks'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    url: 'https://example0.com/page-2',
    source: 'sitemap',
    audits: ['accessibility'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'system',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    url: 'https://example0.com/page-3',
    source: 'manual',
    audits: ['broken-backlinks', 'lhs-mobile'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91', // site 1
    url: 'https://example1.com/page-1',
    source: 'manual',
    audits: ['accessibility', 'lhs-mobile'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'admin@example.com',
  },
  {
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91', // site 1
    url: 'https://example1.com/page-2',
    source: 'sitemap',
    audits: [],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'system',
  },
  {
    siteId: '56a691db-d32e-4308-ac99-a21de0580557', // site 2
    url: 'https://example2.com/page-1',
    source: 'manual',
    audits: ['accessibility'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '56a691db-d32e-4308-ac99-a21de0580557', // site 2
    url: 'https://example2.com/assets/document.pdf',
    source: 'manual',
    audits: ['broken-backlinks'],
    createdAt: '2025-10-27T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
];

export default auditUrls;
