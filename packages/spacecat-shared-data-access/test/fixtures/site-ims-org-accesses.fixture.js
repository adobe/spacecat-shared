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

// Org 0 (4854e75e) is intentionally not referenced in any FK column here.
// The Organization IT test removes organizations[0]; both org FK columns have ON DELETE RESTRICT,
// so any fixture row referencing org 0 would block that test.
// Site 1 belongs to Org 1; delegate = Org 2, target = Org 1 (site-owning org)
// Site 2 belongs to Org 2; delegate = Org 1, target = Org 2 (site-owning org)
const siteImsOrgAccesses = [
  {
    siteImsOrgAccessId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    targetOrganizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    productCode: 'LLMO',
    role: 'agency',
    grantedBy: 'ims:user123',
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
  {
    siteImsOrgAccessId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    siteId: '56a691db-d32e-4308-ac99-a21de0580557',
    organizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    targetOrganizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    productCode: 'ASO',
    role: 'collaborator',
    grantedBy: 'slack:U12345',
  },
];

export default siteImsOrgAccesses;
