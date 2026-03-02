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

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import Consumer from './consumer.model.js';
import ConsumerCollection from './consumer.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(Consumer, ConsumerCollection)
  .addAttribute('clientId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('technicalAccountId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => Consumer.TECHNICAL_ACCOUNT_ID_REGEX.test(value),
  })
  .addAttribute('consumerName', {
    type: 'string',
    required: true,
  })
  .addAttribute('status', {
    type: Object.values(Consumer.STATUS),
    required: true,
  })
  .addAttribute('capabilities', {
    type: 'list',
    required: true,
    items: {
      type: 'string',
    },
  })
  .addAttribute('revokedAt', {
    type: 'string',
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('imsOrgId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => Consumer.IMS_ORG_ID_REGEX.test(value),
  })
  .addAllIndex(['imsOrgId'])
  .addAllIndex(['clientId', 'imsOrgId']);

export default schema.build();
