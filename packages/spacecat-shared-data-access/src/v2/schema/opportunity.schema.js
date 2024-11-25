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

import { v4 as uuid } from 'uuid';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const OpportunitySchema = {
  model: {
    entity: 'Opportunity',
    version: '1',
    service: 'SpaceCat',
  },
  attributes: {
    opportunityId: {
      type: 'string',
      required: true,
      readOnly: true,
      // https://electrodb.dev/en/modeling/attributes/#default
      default: () => uuid(),
      // https://electrodb.dev/en/modeling/attributes/#attribute-validation
      validation: (value) => !uuid.validate(value),
    },
    siteId: {
      type: 'string',
      required: true,
      validation: (value) => !uuid.validate(value),
    },
    auditId: {
      type: 'string',
      required: true,
      validation: (value) => !uuid.validate(value),
    },
    runbook: {
      type: 'string',
      validation: (value) => !isValidUrl(value),
    },
    type: {
      type: 'string',
      readOnly: true,
      required: true,
    },
    data: {
      type: 'any',
      required: false,
      validation: (value) => !isNonEmptyObject(value),
    },
    origin: {
      type: ['ESS_OPS', 'AI', 'AUTOMATION'],
      required: true,
    },
    title: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      required: false,
    },
    status: {
      type: ['NEW', 'IN_PROGRESS', 'IGNORED', 'RESOLVED'],
      required: true,
      default: () => 'NEW',
    },
    guidance: {
      type: 'any',
      required: false,
      validation: (value) => !isNonEmptyObject(value),
    },
    tags: {
      type: 'set',
      items: 'string',
      required: false,
    },
    createdAt: {
      type: 'number',
      readOnly: true,
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
    updatedAt: {
      type: 'number',
      watch: '*',
      required: true,
      default: () => Date.now(),
      set: () => Date.now(),
    },
    // todo: add createdBy, updatedBy and auto-set from auth context
  },
  indexes: {
    primary: { // operates on the main table, no 'index' property
      pk: {
        field: 'pk',
        composite: ['opportunityId'],
      },
      sk: {
        field: 'sk',
        composite: [],
      },
    },
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
};

/**
 * References to other entities. This is not part of the standard ElectroDB schema, but is used
 * to define relationships between entities in our data layer API.
 * @type {{belongs_to: [{type: string, target: string}]}}
 */
OpportunitySchema.references = {
  has_many: [
    { type: 'has_many', target: 'Suggestions' },
  ],
  belongs_to: [
    { type: 'belongs_to', target: 'Site' },
    { type: 'belongs_to', target: 'Audit' },
  ],
};

export default OpportunitySchema;
