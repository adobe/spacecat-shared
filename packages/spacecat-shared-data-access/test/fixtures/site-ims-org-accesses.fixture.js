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

const siteImsOrgAccesses = [
  {
    siteImsOrgAccessId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    organizationId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    targetOrganizationId: '71f85d21-14d2-4e6d-ae9a-b8860082fb6d',
    productCode: 'LLMO',
    role: 'agency',
    grantedBy: 'ims:user123',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  {
    siteImsOrgAccessId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    organizationId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    targetOrganizationId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    productCode: 'ASO',
    role: 'collaborator',
    grantedBy: 'slack:U12345',
  },
];

export default siteImsOrgAccesses;
