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

import { isValidUUID } from '@adobe/spacecat-shared-utils';
import { Entitlement } from '../entitlement/index.js';
import SchemaBuilder from '../base/schema.builder.js';
import AccessGrantLog from './access-grant-log.model.js';
import AccessGrantLogCollection from './access-grant-log.collection.js';

const PERFORMED_BY_PATTERN = /^(ims:\S+|slack:\S+|system)$/;

const schema = new SchemaBuilder(AccessGrantLog, AccessGrantLogCollection)
  .allowUpdates(false)
  .allowRemove(false)
  // siteId and organizationId are plain addAttribute (not belongs_to) because the
  // DB columns are TEXT, not FK. Audit logs must preserve UUIDs after entity deletion.
  .addAttribute('siteId', {
    type: 'string',
    required: true,
    validate: (v) => isValidUUID(v),
  })
  .addAttribute('organizationId', {
    type: 'string',
    required: true,
    validate: (v) => isValidUUID(v),
  })
  .addAttribute('productCode', {
    type: Object.values(Entitlement.PRODUCT_CODES),
    required: true,
  })
  .addAttribute('action', {
    type: Object.values(AccessGrantLog.GRANT_ACTIONS),
    required: true,
  })
  .addAttribute('role', {
    type: 'string',
    required: true,
  })
  .addAttribute('performedBy', {
    type: 'string',
    required: true,
    validate: (v) => PERFORMED_BY_PATTERN.test(v),
  })
  .addAllIndex(['organizationId']);

export default schema.build();
