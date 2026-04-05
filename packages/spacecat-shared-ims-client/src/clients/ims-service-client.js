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

import { hasText } from '@adobe/spacecat-shared-utils';

import ImsBaseClient from './ims-base-client.js';
import {
  getGroupMembersEndpoint,
  getImsOrgsApiPath,
  IMS_TOKEN_ENDPOINT_V3,
} from '../utils.js';

/**
 * IMS client for machine-to-machine (service) flows using the client_credentials grant.
 * Unlike ImsClient (which handles user-context flows), this client authenticates as the
 * service itself and does not require a client code or user token.
 *
 * Typical use cases:
 * - Retrieving org-scoped Service Principal tokens (SP binding flow)
 * - Looking up IMS org group membership without a user token
 */
export default class ImsServiceClient extends ImsBaseClient {
  /**
   * Creates an ImsServiceClient from a context object.
   * Reads IMS_HOST, IMS_EDGE_CLIENT_ID, IMS_EDGE_CLIENT_SECRET, and optionally
   * IMS_EDGE_SCOPE from context.env.
   *
   * @param {Object} context - The context object containing env and log.
   * @returns {ImsServiceClient}
   */
  static createFrom(context) {
    const { log = console } = context;
    const {
      IMS_HOST: imsHost,
      IMS_EDGE_CLIENT_ID: clientId,
      IMS_EDGE_CLIENT_SECRET: clientSecret,
      IMS_EDGE_SCOPE: scope,
    } = context.env;

    if (!hasText(imsHost) || !hasText(clientId) || !hasText(clientSecret)) {
      throw new Error('Context env must include IMS_HOST, IMS_EDGE_CLIENT_ID, and IMS_EDGE_CLIENT_SECRET.');
    }

    return new ImsServiceClient({
      imsHost,
      clientId,
      clientSecret,
      scope: scope || 'openid,AdobeID,additional_info.projectedProductContext',
    }, log);
  }

  constructor(config, log) {
    super(config, log);
    this.serviceAccessToken = null;
  }

  /**
   * Obtains a service-level access token using the client_credentials grant (no org_id).
   * This token is used to authenticate calls to IMS org/group endpoints.
   * It is cached for the lifetime of the client instance.
   *
   * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
   */
  async getServiceAccessToken() {
    if (this.serviceAccessToken?.access_token) {
      return this.serviceAccessToken;
    }

    const tokenResponse = await this.imsApiCall(
      IMS_TOKEN_ENDPOINT_V3,
      {},
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
        scope: this.config.scope,
      },
      { noContentType: true, noAuth: true },
    );

    if (!tokenResponse.ok) {
      throw new Error(`IMS getServiceAccessToken request failed with status: ${tokenResponse.status}`);
    }

    /* eslint-disable camelcase */
    const { access_token, token_type, expires_in } = await tokenResponse.json();
    this.serviceAccessToken = { access_token, token_type, expires_in };
    return this.serviceAccessToken;
  }

  async #getImsOrgDetails(imsOrgId) {
    const orgDetailsResponse = await this.imsApiCall(
      getImsOrgsApiPath(imsOrgId),
      { client_id: this.config.clientId },
    );

    if (!orgDetailsResponse.ok) {
      throw new Error(`IMS getImsOrgDetails request failed with status: ${orgDetailsResponse.status}`);
    }

    return orgDetailsResponse.json();
  }

  async #getUsersByImsGroupId(imsOrgId, groupId) {
    const groupResponse = await this.imsApiCall(
      getGroupMembersEndpoint(imsOrgId, groupId),
      { client_id: this.config.clientId },
    );

    if (!groupResponse.ok) {
      throw new Error(`IMS getUsersByImsGroupId request failed with status: ${groupResponse.status}`);
    }

    const group = await groupResponse.json();
    return group.items || [];
  }

  /**
   * Retrieves a Service Principal access token scoped to a specific customer IMS org.
   * This token is NOT cached — a fresh token is obtained on every call
   * (security requirement: each token is scoped to a specific customer org).
   *
   * @param {string} imsOrgId - The customer IMS org ID (e.g. "ABCDEF1234567890@AdobeOrg")
   * @returns {Promise<{access_token: string, token_type: string, expires_in: number}>}
   */
  async getServicePrincipalToken(imsOrgId) {
    if (!hasText(imsOrgId)) {
      throw new Error('imsOrgId param is required.');
    }

    const tokenResponse = await this.imsApiCall(
      IMS_TOKEN_ENDPOINT_V3,
      {},
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
        org_id: imsOrgId,
        scope: this.config.scope,
      },
      { noContentType: true, noAuth: true },
    );

    if (!tokenResponse.ok) {
      throw new Error(`IMS getServicePrincipalToken request failed with status: ${tokenResponse.status}`);
    }

    /* eslint-disable camelcase */
    const { access_token, token_type, expires_in } = await tokenResponse.json();
    return { access_token, token_type, expires_in };
  }

  /**
   * Returns the list of groups for a given IMS org.
   *
   * @param {string} imsOrgId - The IMS org ID
   * @returns {Promise<Array>} Array of group objects with shape { groupName, role, ident, ... }
   */
  async getOrgGroups(imsOrgId) {
    if (!hasText(imsOrgId)) {
      throw new Error('imsOrgId param is required.');
    }
    const orgDetails = await this.#getImsOrgDetails(imsOrgId);
    return orgDetails?.groups || [];
  }

  /**
   * Checks whether a user (identified by email) is a member of a specific IMS group.
   *
   * @param {string} imsOrgId - The IMS org ID owning the group
   * @param {string} groupId - The IMS group ID to check membership in
   * @param {string} userEmail - The email address of the user to check
   * @returns {Promise<boolean>} True if the user is a member of the group
   */
  async isUserInImsGroup(imsOrgId, groupId, userEmail) {
    if (!hasText(imsOrgId) || !hasText(groupId) || !hasText(userEmail)) {
      throw new Error('imsOrgId, groupId, and userEmail params are required.');
    }

    const members = await this.#getUsersByImsGroupId(imsOrgId, groupId);
    const normalizedEmail = userEmail.toLowerCase();
    return members.some(
      (member) => (member.email || member.username)?.toLowerCase() === normalizedEmail,
    );
  }
}
