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

import { isNonEmptyObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { validate as uuidValidate } from 'uuid';

import createSchema from '../base/base.schema.js';
import { ORIGINS, STATUSES } from './opportunity.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const OpportunitySchema = createSchema(
  'Opportunity',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      siteId: {
        type: 'string',
        required: true,
        validate: (value) => uuidValidate(value),
      },
      auditId: {
        type: 'string',
        validate: (value) => !value || uuidValidate(value),
      },
      runbook: {
        type: 'string',
        validate: (value) => !value || isValidUrl(value),
      },
      type: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      data: {
        type: 'any',
        validate: (value) => !value || isNonEmptyObject(value),
      },
      origin: {
        type: Object.values(ORIGINS),
        required: true,
      },
      title: {
        type: 'string',
        required: true,
      },
      description: {
        type: 'string',
      },
      status: {
        type: Object.values(STATUSES),
        required: true,
        default: 'NEW',
      },
      guidance: {
        type: 'any',
        validate: (value) => !value || isNonEmptyObject(value),
      },
      tags: {
        type: 'set',
        items: 'string',
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      bySiteId: {
        index: 'spacecat-data-opportunity-by-site',
        pk: {
          field: 'gsi1pk',
          composite: ['siteId'],
        },
        sk: {
          field: 'gsi1sk',
          composite: ['opportunityId'],
        },
      },
      bySiteIdAndStatus: {
        index: 'spacecat-data-opportunity-by-site-and-status',
        pk: {
          field: 'gsi2pk',
          composite: ['siteId', 'status'],
        },
        sk: {
          field: 'gsi2sk',
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
      has_many: [
        { target: 'Suggestions' },
      ],
      belongs_to: [
        { target: 'Site' },
        { target: 'Audit' },
      ],
    },
  },
);

export default OpportunitySchema;
