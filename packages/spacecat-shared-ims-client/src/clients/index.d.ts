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

import type { UniversalContext } from '@adobe/helix-universal';

export class ImsClient {
  /**
   * Creates a new ImsClient instance from the given UniversalContext.
   * @param {UniversalContext} context The UniversalContext to use for creating the ImsClient.
   * @returns {ImsClient} The ImsClient instance.
   */
  static createFrom(context: UniversalContext): ImsClient;

  /**
   * Returns the access token for the given scope.
   * @returns {Promise<{ access_token: string }>} The access token.
   */
  getServiceAccessToken(): Promise<string>;

  /**
   * Returns the organization details for the given IMS organization ID.
   * @param {string} imsOrgId The IMS organization ID.
   * @returns {Promise<{
   *       imsOrgId: string,
   *       tenantId: string,
   *       orgName: string,
   *       orgType: string,
   *       countryCode: string,
   *       admins: {
   *               email: string,
   *               firstName: string,
   *               lastName: string,
   *             }[],
   *     }>} The organization details.
   */
  getImsOrganizationDetails(imsOrgId: string): Promise<object>;
}
