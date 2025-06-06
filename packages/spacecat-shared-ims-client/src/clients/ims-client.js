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

import { hasText } from '@adobe/spacecat-shared-utils';

import ImsBaseClient from './ims-base-client.js';
import {
  emailAddressIsAllowed,
  extractIdAndAuthSource,
  getGroupMembersEndpoint,
  getImsOrgsApiPath,
  IMS_ALL_ORGANIZATIONS_ENDPOINT,
  IMS_PRODUCT_CONTEXT_BY_ORG_ENDPOINT,
  IMS_PROFILE_ENDPOINT,
  IMS_TOKEN_ENDPOINT,
  IMS_TOKEN_ENDPOINT_V3,
  IMS_VALIDATE_TOKEN_ENDPOINT,
  IMS_ADMIN_PROFILE_ENDPOINT,
} from '../utils.js';

export default class ImsClient extends ImsBaseClient {
  static createFrom(context) {
    const { log = console } = context;
    const {
      IMS_HOST: imsHost,
      IMS_CLIENT_ID: clientId,
      IMS_CLIENT_CODE: clientCode,
      IMS_CLIENT_SECRET: clientSecret,
      IMS_SCOPE: scope,
    } = context.env;

    if (!hasText(imsHost) || !hasText(clientId) || !hasText(clientCode) || !hasText(clientSecret)) {
      throw new Error('Context param must include properties: imsHost, clientId, clientCode, and'
        + ' clientSecret.');
    }

    return new ImsClient({
      imsHost,
      clientId,
      clientCode,
      clientSecret,
      scope,
    }, log);
  }

  /**
   * Creates a new Ims client
   *
   * @param {Object} config - The configuration object.
   * @param {string} config.imsHost - The IMS host.
   * @param {string} config.clientId - The IMS client ID.
   * @param {string} config.clientCode - The IMS client code.
   * @param {string} config.clientSecret - The IMS client secret.
   * @param {Object} log - The Logger.
   * @returns {ImsClient} - the Ims client.
   */
  constructor(config, log) {
    super(config, log);
    this.serviceAccessToken = null;
    this.serviceAccessTokenV3 = null;
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

  async #getProductContextByImsOrgId(imsOrgId) {
    const { orgId, authSource } = extractIdAndAuthSource(imsOrgId);

    const pcResponse = await this.imsApiCall(
      IMS_PRODUCT_CONTEXT_BY_ORG_ENDPOINT,
      {},
      {
        org_id: orgId,
        auth_src: authSource,
        client_id: this.config.clientId,
      },
      { noContentType: true },
    );

    if (!pcResponse.ok) {
      throw new Error(`IMS getProductContextsByImsOrgId request failed with status: ${pcResponse.status}`);
    }

    const pcData = await pcResponse.json();

    // Always return the first product context item
    return pcData?.productContexts?.[0];
  }

  async #getUsersByImsGroupId(imsOrgId, groupId) {
    // This endpoint is paginated, but the default page limit is 50 entries — more than enough
    // for our use case
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

  async #getUsersInAdminGroup(imsOrgId, groups) {
    if (!Array.isArray(groups)) {
      return [];
    }

    // Store users by their email address initially to de-dupe the entries
    const users = {};
    for (const group of groups) {
      // Only process Administrators groups
      if (group?.role === 'GRP_ADMIN') {
        // eslint-disable-next-line no-await-in-loop
        const groupUsers = await this.#getUsersByImsGroupId(imsOrgId, group?.ident);
        for (const user of groupUsers) {
          // Fallback to username if email is not set
          const newUser = { ...user };
          if (!hasText(newUser.email)) {
            newUser.email = newUser.username;
          }
          if (emailAddressIsAllowed(newUser.email)) {
            // Reduce fields in user object to those we need
            users[newUser.email] = {
              email: newUser.email,
              firstName: newUser.firstName,
              lastName: newUser.lastName,
            };
          }
        }
      }
    }

    // Transform the object "map" back to a de-duped array
    return Object.keys(users).map((email) => users[email]);
  }

  async getServiceAccessToken() {
    if (hasText(this.serviceAccessToken?.access_token)) {
      return this.serviceAccessToken;
    }

    const tokenResponse = await this.imsApiCall(
      IMS_TOKEN_ENDPOINT,
      {},
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: this.config.clientCode,
        grant_type: 'authorization_code',
      },
      { noContentType: true, noAuth: true },
    );

    if (!tokenResponse.ok) {
      throw new Error(`IMS getServiceAccessToken request failed with status: ${tokenResponse.status}`);
    }

    /* eslint-disable camelcase */
    const { access_token, token_type, expires_in } = await tokenResponse.json();

    this.serviceAccessToken = {
      access_token,
      expires_in,
      token_type,
    };

    return this.serviceAccessToken;
  }

  async getServiceAccessTokenV3() {
    if (hasText(this.serviceAccessTokenV3?.access_token)) {
      return this.serviceAccessTokenV3;
    }

    const tokenResponse = await this.imsApiCall(
      IMS_TOKEN_ENDPOINT_V3,
      {},
      {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scope,
        grant_type: 'client_credentials',
      },
      { noContentType: true, noAuth: true },
    );

    if (!tokenResponse.ok) {
      throw new Error(`IMS getServiceAccessTokenV3 request failed with status: ${tokenResponse.status}`);
    }

    /* eslint-disable camelcase */
    const { access_token, token_type, expires_in } = await tokenResponse.json();

    this.serviceAccessTokenV3 = {
      access_token,
      expires_in,
      token_type,
    };

    return this.serviceAccessTokenV3;
  }

  async getImsOrganizationDetails(imsOrgId) {
    if (!hasText(imsOrgId)) {
      throw new Error('imsOrgId param is required.');
    }

    // Request tenant ID from the IMS "product context"
    const productContext = await this.#getProductContextByImsOrgId(imsOrgId);
    const tenantId = productContext?.params?.tenant_id;

    // Request organization details
    const orgDetails = await this.#getImsOrgDetails(imsOrgId);
    const orgName = orgDetails?.orgName;

    this.log.debug(`IMS Org ID ${imsOrgId} has tenantId: ${tenantId}, name: "${orgName}"`);

    // Fetch a list of all users in the Administrators group
    const admins = await this.#getUsersInAdminGroup(imsOrgId, orgDetails?.groups);
    this.log.debug(`IMS Org ID ${imsOrgId} has ${admins.length} known admin users.`);

    return {
      imsOrgId,
      tenantId,
      orgName,
      orgType: orgDetails?.orgType,
      countryCode: orgDetails?.countryCode,
      admins,
    };
  }

  /**
   * Fetch the IMS profile of a user given the IMS access token.
   * @param {string} imsAccessToken A valid IMS user access token
   * @returns {Promise<{userId, email, organizations: string[]}>} Fields from the user's profile
   */
  async getImsUserProfile(imsAccessToken) {
    if (!hasText(imsAccessToken)) {
      throw new Error('imsAccessToken param is required.');
    }

    // Helper to pull the unique organization ID values from an array of role entries
    function getOrganizationList(roles = []) {
      return [...new Set(roles.map((roleEntry) => roleEntry.organization))];
    }

    const profileResponse = await this.imsApiCall(
      IMS_PROFILE_ENDPOINT,
      {},
      null,
      { accessToken: imsAccessToken },
    );

    if (!profileResponse.ok) {
      throw new Error(`IMS getImsUserProfile request failed with status: ${profileResponse.status}`);
    }

    const profile = await profileResponse.json();
    return {
      ...profile,
      organizations: getOrganizationList(profile.roles),
    };
  }

  /**
   * Fetch the IMS organizations of a user given the IMS access token.
   * @param {string} imsAccessToken A valid IMS user access token
   * @returns {Promise<(string|*)[]>} The list of organization IDs
   */
  async getImsUserOrganizations(imsAccessToken) {
    if (!hasText(imsAccessToken)) {
      throw new Error('imsAccessToken param is required.');
    }

    const organizationsResponse = await this.imsApiCall(
      IMS_ALL_ORGANIZATIONS_ENDPOINT,
      {},
      null,
      { accessToken: imsAccessToken },
    );

    if (!organizationsResponse.ok) {
      throw new Error(`IMS getImsUserOrganizations request failed with status: ${organizationsResponse.status}`);
    }

    return organizationsResponse.json();
  }

  /**
   * Validates an IMS access token.
   * @param {string} imsAccessToken The IMS access token to validate.
   * @returns {Promise<object>} The validation result.
   * @throws {Error} If the token validation fails.
   */
  async validateAccessToken(imsAccessToken) {
    if (!hasText(imsAccessToken)) {
      throw new Error('imsAccessToken param is required.');
    }

    const validationResponse = await this.imsApiCall(
      IMS_VALIDATE_TOKEN_ENDPOINT,
      {},
      {
        token: imsAccessToken,
        client_id: this.config.clientId,
        type: 'access_token',
      },
      { noContentType: true, noAuth: true },
    );

    if (!validationResponse.ok) {
      throw new Error(`IMS validateAccessToken request failed with status: ${validationResponse.status}`);
    }

    return validationResponse.json();
  }

  /**
   * Fetches the profile for a given GUID using by using the IMS Admin API
   * @param {string} imsId - The IMS ID of the user
   * @returns {Promise<Object>} The user's profile data
   * @throws {Error} If the request fails
   */
  async getImsAdminProfile(imsId) {
    if (!hasText(imsId)) {
      throw new Error('imsId param is required.');
    }

    const { guid, authSource } = extractIdAndAuthSource(imsId);

    const serviceToken = await this.getServiceAccessToken();

    const adminProfileResponse = await this.imsApiCall(
      IMS_ADMIN_PROFILE_ENDPOINT,
      {},
      {
        guid,
        client_id: this.config.clientId,
        bearer_token: serviceToken.access_token,
        auth_src: authSource,
      },
      { noContentType: true },
    );

    if (!adminProfileResponse.ok) {
      throw new Error(`IMS getAdminProfile request failed with status: ${adminProfileResponse.status}`);
    }

    return adminProfileResponse.json();
  }
}
