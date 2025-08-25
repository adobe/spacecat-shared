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
import TrialUserActivity from './trial-user-activity.model.js';
import TrialUserActivityCollection from './trial-user-activity.collection.js';
import Entitlement from '../entitlement/entitlement.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
*/

const schema = new SchemaBuilder(TrialUserActivity, TrialUserActivityCollection)
  // Reference to OrganizationIdentityProvider (many-to-one relationship)
  .addReference('belongs_to', 'TrialUser')
  // Reference to Organization (many-to-one relationship)
  .addReference('belongs_to', 'Entitlement')
  // Reference to Site (many-to-one relationship)
  .addReference('belongs_to', 'Site')
  .addAttribute('type', {
    type: Object.values(TrialUserActivity.TYPES),
    required: true,
  })
  .addAttribute('details', {
    type: 'any',
  })
  .addAttribute('productCode', {
    type: Object.values(Entitlement.PRODUCT_CODES),
    required: true,
  })
  .addAllIndex(['trialUserId'])
  .addIndex(
    { composite: ['productCode', 'siteId', 'entitlementId'] },
    { composite: ['createdAt'] },
  );

export default schema.build();
