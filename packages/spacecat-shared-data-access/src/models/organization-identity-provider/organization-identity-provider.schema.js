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

import { isObject } from '@adobe/spacecat-shared-utils';
import SchemaBuilder from '../base/schema.builder.js';
import OrganizationIdentityProvider from './organization-identity-provider.model.js';
import OrganizationIdentityProviderCollection from './organization-identity-provider.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(
  OrganizationIdentityProvider,
  OrganizationIdentityProviderCollection,
)
  // Reference to Organization (many-to-one relationship)
  .addReference('belongs_to', 'Organization')
  // Reference to TrialUsers (one-to-many relationship)
  .addReference('has_many', 'TrialUsers')
  .addAttribute('metadata', {
    type: 'any',
    required: false,
    validate: (value) => !value || isObject(value),
  })
  .addAttribute('provider', {
    type: Object.values(OrganizationIdentityProvider.PROVIDER_TYPES),
    required: true,
  })
  .addAttribute('externalId', {
    type: 'string',
    required: true,
  })
  .addIndex(
    { composite: ['provider'] },
    { composite: ['externalId'] },
  )
  .addAllIndex(['organizationId']);

export default schema.build();
