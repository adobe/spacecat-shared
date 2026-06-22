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

import { isValidUrl } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import Ticket from './ticket.model.js';
import TicketCollection from './ticket.collection.js';

const schema = new SchemaBuilder(Ticket, TicketCollection)
  .addReference('belongs_to', 'Organization')
  .addReference('belongs_to', 'TaskManagementConnection')
  // Optional FK — a ticket may not be linked to an opportunity in future flows.
  .addReference('belongs_to', 'Opportunity', ['ticketKey'], { required: false })
  .addAttribute('ticketId', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('ticketKey', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('ticketUrl', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('ticketStatus', {
    type: 'string',
    required: true,
    default: Ticket.DEFAULT_STATUS,
  });

export default schema.build();
