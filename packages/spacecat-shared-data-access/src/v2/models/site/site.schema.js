/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* c8 ignore start */

import {
  isIsoDate,
  isNonEmptyObject,
  isObject,
  isValidUrl,
} from '@adobe/spacecat-shared-utils';

import { Config, DEFAULT_CONFIG, validateConfiguration } from '../../../models/site/config.js';
import SchemaBuilder from '../base/schema.builder.js';

import {
  DEFAULT_DELIVERY_TYPE,
  DELIVERY_TYPES,
} from './site.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder('Site', 1, 'SpaceCat')
  // this will add an attribute 'organizationId' as well as an index 'byOrganizationId'
  .addReference('belongs_to', 'Organization')
  // has_many references do not add attributes or indexes
  .addReference('has_many', 'Audits')
  .addReference('has_many', 'Experiments')
  .addReference('has_many', 'KeyEvents')
  .addReference('has_many', 'Opportunities')
  .addReference('has_many', 'SiteCandidates')
  .addReference('has_many', 'SiteTopPages')
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('gitHubURL', {
    type: 'string',
    validate: (value) => !value || isValidUrl(value),
  })
  .addAttribute('deliveryType', {
    type: Object.values(DELIVERY_TYPES),
    default: DEFAULT_DELIVERY_TYPE,
    required: true,
  })
  .addAttribute('config', {
    type: 'any',
    required: true,
    default: DEFAULT_CONFIG,
    validate: (value) => isNonEmptyObject(validateConfiguration(value)),
    get: (value) => Config(value),
  })
  .addAttribute('hlxConfig', {
    type: 'any',
    default: {},
    validate: (value) => isObject(value),
  })
  .addAttribute('isLive', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('isLiveToggledAt', {
    type: 'string',
    watch: ['isLive'],
    set: () => new Date().toISOString(),
    validate: (value) => !value || isIsoDate(value),
  })
  .addAllIndexWithComposite('baseURL')
  .addIndex(
    'byDeliveryType',
    { composite: ['deliveryType'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
