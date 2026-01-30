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

const sentimentTopics = [
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    topicId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Brand Voice',
    description: 'Guidelines for maintaining consistent brand voice',
    subPrompts: ['Use professional tone', 'Avoid jargon'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    topicId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    name: 'Customer Engagement',
    description: 'Topics related to customer engagement',
    subPrompts: ['Be responsive', 'Show empathy'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    topicId: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    name: 'Technical Accuracy',
    description: 'Ensuring technical content is accurate',
    subPrompts: [],
    enabled: false,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'system',
  },
  {
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91', // site 1
    topicId: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
    name: 'Product Information',
    description: 'Guidelines for product-related content',
    subPrompts: ['Include specifications', 'List features'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'admin@example.com',
  },
];

export default sentimentTopics;
