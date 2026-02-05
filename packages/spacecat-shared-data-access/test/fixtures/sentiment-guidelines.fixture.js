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

const sentimentGuidelines = [
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    guidelineId: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b',
    name: 'Professional Tone',
    instruction: 'Always maintain a professional and courteous tone in all communications.',
    audits: ['wikipedia-analysis', 'youtube-analysis'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    guidelineId: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c',
    name: 'Factual Accuracy',
    instruction: 'Ensure all claims are backed by verifiable data and sources.',
    audits: ['wikipedia-analysis'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'user@example.com',
  },
  {
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52', // site 0
    guidelineId: 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d',
    name: 'Brand Consistency',
    instruction: 'Use consistent brand terminology and messaging across all platforms.',
    audits: [],
    enabled: false,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'system',
  },
  {
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91', // site 1
    guidelineId: 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e',
    name: 'Customer Focus',
    instruction: 'Always prioritize customer needs and address their concerns promptly.',
    audits: ['youtube-analysis'],
    enabled: true,
    createdAt: '2025-01-20T12:00:00.000Z',
    createdBy: 'admin@example.com',
  },
];

export default sentimentGuidelines;
