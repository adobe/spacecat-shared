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

import JiraCloudClient from './clients/jira-cloud-client.js';
import CredentialManagerFactory from './credentials/credential-manager-factory.js';
import RateLimitAwareHttpClient from './http/rate-limit-aware-http-client.js';

/**
 * Factory that resolves the correct provider client for a connection.
 *
 * Adding a new provider requires:
 * 1. Define types and extend task_management_provider enum in DB
 * 2. Implement a provider client extending BaseTicketClient
 * 3. Register it in CLIENT_MAP below
 * 4. Add metadata JSON Schema to METADATA_SCHEMAS in connection validation
 * 5. Implement CredentialManager variant if auth model differs from OAuth 3LO
 * 6. Register in CredentialManagerFactory
 * 7. Document provider-specific config and field mapping
 * 8. Add integration tests
 */
const CLIENT_MAP = {
  jira_cloud: JiraCloudClient,
};

// Matches lowercase UUIDs (v4/v7) — the only valid form for DB-sourced IDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Builds the Secrets Manager path for a connection's OAuth credentials.
 * Pattern: /mysticat/task-management/{orgId}/{connectionId}
 *
 * No {env} segment — each environment is a separate AWS account, so account
 * boundary already provides isolation. Consistent with /mysticat/bootstrap/*.
 *
 * Both IDs are validated as UUIDs before interpolation — a malformed DB record
 * containing `../` sequences could otherwise traverse the SM namespace.
 *
 * @param {string} organizationId
 * @param {string} connectionId
 * @returns {string}
 * @throws {Error} When either ID is not a valid UUID.
 */
function buildSecretPath(organizationId, connectionId) {
  if (!UUID_REGEX.test(organizationId) || !UUID_REGEX.test(connectionId)) {
    throw new Error('Invalid path segment: organizationId and connectionId must be UUIDs');
  }
  return `/mysticat/task-management/${organizationId}/${connectionId}`;
}

export default class TicketClientFactory {
  /**
   * @param {object} connection - Connection record from DB
   * @param {object} smClient - AWS Secrets Manager client
   * @param {object} httpClient - Fetch-compatible HTTP client
   * @param {object} log - Logger
   * @returns {BaseTicketClient}
   */
  static create(connection, smClient, httpClient, log) {
    const {
      provider, metadata, id: connectionId, organizationId, instanceUrl,
    } = connection;

    const ClientClass = CLIENT_MAP[provider];
    if (!ClientClass) {
      throw new Error(`Unsupported ticket provider: ${provider}`);
    }

    // Merge instanceUrl (top-level column in DB) into config as siteUrl.
    // Per mysticat-data-service schema: siteUrl lives in instance_url column, not metadata JSONB.
    // metadata JSONB contains only provider-specific fields (cloudId, scopes for jira_cloud).
    const config = { ...metadata, siteUrl: instanceUrl };

    const secretPath = buildSecretPath(organizationId, connectionId);
    // Rate-limited client is used only for Jira API calls (api.atlassian.com).
    // The credential manager receives the unwrapped httpClient — auth.atlassian.com
    // does not emit RateLimit-Reason or X-RateLimit-Remaining headers, so the Jira-specific
    // rate-limit wrapper adds no value there and would produce misleading log entries.
    const rateLimitedHttp = new RateLimitAwareHttpClient(httpClient, log);
    const credentialManager = CredentialManagerFactory.create(
      provider,
      smClient,
      secretPath,
      httpClient,
      log,
    );

    return new ClientClass(config, credentialManager, rateLimitedHttp, log);
  }
}
