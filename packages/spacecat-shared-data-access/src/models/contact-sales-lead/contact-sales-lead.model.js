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

import BaseModel from '../base/base.model.js';

/**
 * ContactSalesLead - A class representing a contact sales lead entity.
 * Tracks users who have expressed interest in purchasing via the "Contact Sales" flow.
 *
 * @class ContactSalesLead
 * @extends BaseModel
 */
class ContactSalesLead extends BaseModel {
  static ENTITY_NAME = 'ContactSalesLead';

  static STATUSES = {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    CLOSED: 'CLOSED',
  };
}

export default ContactSalesLead;
