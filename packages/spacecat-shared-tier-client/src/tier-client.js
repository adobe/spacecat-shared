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

import { isNonEmptyObject, hasText } from '@adobe/spacecat-shared-utils';
import {
  Site,
  Entitlement as EntitlementModel,
  OrganizationIdentityProvider as OrganizationIdentityProviderModel,
  Organization,
} from '@adobe/spacecat-shared-data-access';

/**
 * TierClient provides methods to manage entitlements and site enrollments.
 */
class TierClient {
  /**
   * Creates a TierClient for organization-only operations.
   * @param {object} context - Context of the request.
   * @param {object} organization - Organization object with getId() method.
   * @param {string} productCode - Product code.
   * @returns {TierClient} TierClient instance for organization operations.
   */
  static createForOrg(context, organization, productCode) {
    if (!(organization instanceof Organization)) {
      throw new Error('Entity must be an instance of Organization');
    }
    if (!hasText(productCode)) {
      throw new Error('Product code is required');
    }
    if (!isNonEmptyObject(context)) {
      throw new Error('Context is required');
    }
    return new TierClient(context, organization, null, productCode);
  }

  /**
   * Creates a TierClient for site-specific operations.
   * @param {object} context - Context of the request.
   * @param {object} site - Site object with getId() method.
   * @param {string} productCode - Product code.
   * @returns {TierClient} TierClient instance for site operations.
   */
  static async createForSite(context, site, productCode) {
    if (!(site instanceof Site)) {
      throw new Error('Entity must be an instance of Site');
    }
    if (!hasText(productCode)) {
      throw new Error('Product code is required');
    }
    if (!isNonEmptyObject(context)) {
      throw new Error('Context is required');
    }
    const organization = await site.getOrganization();
    return new TierClient(context, organization, site, productCode);
  }

  /**
   * Creates a new TierClient instance.
   * @param {object} context - Context of the request.
   * @param {object} organization - Organization object with getId() method.
   * @param {object} site - Site object with getId() method (optional for org-only operations).
   * @param {string} productCode - Product code.
   */
  constructor(context, organization, site, productCode) {
    // Basic validation is now handled in static factory methods
    const { dataAccess } = context;

    const {
      Entitlement: EntitlementCollection,
      SiteEnrollment: SiteEnrollmentCollection,
      Organization: OrganizationCollection,
      Site: SiteCollection,
      OrganizationIdentityProvider: OrganizationIdentityProviderCollection,
    } = dataAccess;

    const { log } = context;

    // Store instance properties
    this.context = context;
    this.organization = organization;
    this.site = site;
    this.productCode = productCode;
    this.log = log;

    // Store dataAccess properties directly
    this.Entitlement = EntitlementCollection;
    this.SiteEnrollment = SiteEnrollmentCollection;
    this.Organization = OrganizationCollection;
    this.Site = SiteCollection;
    this.OrganizationIdentityProvider = OrganizationIdentityProviderCollection;
  }

  /**
   * Checks for valid entitlement on organization and valid site enrollment on site.
   * @returns {Promise<object>} Object with entitlement and/or siteEnrollment based on what exists.
   */
  async checkValidEntitlement() {
    try {
      const orgId = this.organization.getId();
      this.log.info(`Checking for valid entitlement for org ${orgId} and product ${this.productCode}`);

      const entitlement = await this.Entitlement
        .findByOrganizationIdAndProductCode(orgId, this.productCode);

      if (!entitlement) {
        this.log.info(`No valid entitlement found for org ${orgId} and product ${this.productCode}`);
        return {};
      }

      this.log.info(`Found valid entitlement: ${entitlement.getId()}`);

      // Only check for site enrollment if site is provided
      if (this.site) {
        const siteId = this.site.getId();
        this.log.info(`Checking for valid site enrollment for site ${siteId} and entitlement ${entitlement.getId()}`);

        const siteEnrollments = await this.SiteEnrollment.allBySiteId(siteId);
        const validSiteEnrollment = siteEnrollments.find(
          (se) => se.getEntitlementId() === entitlement.getId(),
        );

        if (!validSiteEnrollment) {
          this.log.info(`No valid site enrollment found for site ${siteId} and entitlement ${entitlement.getId()}`);
          return { entitlement };
        }

        this.log.info(`Found valid site enrollment: ${validSiteEnrollment.getId()}`);

        return {
          entitlement,
          siteEnrollment: validSiteEnrollment,
        };
      } else {
        this.log.info(`No site provided, returning entitlement only for org ${orgId}`);
        return { entitlement };
      }
    } catch (error) {
      this.log.error(`Error checking valid entitlement and site enrollment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates entitlement for organization and site enrollment for site.
   * First validates that org and site don't already have an entitlement for this product.
   * @param {string} tier - Entitlement tier.
   * @returns {Promise<object>} Object with created entitlement and siteEnrollment.
   */
  async createEntitlement(tier) {
    try {
      if (!Object.values(EntitlementModel.TIERS).includes(tier)) {
        throw new Error(`Invalid tier: ${tier}. Valid tiers: ${Object.values(EntitlementModel.TIERS).join(', ')}`);
      }

      if (!this.site) {
        throw new Error('Site required for creating entitlements');
      }

      const orgId = this.organization.getId();
      const siteId = this.site.getId();
      this.log.info(`Creating entitlement for org ${orgId}, site ${siteId}, product ${this.productCode}, tier ${tier}`);

      // Check what already exists
      const existing = await this.checkValidEntitlement();

      // If both entitlement and site enrollment exist, return them
      if (existing.entitlement && existing.siteEnrollment) {
        this.log.info(`Entitlement and site enrollment already exist for org ${orgId}, site ${siteId} and product ${this.productCode}`);
        return existing;
      }

      // If only entitlement exists, we need to create site enrollment
      if (existing.entitlement && !existing.siteEnrollment) {
        this.log.info(`Entitlement exists but site enrollment missing for org ${orgId}, site ${siteId} and product ${this.productCode}`);

        // Create site enrollment for existing entitlement
        const siteEnrollment = await this.SiteEnrollment.create({
          siteId,
          entitlementId: existing.entitlement.getId(),
        });

        this.log.info(`Created site enrollment: ${siteEnrollment.getId()}`);

        return {
          entitlement: existing.entitlement,
          siteEnrollment,
        };
      }

      // Create organization identity provider if not exists
      const identityProviders = await this.OrganizationIdentityProvider.allByOrganizationId(orgId);
      const defaultProvider = OrganizationIdentityProviderModel.PROVIDER_TYPES.IMS;
      let providerId = identityProviders.find((idp) => idp.getProvider() === defaultProvider);

      // If no identity provider exists for this provider, create one
      if (!providerId) {
        providerId = await this.OrganizationIdentityProvider.create({
          organizationId: orgId,
          provider: defaultProvider,
          externalId: this.organization.getImsOrgId(),
        });
        this.log.info(`Created identity provider: ${providerId.getId()}`);
      } else {
        this.log.info(`Identity provider already exists: ${providerId.getId()}`);
      }

      // Create entitlement
      const entitlement = await this.Entitlement.create({
        organizationId: orgId,
        productCode: this.productCode,
        tier,
        quotas: {
          llmo_trial_prompts: 200,
          llmo_trial_prompts_consumed: 0,
        },
      });

      this.log.info(`Created entitlement: ${entitlement.getId()}`);

      // Create site enrollment
      const siteEnrollment = await this.SiteEnrollment.create({
        siteId,
        entitlementId: entitlement.getId(),
      });

      this.log.info(`Created site enrollment: ${siteEnrollment.getId()}`);

      return {
        entitlement,
        siteEnrollment,
      };
    } catch (error) {
      this.log.error(`Error creating entitlement and site enrollment: ${error.message}`);
      throw error;
    }
  }
}

export default TierClient;
