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
import SiteEnrollmentV2 from './site-enrollment-v2.model.js';
import SiteEnrollmentV2Collection from './site-enrollment-v2.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/

Version 2 Schema:
- Primary Key: entitlementId (partition key) + siteId (sort key)
- This allows efficient querying by entitlementId and supports composite key lookups
*/

const schema = new SchemaBuilder(SiteEnrollmentV2, SiteEnrollmentV2Collection)
  // Set custom primary key: entitlementId as partition key, siteId as sort key
  .withPrimaryPartitionKeys(['entitlementId'])
  .withPrimarySortKeys(['siteId'])
  // Reference to Site (many-to-one relationship)
  .addReference('belongs_to', 'Site')
  // Reference to Entitlement (many-to-one relationship)
  .addReference('belongs_to', 'Entitlement');

export default schema.build();
