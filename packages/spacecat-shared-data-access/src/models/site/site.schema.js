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

import {
  isIsoDate,
  isNonEmptyObject,
  isObject,
  isValidUrl,
} from '@adobe/spacecat-shared-utils';

import { Config, DEFAULT_CONFIG, validateConfiguration } from './config.js';
import SchemaBuilder from '../base/schema.builder.js';

import Site, { computeExternalIds } from './site.model.js';
import SiteCollection from './site.collection.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(Site, SiteCollection)
  // this will add an attribute 'organizationId' as well as an index 'byOrganizationId'
  .addReference('belongs_to', 'Organization')
  // has_many references do not add attributes or indexes
  .addReference('has_many', 'Audits')
  .addReference('has_many', 'Experiments')
  .addReference('has_many', 'KeyEvents')
  .addReference('has_many', 'LatestAudits', ['auditType'])
  .addReference('has_one', 'LatestAudit', ['auditType'], { required: false })
  .addReference('has_many', 'Opportunities')
  .addReference('has_many', 'SiteCandidates')
  .addReference('has_many', 'SiteTopForms')
  .addReference('has_many', 'SiteTopPages')
  .addReference('has_many', 'PageIntents')
  .addAttribute('baseURL', {
    type: 'string',
    required: true,
    validate: (value) => isValidUrl(value),
  })
  .addAttribute('name', {
    type: 'string',
  })
  .addAttribute('config', {
    type: 'any',
    required: true,
    default: DEFAULT_CONFIG,
    validate: (value) => isNonEmptyObject(validateConfiguration(value)),
    get: (value) => Config(value),
  })
  .addAttribute('deliveryType', {
    type: Object.values(Site.DELIVERY_TYPES),
    default: Site.DEFAULT_DELIVERY_TYPE,
    required: true,
  })
  .addAttribute('authoringType', {
    type: Object.values(Site.AUTHORING_TYPES),
    required: false,
  })
  .addAttribute('gitHubURL', {
    type: 'string',
    validate: (value) => !value || isValidUrl(value),
  })
  .addAttribute('deliveryConfig', {
    type: 'any',
    default: {},
    validate: (value) => isObject(value),
    properties: {
      programId: { type: 'string' },
      environmentId: { type: 'string' },
      authorURL: { type: 'string', validate: (value) => isValidUrl(value) },
      siteId: { type: 'string' },
    },
  })
  .addAttribute('hlxConfig', {
    type: 'any',
    default: {},
    validate: (value) => isObject(value),
  })
  .addAttribute('isSandbox', {
    type: 'boolean',
    default: false,
  })
  .addAttribute('isLive', {
    type: 'boolean',
    required: true,
    default: false,
  })
  .addAttribute('isLiveToggledAt', {
    type: 'string',
    watch: ['isLive'],
    set: () => new Date().toISOString(),
    validate: (value) => !value || isIsoDate(value),
  })
  .addAttribute('externalOwnerId', {
    type: 'string',
    hidden: true,
    readOnly: true,
    watch: ['authoringType', 'hlxConfig', 'deliveryConfig'],
    set: (_, attrs) => computeExternalIds(attrs, Site.AUTHORING_TYPES).externalOwnerId,
  })
  .addAttribute('externalSiteId', {
    type: 'string',
    hidden: true,
    readOnly: true,
    watch: ['authoringType', 'hlxConfig', 'deliveryConfig'],
    set: (_, attrs) => computeExternalIds(attrs, Site.AUTHORING_TYPES).externalSiteId,
  })
  .addAttribute('pageTypes', {
    type: 'list',
    required: false,
    items: {
      type: 'map',
      required: true,
      properties: {
        name: { type: 'string', required: true },
        pattern: {
          type: 'string',
          required: true,
        },
      },
    },
  })
  .addAllIndex(['baseURL'])
  .addIndex(
    { composite: ['deliveryType'] },
    { composite: ['updatedAt'] },
  )
  .addIndex(
    { composite: ['externalOwnerId'] },
    { composite: ['externalSiteId'] },
  );

export default schema.build();
