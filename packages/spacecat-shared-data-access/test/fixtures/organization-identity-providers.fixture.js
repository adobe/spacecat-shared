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

const organizationIdentityProviders = [
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    organizationIdentityProviderId: '0d86eeb9-6052-4355-bf07-4ce91d6682fa',
    metadata: {
      domain: 'example.com',
      ssoEnabled: true,
    },
    provider: 'IMS',
    externalId: 'ims-org-123',
  },
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    organizationIdentityProviderId: '06c51b9d-728e-46f7-a447-86cb1de0bd12',
    metadata: {
      domain: 'example.com',
      ssoEnabled: false,
    },
    provider: 'GOOGLE',
    externalId: 'google-org-456',
  },
  {
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    organizationIdentityProviderId: '5864faf5-bcae-4028-8b96-ed331c375e69',
    metadata: {
      domain: 'another-example.com',
      ssoEnabled: true,
    },
    provider: 'MICROSOFT',
    externalId: 'microsoft-org-789',
  },
];

export default organizationIdentityProviders;
