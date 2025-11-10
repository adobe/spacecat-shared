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
    const organizationId = await site.getOrganizationId();
    const organization = await context.dataAccess.Organization.findById(organizationId);
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
  }

  /**
   * Checks for valid entitlement on organization and valid site enrollment on site.
   * @returns {Promise<object>} Object with entitlement and/or siteEnrollment based on what exists.
   */
  async checkValidEntitlement() {
    try {
      const orgId = this.organization.getId();
      const entitlement = await this.Entitlement
        .findByOrganizationIdAndProductCode(orgId, this.productCode);

      if (!entitlement) {
        return {};
      }
      // Only check for site enrollment if site is provided
      if (this.site) {
        const siteId = this.site.getId();
        const siteEnrollments = await this.SiteEnrollment.allBySiteId(siteId);
        const validSiteEnrollment = siteEnrollments.find(
          (se) => se.getEntitlementId() === entitlement.getId(),
        );

        if (!validSiteEnrollment) {
          return { entitlement };
        }
        return {
          entitlement,
          siteEnrollment: validSiteEnrollment,
        };
      } else {
        return { entitlement };
      }
    } catch (error) {
      this.log.error(`Error checking valid entitlement and site enrollment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates entitlement for organization and site enrollment for site.
   * If entitlement exists with different tier, updates the tier.
   * @param {string} tier - Entitlement tier.
   * @returns {Promise<object>} Object with created/updated
   * entitlement and siteEnrollment (if site provided).
   */
  async createEntitlement(tier) {
    try {
      if (!Object.values(EntitlementModel.TIERS).includes(tier)) {
        throw new Error(`Invalid tier: ${tier}. Valid tiers: ${Object.values(EntitlementModel.TIERS).join(', ')}`);
      }
      const orgId = this.organization.getId();
      // Check what already exists
      const existing = await this.checkValidEntitlement();

      // If entitlement exists, handle tier update and return
      if (existing.entitlement) {
        const currentTier = existing.entitlement.getTier();

        // If tier doesn't match, update it
        if (currentTier !== tier) {
          existing.entitlement.setTier(tier);
          await existing.entitlement.save();
        }

        // If site provided but no site enrollment, create it
        if (this.site && !existing.siteEnrollment) {
          const siteId = this.site.getId();
          const siteEnrollment = await this.SiteEnrollment.create({
            siteId,
            entitlementId: existing.entitlement.getId(),
          });
          return {
            entitlement: existing.entitlement,
            siteEnrollment,
          };
        }

        return existing;
      }

      // No existing entitlement, create new one
      const entitlement = await this.Entitlement.create({
        organizationId: orgId,
        productCode: this.productCode,
        tier,
        quotas: {
          llmo_trial_prompts: 200,
          llmo_trial_prompts_consumed: 0,
        },
      });

      // If no site provided, return entitlement only
      if (!this.site) {
        return { entitlement };
      }

      // Create site enrollment
      const siteId = this.site.getId();
      const siteEnrollment = await this.SiteEnrollment.create({
        siteId,
        entitlementId: entitlement.getId(),
      });

      return {
        entitlement,
        siteEnrollment,
      };
    } catch (error) {
      this.log.error(`Error creating/updating entitlement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revokes site enrollment for the current site.
   * @returns {Promise<object>} HTTP response object.
   */
  async revokeSiteEnrollment() {
    const existing = await this.checkValidEntitlement();
    if (existing.siteEnrollment) {
      await existing.siteEnrollment.remove();
    } else {
      throw new Error('Site enrollment not found');
    }
  }
}

export default TierClient;
