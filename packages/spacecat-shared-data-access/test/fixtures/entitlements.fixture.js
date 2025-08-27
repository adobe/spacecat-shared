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

const entitlements = [
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    entitlementId: '3fe5ca60-4850-431c-97b3-f88a80f07e9b',
    productCode: 'LLMO',
    tier: 'FREE_TRIAL',
    quotas: {
      llmo_trial_prompts: 100,
    },
  },
  {
    organizationId: '4854e75e-894b-4a74-92bf-d674abad1423',
    entitlementId: '48656b02-62cb-46c0-b271-ee99c940e89e',
    productCode: 'ASO',
    tier: 'PAID',
    quotas: {},
  },
  {
    organizationId: '5d42bdf8-b65d-4de8-b849-a4f28ebc93cd',
    entitlementId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    productCode: 'LLMO',
    tier: 'PAID',
    quotas: {},
  },
];

export default entitlements;
