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

import SchemaBuilder from '../base/schema.builder.js';
import Token from './token.model.js';
import TokenCollection from './token.collection.js';

/*
 * Token entity: per-site, per-tokenType (opportunity type), per-cycle token allocation.
 * PK = #<siteId>#<tokenType>, SK = #<cycle>
 * Data access: findById(siteId, tokenType, cycle), allBySiteIdAndTokenType(siteId, tokenType)
 */

const schema = new SchemaBuilder(Token, TokenCollection)
  .withPrimaryPartitionKeys(['siteId', 'tokenType'])
  .withPrimarySortKeys(['cycle'])
  .withUpsertable(true)
  .addReference('belongs_to', 'Site', ['tokenType', 'cycle'])
  .addAttribute('tokenType', {
    type: 'string',
    required: true,
  })
  .addAttribute('cycle', {
    type: 'string',
    required: true,
  })
  .addAttribute('total', {
    type: 'number',
    required: true,
  })
  .addAttribute('used', {
    type: 'number',
    required: true,
    default: 0,
  });

export default schema.build();
