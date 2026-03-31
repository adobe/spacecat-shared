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

import {
  isIsoDate, isObject, isValidUrl, isValidUUID,
} from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import PlgOnboarding from './plg-onboarding.model.js';
import PlgOnboardingCollection from './plg-onboarding.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
*/

const schema = new SchemaBuilder(PlgOnboarding, PlgOnboardingCollection)
  .addAttribute('imsOrgId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => PlgOnboarding.IMS_ORG_ID_PATTERN.test(value),
  })
  .addAttribute('domain', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => PlgOnboarding.DOMAIN_PATTERN.test(value) && value.length <= 253,
  })
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('status', {
    type: Object.values(PlgOnboarding.STATUSES),
    required: true,
    default: PlgOnboarding.STATUSES.IN_PROGRESS,
  })
  .addAttribute('siteId', {
    type: 'string',
    required: false,
    validate: (value) => !value || isValidUUID(value),
  })
  .addAttribute('organizationId', {
    type: 'string',
    required: false,
    validate: (value) => !value || isValidUUID(value),
  })
  .addAttribute('steps', {
    type: 'map',
    properties: {
      orgResolved: { type: 'boolean' },
      rumVerified: { type: 'boolean' },
      siteCreated: { type: 'boolean' },
      siteResolved: { type: 'boolean' },
      configUpdated: { type: 'boolean' },
      auditsEnabled: { type: 'boolean' },
      redirectsQueued: { type: 'boolean' },
      entitlementCreated: { type: 'boolean' },
    },
  })
  .addAttribute('error', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('botBlocker', {
    type: 'map',
    properties: {
      type: { type: 'string' },
      ipsToAllowlist: { type: 'list', items: { type: 'string' } },
      userAgent: { type: 'string' },
    },
  })
  .addAttribute('waitlistReason', {
    type: 'string',
    required: false,
  })
  .addAttribute('completedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('siteTitle', {
    type: 'string',
    required: false,
  })
  .addAttribute('siteDescription', {
    type: 'string',
    required: false,
  })
  // Index: by imsOrgId (PK=imsOrgId, SK=updatedAt) → allByImsOrgId / findByImsOrgId
  .addIndex(
    { composite: ['imsOrgId'] },
    { composite: ['updatedAt'] },
  )
  // Index: by imsOrgId+domain (PK=imsOrgId, SK=domain) → findByImsOrgIdAndDomain
  .addIndex(
    { composite: ['imsOrgId'] },
    { composite: ['domain'] },
  )
  // Index: by status (PK=status, SK=updatedAt) → allByStatus
  .addIndex(
    { composite: ['status'] },
    { composite: ['updatedAt'] },
  )
  // Index: by baseURL (PK=baseURL, SK=status) → findByBaseURL
  .addIndex(
    { composite: ['baseURL'] },
    { composite: ['status'] },
  );

export default schema.build();
