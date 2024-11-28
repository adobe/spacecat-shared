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

const opportunities = [
  {
    siteId: '4af16428-d0df-4987-9975-dc1ce6e9e217',
    auditId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
    opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
    title: 'Opportunity 0',
    description: 'Description 0',
    runbook: 'https://example0.com',
    type: 'broken-backlinks',
    origin: 'AI',
    guidance: {
      foo: 'bar-0',
    },
    status: 'NEW',
    data: {
      brokenLinks: [
        'foo-0',
      ],
    },
  },
  {
    siteId: '4af16428-d0df-4987-9975-dc1ce6e9e217',
    auditId: '742c49a7-d61f-4c62-9f7c-3207f520ed1e',
    opportunityId: '742c49a7-d61f-4c62-9f7c-3207f520ed1e',
    title: 'Opportunity 1',
    description: 'Description 1',
    runbook: 'https://example1.com',
    type: 'broken-internal-links',
    origin: 'AI',
    guidance: {
      foo: 'bar-1',
    },
    status: 'IN_PROGRESS',
    data: {
      brokenInternalLinks: [
        'bar-1',
      ],
    },
  },
  {
    siteId: '4af16428-d0df-4987-9975-dc1ce6e9e217',
    auditId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    opportunityId: 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4',
    title: 'Opportunity 2',
    description: 'Description 2',
    runbook: 'https://example2.com',
    type: 'broken-backlinks',
    origin: 'AI',
    guidance: {
      foo: 'bar-2',
    },
    status: 'NEW',
    data: {
      brokenLinks: [
        'foo-2',
      ],
    },
  },
];

export default opportunities;
