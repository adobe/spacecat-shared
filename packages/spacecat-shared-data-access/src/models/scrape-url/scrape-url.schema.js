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

import { isValidUrl } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import ScrapeUrl from './scrape-url.model.js';
import ScrapeUrlCollection from './scrape-url.collection.js';
import { ScrapeJob } from '../scrape-job/index.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(ScrapeUrl, ScrapeUrlCollection)
  .withRecordExpiry(ScrapeUrl.SCRAPE_URL_EXPIRES_IN_DAYS)
  .addReference('belongs_to', 'ScrapeJob', ['status'])
  .addAttribute('file', {
    type: 'string',
  })
  .addAttribute('path', {
    type: 'string',
  })
  .addAttribute('reason', {
    type: 'string',
  })
  .addAttribute('status', {
    type: Object.values(ScrapeJob.ScrapeUrlStatus),
    required: true,
  })
  .addAttribute('url', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  });

export default schema.build();
