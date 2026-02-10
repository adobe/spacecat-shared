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
  isNumber,
  isObject,
  isValidUrl,
  isString,
} from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import ScrapeJob from './scrape-job.model.js';
import ScrapeJobCollection from './scrape-job.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(ScrapeJob, ScrapeJobCollection)
  .withRecordExpiry(ScrapeJob.SCRAPE_JOB_EXPIRES_IN_DAYS)
  .addReference('has_many', 'ScrapeUrls')
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('processingType', {
    type: 'string',
    required: true,
    validate: (value) => isString(value),
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
    validate: (value) => !value || isObject(value),
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
  .addAttribute('abortInfo', {
    type: 'map',
    properties: {
      reason: { type: 'string' },
      details: {
        type: 'map',
        properties: {
          blockedUrlsCount: { type: 'number' },
          totalUrlsCount: { type: 'number' },
          blockedUrls: {
            type: 'list',
            items: {
              type: 'map',
              properties: {
                url: { type: 'string' },
                blockerType: { type: 'string' },
                httpStatus: { type: 'number' },
                confidence: { type: 'number' },
              },
            },
          },
          blockedUrlsSampled: { type: 'boolean' }, // Flag indicating URL truncation (400KB optimization)
          byBlockerType: { type: 'any' }, // dynamic keys unavoidable
          byHttpStatus: { type: 'any' }, // dynamic keys unavoidable
          auditType: { type: 'string' },
          siteId: { type: 'string' },
          siteUrl: { type: 'string' },
        },
      },
    },
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
  .addIndex(
    { composite: ['baseURL'] },
    { composite: ['processingType', 'startedAt'] },
  )
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
