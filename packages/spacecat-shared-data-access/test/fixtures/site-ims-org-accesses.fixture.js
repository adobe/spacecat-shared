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

// Site 0 belongs to Org 0; delegate = Org 1, target = Org 0 (site-owning org)
// Site 1 belongs to Org 1; delegate = Org 2, target = Org 1 (site-owning org)
const siteImsOrgAccesses = [
  {
    siteImsOrgAccessId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    organizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    targetOrganizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    productCode: 'LLMO',
    role: 'agency',
    grantedBy: 'ims:user123',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  {
    siteImsOrgAccessId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    targetOrganizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    productCode: 'ASO',
    role: 'collaborator',
    grantedBy: 'slack:U12345',
  },
];

export default siteImsOrgAccesses;
