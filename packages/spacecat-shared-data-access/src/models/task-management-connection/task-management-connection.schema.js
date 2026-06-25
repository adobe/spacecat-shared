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
import TaskManagementConnection from './task-management-connection.model.js';
import TaskManagementConnectionCollection from './task-management-connection.collection.js';

// Sort key [provider, status] on the Organization GSI lets the collection method
// findActiveByOrganizationAndProvider() resolve to a single DB call:
//   allByOrganizationIdAndProviderAndStatus(orgId, 'jira_cloud', 'active')
const schema = new SchemaBuilder(TaskManagementConnection, TaskManagementConnectionCollection)
  .addReference('belongs_to', 'Organization', ['provider', 'status'])
  .addReference('has_many', 'Tickets', ['updatedAt'], { removeDependents: true })
  .addAttribute('provider', {
    type: Object.values(TaskManagementConnection.PROVIDERS),
    required: true,
    readOnly: true,
  })
  .addAttribute('status', {
    type: Object.values(TaskManagementConnection.STATUSES),
    required: true,
    default: TaskManagementConnection.STATUSES.ACTIVE,
  })
  // display_name column (PR #720): human-readable site name from Atlassian accessible-resources.
  // Set by auth-service at OAuth callback time; never user-provided.
  .addAttribute('displayName', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => typeof value === 'string' && value.length > 0 && value.length <= 255,
  })
  // instance_url column (PR #720): Jira site URL (https://*.atlassian.net).
  // Display-only — never used as a request target (SSRF protection: all outbound
  // calls route through the fixed Atlassian gateway keyed on cloudId from metadata).
  .addAttribute('instanceUrl', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => isValidUrl(value),
  })
  // connected_by column (PR #720): IMS user ID (JWT sub) of the person who completed OAuth.
  .addAttribute('connectedBy', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  // external_instance_id column: provider-stable identifier for the remote workspace.
  // jira_cloud → Atlassian cloudId UUID; jira_corp → normalized baseUrl (v2).
  // Used as the dedup key in UNIQUE(organization_id, provider, external_instance_id).
  // Never changes after connection is created — readOnly.
  .addAttribute('externalInstanceId', {
    type: 'string',
    required: true,
    readOnly: true,
    validate: (value) => typeof value === 'string' && value.length > 0,
  })
  .addAttribute('lastUsedAt', {
    type: 'string',
    required: false,
    validate: (value) => !value || !Number.isNaN(Date.parse(value)),
  })
  .addAttribute('errorMessage', {
    type: 'string',
    required: false,
  })

  // metadata JSONB (PR #720): provider-specific structured data.
  // jira_cloud: { cloudId (required UUID), scopes (optional string array) }.
  // siteName and siteUrl are NOT stored here — they live in displayName/instanceUrl above.
  // No default — callers must supply valid metadata (e.g. { cloudId: '...' } for
  // jira_cloud). An empty-object default would silently bypass validateMetadata's
  // required-field check at the schema level.
  .addAttribute('metadata', {
    type: 'any',
    required: true,
  });

export default schema.build();
