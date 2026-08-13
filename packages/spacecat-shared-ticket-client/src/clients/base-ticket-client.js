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

/**
 * Abstract base class for ticket provider clients.
 * Subclasses must implement createTicket(), listProjects(), and listIssueTypes().
 *
 * Attachment support is intentionally NOT part of this base interface (ISP):
 * not every provider supports attachments. Providers that do (e.g. JiraCloudClient)
 * declare uploadAttachment() directly on their own class.
 */
export default class BaseTicketClient {
  /**
   * @param {object} config - Provider-specific config (e.g. cloudId, siteUrl for Jira Cloud)
   * @param {object} credentialManager - Credential manager instance (e.g. OAuthCredentialManager)
   * @param {object} log - Logger
   *
   * Note: HTTP transport is NOT a base constructor arg — not every provider uses the same
   * transport model. Subclasses that require an HTTP client (e.g. JiraCloudClient) should
   * add it as an additional constructor argument and store it on the instance themselves.
   */
  constructor(config, credentialManager, log) {
    if (new.target === BaseTicketClient) {
      throw new Error('BaseTicketClient is abstract and cannot be instantiated directly');
    }
    this.config = config;
    this.credentialManager = credentialManager;
    this.log = log;
  }

  /**
   * Create a ticket in the external provider.
   * @param {object} ticketData - Ticket fields (summary, description, projectKey, issueType, etc.)
   * @returns {Promise<{ticketId, ticketKey, ticketUrl, ticketStatus}>}
   */
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async createTicket(ticketData) {
    throw new Error('createTicket() must be implemented by subclass');
  }

  /**
   * Return all accessible projects for this connection.
   * @returns {Promise<Array<{id, key, name}>>}
   */
  // eslint-disable-next-line class-methods-use-this
  async listProjects() {
    throw new Error('listProjects() must be implemented by subclass');
  }

  /**
   * Return issue types for the given Jira project.
   * @param {string} projectId
   * @returns {Promise<Array<{id, name, subtask}>>}
   */
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  async listIssueTypes(projectId) {
    throw new Error('listIssueTypes() must be implemented by subclass');
  }
}
