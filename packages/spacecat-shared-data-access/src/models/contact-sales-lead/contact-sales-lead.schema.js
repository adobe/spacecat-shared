/*
 * Copyright 2026 Adobe. All rights reserved.
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
import ContactSalesLead from './contact-sales-lead.model.js';
import ContactSalesLeadCollection from './contact-sales-lead.collection.js';

const schema = new SchemaBuilder(ContactSalesLead, ContactSalesLeadCollection)
  .addReference('belongs_to', 'Organization')
  .addReference('belongs_to', 'Site', [], { required: false })
  .addAttribute('name', {
    type: 'string',
    required: true,
  })
  .addAttribute('email', {
    type: 'string',
    required: true,
  })
  .addAttribute('domain', {
    type: 'string',
  })
  .addAttribute('notes', {
    type: 'string',
  })
  .addAttribute('status', {
    type: Object.values(ContactSalesLead.STATUSES),
    required: true,
    default: ContactSalesLead.STATUSES.NEW,
  });

export default schema.build();
