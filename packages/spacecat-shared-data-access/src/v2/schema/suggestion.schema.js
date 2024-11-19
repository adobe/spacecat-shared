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

import { v4 as uuid } from 'uuid';
import { isNonEmptyObject } from '@adobe/spacecat-shared-utils';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const SuggestionSchema = {
  model: {
    entity: 'Suggestion',
    version: '1',
    service: 'SpaceCat',
  },
  attributes: {
    suggestionId: {
      type: 'string',
      required: true,
      readOnly: true,
      // https://electrodb.dev/en/modeling/attributes/#default
      default: () => uuid(),
      // https://electrodb.dev/en/modeling/attributes/#attribute-validation
      validation: (value) => !uuid.validate(value),
    },
    opportunityId: {
      type: 'string',
      required: true,
      validation: (value) => !uuid.validate(value),
    },
    type: {
      type: ['CODE_CHANGE', 'CONTENT_UPDATE', 'REDIRECT_UPDATE', 'METADATA_UPDATE'],
      required: true,
      readOnly: true,
    },
    rank: {
      type: 'number',
      required: true,
    },
    data: {
      type: 'any',
      required: true,
      validation: (value) => !isNonEmptyObject(value),
    },
    kpiDeltas: {
      type: 'map',
      properties: {},
      required: false,
      validation: (value) => !isNonEmptyObject(value),
    },
    status: {
      type: ['NEW', 'APPROVED', 'SKIPPED', 'FIXED', 'ERROR'],
      required: true,
      default: () => 'NEW',
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
        composite: ['suggestionId'],
      },
      sk: {
        field: 'sk',
        composite: [],
      },
    },
    byOpportunityId: {
      index: 'spacecat-data-suggestion-by-opportunity',
      pk: {
        field: 'gsi1pk',
        composite: ['opportunityId'],
      },
      sk: {
        field: 'gsi1sk',
        composite: ['suggestionId'],
      },
    },
    byOpportunityAndStatus: {
      index: 'spacecat-data-suggestion-by-opportunity-and-status',
      pk: {
        field: 'gsi2pk',
        composite: ['opportunityId'],
      },
      sk: {
        field: 'gsi2sk',
        composite: ['status', 'rank'],
      },
    },
  },
};

export default SuggestionSchema;
