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

import { isIsoDate, isObject } from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import TrialUser from './trial-user.model.js';
import TrialUserCollection from './trial-user.collection.js';
import OrganizationIdentityProvider from '../organization-identity-provider/organization-identity-provider.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
*/

const schema = new SchemaBuilder(TrialUser, TrialUserCollection)
  // Reference to OrganizationIdentityProvider (many-to-one relationship)
  .addReference('belongs_to', 'OrganizationIdentityProvider')
  // Reference to Organization (many-to-one relationship)
  .addReference('belongs_to', 'Organization')
  // Reference to TrialUserActivity (one-to-many relationship)
  .addReference('has_many', 'TrialUserActivities')
  .addAttribute('externalUserId', {
    type: 'string',
    required: false,
  })
  .addAttribute('status', {
    type: Object.values(TrialUser.STATUSES),
    required: true,
  })
  .addAttribute('provider', {
    type: Object.values(OrganizationIdentityProvider.PROVIDER_TYPES),
    required: false,
  })
  .addAttribute('lastSeenAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('emailId', {
    type: 'string',
    required: true,
  })
  .addAttribute('firstName', {
    type: 'string',
    required: false,
  })
  .addAttribute('lastName', {
    type: 'string',
    required: false,
  })
  .addAttribute('metadata', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAllIndex(['emailId'])
  .addIndex(
    { composite: ['provider'] },
    { composite: ['externalUserId'] },
  );

export default schema.build();
