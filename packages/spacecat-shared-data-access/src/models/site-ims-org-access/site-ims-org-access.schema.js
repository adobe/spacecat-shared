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

import { isIsoDate, isValidUUID } from '@adobe/spacecat-shared-utils';
import { Entitlement } from '../entitlement/index.js';
import SchemaBuilder from '../base/schema.builder.js';
import SiteImsOrgAccess from './site-ims-org-access.model.js';
import SiteImsOrgAccessCollection from './site-ims-org-access.collection.js';

const GRANTED_BY_PATTERN = /^(ims:\S+|slack:\S+|system)$/;

const schema = new SchemaBuilder(SiteImsOrgAccess, SiteImsOrgAccessCollection)
  .addReference('belongs_to', 'Site')
  .addReference('belongs_to', 'Organization') // the agency/delegate org receiving access
  // targetOrganizationId is addAttribute (not belongs_to) because SchemaBuilder's
  // belongs_to uses the referenced model name as the FK column prefix (organization_id).
  // We already have belongs_to Organization for the delegate org, so a second belongs_to
  // would conflict. addAttribute with UUID validation achieves the same FK semantics
  // without the naming collision. readOnly: true prevents the setter from being generated
  // since the target org is part of the grant's identity — a different target means a
  // different grant.
  .addAttribute('targetOrganizationId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (v) => isValidUUID(v),
  })
  // organizationId (delegate org, from belongs_to) and siteId are also part of the grant's
  // identity and are readOnly by virtue of their belongs_to FK nature.
  .addAttribute('productCode', {
    type: Object.values(Entitlement.PRODUCT_CODES),
    required: true,
    readOnly: true,
  })
  .addAttribute('role', {
    type: Object.values(SiteImsOrgAccess.DELEGATION_ROLES),
    required: true,
    default: SiteImsOrgAccess.DELEGATION_ROLES.AGENCY,
  })
  .addAttribute('grantedBy', {
    type: 'string',
    required: false,
    validate: (v) => !v || GRANTED_BY_PATTERN.test(v),
  })
  .addAttribute('expiresAt', {
    type: 'string',
    required: false,
    validate: (v) => !v || isIsoDate(v),
  })
  .addAllIndex(['organizationId'])
  // Index for "show all delegations granted to org Z across all sites" admin query
  .addAllIndex(['targetOrganizationId']);

export default schema.build();
