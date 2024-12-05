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

import { validate as uuidValidate } from 'uuid';

import { isValidUrl } from '@adobe/spacecat-shared-utils';
import createSchema from '../base/base.schema.js';
import { ImportUrlStatus } from '../import-job/import-job.model.js';
import { IMPORT_URL_EXPIRES_IN_DAYS } from './import-url.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const ImportUrlSchema = createSchema(
  'ImportUrl',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      importJobId: {
        type: 'string',
        required: true,
        validate: (value) => uuidValidate(value),
      },
      expiresAt: {
        type: 'number',
        required: true,
        default: () => {
          const date = new Date();
          date.setDate(date.getDate() + IMPORT_URL_EXPIRES_IN_DAYS);
          return date.getTime();
        },
      },
      file: {
        type: 'string',
      },
      path: {
        type: 'string',
      },
      reason: {
        type: 'string',
      },
      status: {
        type: Object.values(ImportUrlStatus),
        required: true,
      },
      url: {
        type: 'string',
        required: true,
        validate: (value) => isValidUrl(value),
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      all: {
        index: 'spacecat-data-api-key-all',
        pk: {
          field: 'gsi1pk',
          template: 'ALL_API_KEYS',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['hashedImportUrl'],
        },
      },
      byImsUserIdAndImsOrgId: {
        index: 'spacecat-data-api-key-by-ims-user-id-and-ims-org-id',
        pk: {
          field: 'gsi2pk',
          composite: ['imsUserId', 'imsOrgId'],
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
      belongs_to: [
        { target: 'ImportJob' },
      ],
    },
  },
);

export default ImportUrlSchema;
