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

const trialUsers = [
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    organizationIdentityProviderId: '0d86eeb9-6052-4355-bf07-4ce91d6682fa',
    trialUserId: '9b4f4013-63eb-44f7-9a3a-726930b923b5',
    externalUserId: 'ext-user-123',
    status: 'REGISTERED',
    provider: 'IMS',
    lastSeenAt: '2024-01-15T10:30:00.000Z',
    emailId: 'user1@example.com',
    firstName: 'John',
    lastName: 'Doe',
    metadata: {
      signupSource: 'email',
      preferences: {
        notifications: true,
      },
    },
  },
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    organizationIdentityProviderId: '06c51b9d-728e-46f7-a447-86cb1de0bd12',
    trialUserId: '8a8115fb-0514-49e4-99a6-e720218f0c6d',
    status: 'INVITED',
    emailId: 'user2@example.com',
    metadata: {},
  },
  {
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    organizationIdentityProviderId: '5864faf5-bcae-4028-8b96-ed331c375e69',
    trialUserId: 'c7faffcc-cc68-4f66-9020-fa71b67cce6d',
    externalUserId: 'ext-user-789',
    status: 'BLOCKED',
    provider: 'MICROSOFT',
    lastSeenAt: '2024-01-10T15:45:00.000Z',
    emailId: 'user3@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    metadata: {
      signupSource: 'microsoft',
      blockReason: 'suspicious_activity',
    },
  },
];

export default trialUsers;
