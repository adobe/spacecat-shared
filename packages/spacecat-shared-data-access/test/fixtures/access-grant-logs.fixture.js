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

// siteId, organizationId, and targetOrganizationId are TEXT (not FK) — values survive entity deletion.
const accessGrantLogs = [
  {
    accessGrantLogId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    organizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    targetOrganizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    productCode: 'LLMO',
    action: 'grant',
    role: 'agency',
    performedBy: 'ims:user123',
  },
  {
    accessGrantLogId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    targetOrganizationId: '757ceb98-05c8-4e07-bb23-bc722115b2b0',
    productCode: 'ASO',
    action: 'revoke',
    role: 'collaborator',
    performedBy: 'system',
  },
];

export default accessGrantLogs;
