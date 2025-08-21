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

import { isIsoDate, isObject, isString } from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import TrialUser from './trial-user.model.js';
import TrialUserCollection from './trial-user.collection.js';

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
  .addReference('has_many', 'TrialUserActivity')
  .addAttribute('ExternalUserId', { //  IDP subject/identifier; no emails/names
    type: 'string',
    required: true,
    validate: (value) => isString(value),
  })
  .addAttribute('status', {
    type: Object.values(TrialUser.STATUSES),
    required: true,
  })
  .addAttribute('provider', {
    type: Object.values(TrialUser.PROVIDER_TYPES),
    required: true,
  })
  .addAttribute('lastSeenAt', {
    type: 'string',
    validate: (value) => isIsoDate(value),
  })
  .addAttribute('metadata', {
    type: 'any',
    validate: (value) => !value || isObject(value),
  })
  .addAllIndex(['OrganizationId'])
  .addIndex(
    { composite: ['provider'] },
    { composite: ['externalUserId'] },
  );

export default schema.build();
