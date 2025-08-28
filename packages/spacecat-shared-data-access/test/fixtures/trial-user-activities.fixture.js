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

const trialUserActivities = [
  {
    trialUserId: '9b4f4013-63eb-44f7-9a3a-726930b923b5',
    trialUserActivityId: 'abfa40c3-e8da-43dd-bd05-a2e1715d4b6e',
    entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    siteId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    type: 'SIGN_UP',
    details: {
      signupMethod: 'email',
      referrer: 'google_search',
    },
    productCode: 'LLMO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    trialUserId: '9b4f4013-63eb-44f7-9a3a-726930b923b5',
    trialUserActivityId: 'fdfb4d68-1df4-45c1-9712-9ddeadb4caca',
    entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    type: 'CREATE_SITE',
    productCode: 'ASO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    trialUserId: '9b4f4013-63eb-44f7-9a3a-726930b923b5',
    trialUserActivityId: '97b453ad-a5d6-486f-96a0-8872b3fb11bc',
    entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    siteId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    type: 'RUN_AUDIT',
    details: {},
    productCode: 'LLMO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    trialUserId: 'c7faffcc-cc68-4f66-9020-fa71b67cce6d',
    trialUserActivityId: '04f7a7d5-81ea-4adc-bff3-e0c4e943ec53',
    entitlementId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    siteId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    type: 'PROMPT_RUN',
    details: {
      promptType: 'seo_optimization',
      tokensUsed: 150,
      responseLength: 500,
    },
    productCode: 'LLMO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    trialUserId: 'c7faffcc-cc68-4f66-9020-fa71b67cce6d',
    trialUserActivityId: '0948ef44-982c-407d-aa41-de4e7752ae68',
    entitlementId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    siteId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    type: 'DOWNLOAD',
    details: {
      downloadType: 'audit_report',
      format: 'pdf',
      fileSize: '2.5MB',
    },
    productCode: 'ASO',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

export default trialUserActivities;
