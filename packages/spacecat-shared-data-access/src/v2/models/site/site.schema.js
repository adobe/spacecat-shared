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

import { validate as uuidValidate } from 'uuid';

import { Config, DEFAULT_CONFIG, validateConfiguration } from '../../../models/site/config.js';
import createSchema from '../base/base.schema.js';
import {
  DEFAULT_DELIVERY_TYPE,
  DEFAULT_ORGANIZATION_ID,
  DELIVERY_TYPES,
} from './site.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const SiteSchema = createSchema(
  'Site',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      organizationId: {
        type: 'string',
        required: true,
        default: DEFAULT_ORGANIZATION_ID,
        validate: (value) => uuidValidate(value),
      },
      baseURL: {
        type: 'string',
        required: true,
        validate: (value) => isValidUrl(value),
      },
      gitHubURL: {
        type: 'string',
        validate: (value) => !value || isValidUrl(value),
      },
      deliveryType: {
        type: Object.values(DELIVERY_TYPES),
        default: DEFAULT_DELIVERY_TYPE,
        required: true,
      },
      config: {
        type: 'any',
        required: true,
        default: DEFAULT_CONFIG,
        validate: (value) => isNonEmptyObject(validateConfiguration(value)),
        get: (value) => Config(value),
      },
      hlxConfig: {
        type: 'any',
        default: {},
        validate: (value) => isObject(value),
      },
      isLive: {
        type: 'boolean',
        required: true,
        default: false,
      },
      isLiveToggledAt: {
        type: 'string',
        watch: ['isLive'],
        set: () => new Date().toISOString(),
        validate: (value) => !value || isIsoDate(value),
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      all: {
        index: 'spacecat-data-site-all',
        pk: {
          field: 'gsi1pk',
          template: 'ALL_SITES',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['baseURL'],
        },
      },
      byDeliveryType: {
        index: 'spacecat-data-site-by-delivery-type',
        pk: {
          field: 'gsi2pk',
          composite: ['deliveryType'],
        },
        sk: {
          field: 'gsi2sk',
          composite: ['updatedAt'],
        },
      },
      byOrganizationId: {
        index: 'spacecat-data-site-by-organization-id',
        pk: {
          field: 'gsi3pk',
          composite: ['organizationId'],
        },
        sk: {
          field: 'gsi3sk',
          composite: ['updatedAt'],
        },
      },
    },
    /**
     * References to other entities. This is not part of the standard ElectroDB schema, but is used
     * to define relationships between entities in our data layer API.
     * @type {{
     * [belongs_to]: [{target: string}],
     * [has_many]: [{target: string}],
     * [has_one]: [{target: string}]
     * }}
     */
    references: {
      belongs_to: [
        { target: 'Organization' },
      ],
      has_many: [
        { target: 'Audits' },
        { target: 'Experiments' },
        { target: 'KeyEvents' },
        { target: 'Opportunities' },
        { target: 'SiteCandidates' },
        { target: 'SiteTopPages' },
      ],
    },
  },
);

export default SiteSchema;
