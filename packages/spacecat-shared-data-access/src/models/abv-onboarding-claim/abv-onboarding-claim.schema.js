/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import SchemaBuilder from '../base/schema.builder.js';
import AbvOnboardingClaim from './abv-onboarding-claim.model.js';
import AbvOnboardingClaimCollection from './abv-onboarding-claim.collection.js';

/*
 * AbvOnboardingClaim: abv_onboarding_claims table (mutated only via the
 * wrpc_acquire_abv_claim / wrpc_finalize_abv_claim / wrpc_invalidate_abv_claim
 * SECURITY DEFINER RPCs -- there is no direct PostgREST CRUD surface). The
 * natural key is (ims_org_id, base_url); `id` is a surrogate UUIDv7.
 */

const STATUSES = ['IN_PROGRESS', 'COMPLETED', 'FAILED', 'CONFLICT'];

const schema = new SchemaBuilder(AbvOnboardingClaim, AbvOnboardingClaimCollection)
  .addAttribute('imsOrgId', {
    type: 'string', required: true, readOnly: true, postgrestField: 'ims_org_id',
  })
  .addAttribute('baseUrl', {
    type: 'string', required: true, readOnly: true, postgrestField: 'base_url',
  })
  .addAttribute('status', {
    type: STATUSES, required: true, readOnly: true, postgrestField: 'status',
  })
  .addAttribute('factId', {
    type: 'string', required: false, readOnly: true, postgrestField: 'fact_id',
  })
  .addAttribute('holder', {
    type: 'string', required: false, readOnly: true, postgrestField: 'holder',
  })
  .addAttribute('leaseExpiresAt', {
    type: 'string', required: false, readOnly: true, postgrestField: 'lease_expires_at',
  })
  .addAttribute('artifacts', {
    type: 'map',
    required: false,
    readOnly: true,
    properties: {
      siteId: { type: 'string' },
      entitlementId: { type: 'string' },
    },
  })
  .addAttribute('reason', {
    type: 'string', required: false, readOnly: true, postgrestField: 'reason',
  });

export default schema.build();
