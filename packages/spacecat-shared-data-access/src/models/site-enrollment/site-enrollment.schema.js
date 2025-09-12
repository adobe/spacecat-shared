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

import Joi from 'joi';

import SchemaBuilder from '../base/schema.builder.js';
import SiteEnrollment from './site-enrollment.model.js';
import SiteEnrollmentCollection from './site-enrollment.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(SiteEnrollment, SiteEnrollmentCollection)
  // Reference to Site (many-to-one relationship)
  .addReference('belongs_to', 'Site')
  // Reference to Entitlement (many-to-one relationship)
  .addReference('belongs_to', 'Entitlement')
  .addAttribute('config', {
    type: 'any',
    required: false,
    default: {},
    validate: (value) => {
      if (!value) return true;
      // Use Joi to validate dynamic string key-value pairs
      const schemaToValidate = Joi.object().pattern(Joi.string(), Joi.string());
      const { error } = schemaToValidate.validate(value);
      return !error;
    },
  });

export default schema.build();
