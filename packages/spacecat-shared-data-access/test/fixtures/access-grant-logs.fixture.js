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

const accessGrantLogs = [
  {
    accessGrantLogId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    siteId: '5d6d4439-6659-46c2-b646-92d110fa5a52',
    organizationId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    productCode: 'LLMO',
    action: 'grant',
    role: 'agency',
    performedBy: 'ims:user123',
  },
  {
    accessGrantLogId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    siteId: '78fec9c7-2141-4600-b7b1-ea5c78752b91',
    organizationId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    productCode: 'ASO',
    action: 'revoke',
    role: 'collaborator',
    performedBy: 'system',
  },
];

export default accessGrantLogs;
