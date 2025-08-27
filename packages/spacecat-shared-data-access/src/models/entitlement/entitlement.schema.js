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

import SchemaBuilder from '../base/schema.builder.js';
import Entitlement from './entitlement.model.js';
import EntitlementCollection from './entitlement.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(Entitlement, EntitlementCollection)
  // Reference to Organization (many-to-one relationship)
  .addReference('belongs_to', 'Organization')
  // Reference to SiteEnrollments (one-to-many relationship)
  .addReference('has_many', 'SiteEnrollments')
  .addReference('has_many', 'TrialUserActivities')
  .addAttribute('productCode', {
    type: Object.values(Entitlement.PRODUCT_CODES),
    required: true,
  })
  .addAttribute('tier', {
    type: Object.values(Entitlement.TIERS),
    required: true,
  })
  .addAttribute('quotas', {
    type: 'map',
    required: false,
    properties: {
      llmo_trial_prompts: { type: 'number' },
    },
  })
  .addIndex(
    { composite: ['organizationId'] },
    { composite: ['productCode'] },
  );

export default schema.build();
