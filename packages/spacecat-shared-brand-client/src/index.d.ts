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

export interface BrandClientConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export interface BrandConfig {
  brandId: string;
  userId: string;
}

export interface Brand {
  id: string;
  name: string;
  imsOrgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandGuidelines extends Brand {
  toneOfVoice?: string[];
  coreValues?: string[];
  guidelines?: string[];
  restrictions?: string[];
  additionalGuidelines?: string[];
}

export default class BrandClient {
  constructor(config: BrandClientConfig, log?: Console);

  /**
   * Static factory method to create an instance of BrandClient.
   *
   * @param {UniversalContext} context - An object containing the HelixUniversal context.
   * The context must include an `env` property with `BRAND_API_BASE_URL` and `BRAND_API_KEY`.
   * @returns An instance of BrandClient.
   * @remarks This method creates a new instance from a HelixUniversal context and
   * caches it on the context.
   */
  static createFrom(context: UniversalContext): BrandClient;

  /**
   * Retrieves brands associated with the given IMS Org.
   *
   * @param {string} imsOrgId - The IMS organization ID to get brands for
   * @param {string} imsAccessToken - Valid IMS access token for authentication
   * @returns {Promise<Brand[]>} Array of brands belonging to the organization
   * @throws {Error} If imsOrgId or imsAccessToken is invalid, or if the API request fails
   */
  getBrandsForOrganization(imsOrgId: string, imsAccessToken: string): Promise<Brand[]>;

  /**
   * Gets an IMS access token using the provided IMS configuration.
   *
   * @param {ImsConfig} imsConfig - Configuration for IMS authentication
   * @returns {Promise<string>} The IMS access token
   * @throws {Error} If the IMS token request fails
   */
  getImsAccessToken(imsConfig: ImsConfig): Promise<string>;

  /**
   * Retrieves brand guidelines for the given brand and IMS Org.
   *
   * @param {BrandConfig} brandConfig - The brand configuration including brandId and userId
   * @param {string} imsOrgId - The IMS organization ID that owns the brand
   * @param {ImsConfig} imsConfig - Configuration for IMS authentication
   * @returns {Promise<BrandGuidelines>} The brand guidelines including tone of voice,
   * core values, etc.
   * @throws {Error} If brandId is invalid, imsOrgId is invalid, imsConfig is incomplete,
   * or if the API request fails
   */
  getBrandGuidelines(
    brandConfig: BrandConfig,
    imsOrgId: string,
    imsConfig: ImsConfig,
  ): Promise<BrandGuidelines>;
}
