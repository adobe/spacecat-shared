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

/* c8 ignore start */

import {
  isInteger,
  isIsoDate,
  isNonEmptyObject,
  isNumber,
  isObject,
  isValidUrl,
  isString,
  isArray,
} from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import ScrapeJob from './scrape-job.model.js';
import ScrapeJobCollection from './scrape-job.collection.js';

const ScrapeOptionTypeValidator = {
  [ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT]: (value) => {
    if (value !== true && value !== false) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT}: ${value}`);
    }
  },
  [ScrapeJob.ScrapeOptions.PAGE_LOAD_TIMEOUT]: (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.PAGE_LOAD_TIMEOUT}: ${value}`);
    }
  },
  [ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER]: (value) => {
    if (value !== true && value !== false) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER}: ${value}`);
    }
  },
  [ScrapeJob.ScrapeOptions.WAIT_FOR_SELECTOR]: (value) => {
    if (!isString(value)) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.WAIT_FOR_SELECTOR}: ${value}`);
    }
  },
  [ScrapeJob.ScrapeOptions.SECTION_LOAD_WAIT_TIME]: (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.SECTION_LOAD_WAIT_TIME}: ${value}`);
    }
  },
  [ScrapeJob.ScrapeOptions.SCREENSHOT_TYPES]: (value) => {
    if (!isArray(value)) {
      throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.SCREENSHOT_TYPES}: ${value}`);
    }
    value.forEach((item) => {
      if (!isString(item) || !Object.values(ScrapeJob.ScrapeScreenshotType).includes(item)) {
        throw new Error(`Invalid value for ${ScrapeJob.ScrapeOptions.SCREENSHOT_TYPES}: ${JSON.stringify(value)}`);
      }
    });
  },
};

const validateOptions = (options) => {
  if (!isObject(options)) {
    throw new Error(`Invalid options. Options must be an object. Received: ${JSON.stringify(options)}`);
  }

  if (!isNonEmptyObject(options)) {
    throw new Error('Invalid options. Options cannot be empty.');
  }

  const invalidOptions = Object.keys(options).filter(
    (key) => !Object.values(ScrapeJob.ScrapeOptions)
      .some((value) => value.toLowerCase() === key.toLowerCase()),
  );

  if (invalidOptions.length > 0) {
    throw new Error(`Invalid options: ${invalidOptions}`);
  }

  // validate each option for it's expected data type
  Object.keys(options).forEach((key) => {
    if (ScrapeOptionTypeValidator[key]) {
      ScrapeOptionTypeValidator[key](options[key]);
    }
  });

  return true;
};

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(ScrapeJob, ScrapeJobCollection)
  .addReference('has_many', 'ScrapeUrls')
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('processingType', {
    type: 'string',
    required: true,
    validate: (value) => !value || Object.values(ScrapeJob.ScrapeProcessingType).includes(value),
  })
  .addAttribute('duration', {
    type: 'number',
    default: 0,
    validate: (value) => !value || isNumber(value),
  })
  .addAttribute('endedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('failedCount', {
    type: 'number',
    default: 0,
    validate: (value) => !value || isInteger(value),
  })
  .addAttribute('scrapeQueueId', {
    type: 'string',
  })
  .addAttribute('options', {
    type: 'any',
    validate: (value) => !value || validateOptions(value),
  })
  .addAttribute('customHeaders', {
    type: 'any',
  })
  .addAttribute('redirectCount', {
    type: 'number',
    default: 0,
    validate: (value) => !value || isInteger(value),
  })
  .addAttribute('status', {
    type: Object.values(ScrapeJob.ScrapeJobStatus),
    required: true,
  })
  .addAttribute('startedAt', {
    type: 'string',
    required: true,
    readOnly: true,
    default: () => new Date().toISOString(),
    validate: (value) => isIsoDate(value),
  })
  .addAttribute('successCount', {
    type: 'number',
    default: 0,
    validate: (value) => !value || isInteger(value),
  })
  .addAttribute('urlCount', {
    type: 'number',
    default: 0,
    validate: (value) => !value || isInteger(value),
  })
  .addAttribute('results', {
    type: 'any',
  })
  .addAttribute('optEnableJavascript', {
    type: 'string',
    hidden: true,
    readOnly: true,
    watch: ['options'],
    set: (_, { options }) => (options[ScrapeJob.ScrapeOptions.ENABLE_JAVASCRIPT] ? 'T' : 'F'),
  })
  .addAttribute('optHideConsentBanner', {
    type: 'string',
    hidden: true,
    readOnly: true,
    watch: ['options'],
    set: (_, { options }) => (options[ScrapeJob.ScrapeOptions.HIDE_CONSENT_BANNER] ? 'T' : 'F'),
  })
  // access pattern: get all jobs sorted by startedAt
  .addAllIndex(['startedAt'])
  // access pattern: get all jobs for a given baseURL and processingType,
  // can be filtered by optEnableJavascript and optHideConsentBanner
  // are solrted by startedAt
  .addIndex(
    { composite: ['baseURL', 'processingType'] },
    { composite: ['optEnableJavascript', 'optHideConsentBanner', 'startedAt'] },
  )
  // access pattern: get all jobs for a given status, sorted by updatedAt
  .addIndex(
    { composite: ['status'] },
    { composite: ['updatedAt'] },
  );

export default schema.build();
