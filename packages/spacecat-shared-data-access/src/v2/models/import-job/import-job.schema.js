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
  isInteger,
  isNumber,
  isObject,
  isValidUrl,
} from '@adobe/spacecat-shared-utils';

import createSchema from '../base/base.schema.js';
import { ImportJobStatus, ImportOptions } from './import-job.model.js';

const ImportOptionTypeValidator = {
  [ImportOptions.ENABLE_JAVASCRIPT]: (value) => {
    if (value !== true && value !== false) {
      throw new Error(`Invalid value for ${ImportOptions.ENABLE_JAVASCRIPT}: ${value}`);
    }
  },
  [ImportOptions.PAGE_LOAD_TIMEOUT]: (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid value for ${ImportOptions.PAGE_LOAD_TIMEOUT}: ${value}`);
    }
  },
};

const validateOptions = (options) => {
  if (!isObject(options)) {
    throw new Error(`Invalid options: ${options}`);
  }

  const invalidOptions = Object.keys(options).filter(
    (key) => !Object.values(ImportOptions)
      .some((value) => value.toLowerCase() === key.toLowerCase()),
  );

  if (invalidOptions.length > 0) {
    throw new Error(`Invalid options: ${invalidOptions}`);
  }

  // validate each option for it's expected data type
  Object.keys(options).forEach((key) => {
    if (ImportOptionTypeValidator[key]) {
      ImportOptionTypeValidator[key](options[key]);
    }
  });
};

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const ImportJobSchema = createSchema(
  'ImportJob',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      baseURL: {
        type: 'string',
        required: true,
        validate: (value) => isValidUrl(value),
      },
      duration: {
        type: 'number',
        validate: (value) => !value || isNumber(value),
      },
      endTime: {
        type: 'number',
      },
      failedCount: {
        type: 'number',
        validate: (value) => !value || isInteger(value),
      },
      hasCustomHeaders: {
        type: 'boolean',
        default: false,
      },
      hasCustomImportJs: {
        type: 'boolean',
        default: false,
      },
      hashedApiKey: {
        type: 'string',
        required: true,
      },
      importQueueId: {
        type: 'string',
      },
      initiatedBy: {
        type: 'string',
      },
      options: {
        type: 'any',
        validate: (value) => !value || validateOptions(value),
      },
      redirectCount: {
        type: 'number',
        validate: (value) => !value || isInteger(value),
      },
      status: {
        type: Object.values(ImportJobStatus),
        required: true,
      },
      startTime: {
        type: 'number',
        default: () => Date.now(),
      },
      successCount: {
        type: 'number',
        validate: (value) => !value || isInteger(value),
      },
      urlCount: {
        type: 'number',
        validate: (value) => !value || isInteger(value),
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
          composite: ['hashedImportJob'],
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
      has_many: [
        { target: 'ImportUrls' },
      ],
    },
  },
);

export default ImportJobSchema;
