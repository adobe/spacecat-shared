/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { hasText, isValidHelixPreviewUrl, isValidUrl } from '@adobe/spacecat-shared-utils';

import DataAccessError from '../../../errors/data-access.error.js';
import PostgresBaseCollection from '../base/postgres-base.collection.js';

import PostgresSiteModel, { AEM_CS_HOST, getAuthoringType } from './site.pg.model.js';

/**
 * PostgresSiteCollection - A Postgres-backed collection for Site entities.
 * Mirrors the v2 SiteCollection's custom query methods.
 *
 * @class PostgresSiteCollection
 * @extends PostgresBaseCollection
 */
class PostgresSiteCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'SiteCollection';

  /**
   * Returns all site IDs that are eligible for auditing.
   * @returns {Promise<string[]>} Array of site IDs.
   */
  async allSitesToAudit() {
    return (await this.all({}, { attributes: ['siteId'] })).map((site) => site.getId());
  }

  /**
   * Returns all sites joined with their latest audit for a given audit type.
   * Sites with a latest audit appear first (in the order specified), followed
   * by sites without a latest audit.
   *
   * @param {string} auditType - The type of audit to look up.
   * @param {string} [order='asc'] - Sort order for audits.
   * @param {string|null} [deliveryType=null] - Optional delivery type filter.
   * @returns {Promise<Array>} Ordered array of Site model instances.
   */
  async allWithLatestAudit(auditType, order = 'asc', deliveryType = null) {
    if (!hasText(auditType)) {
      throw new DataAccessError('auditType is required', this);
    }

    const latestAuditCollection = this.entityRegistry.getCollection('LatestAuditCollection');

    const sitesQuery = Object.values(PostgresSiteModel.DELIVERY_TYPES)
      .includes(deliveryType)
      ? this.allByDeliveryType(deliveryType)
      : this.all();

    const [sites, latestAudits] = await Promise.all([
      sitesQuery,
      latestAuditCollection.all({ auditType }, { order }),
    ]);

    const sitesMap = new Map(sites.map((site) => [site.getId(), site]));
    const orderedSites = [];
    const cacheKey = `getLatestAuditByAuditType:["${auditType}"]`;

    // First, append sites with a latest audit in the sorted order
    latestAudits.forEach((audit) => {
      const site = sitesMap.get(audit.getSiteId());
      if (site) {
        // eslint-disable-next-line no-underscore-dangle
        site._accessorCache[cacheKey] = audit;
        orderedSites.push(site);
        sitesMap.delete(site.getId());
      }
    });

    // Then, append the remaining sites (without a latest audit)
    sitesMap.forEach((site) => {
      // eslint-disable-next-line no-underscore-dangle,no-param-reassign
      site._accessorCache[cacheKey] = null;
      orderedSites.push(site);
    });

    return orderedSites;
  }

  /**
   * Finds a site by its preview URL. Supports Helix and AEM-CS URL patterns.
   *
   * @param {string} previewURL - The preview URL to look up.
   * @returns {Promise<Object|null>} The matching Site model instance, or null.
   */
  async findByPreviewURL(previewURL) {
    if (!isValidUrl(previewURL)) {
      throw new DataAccessError(`Invalid preview URL: ${previewURL}`, this);
    }

    const { hostname } = new URL(previewURL);
    const previewType = getAuthoringType(hostname, PostgresSiteModel.AUTHORING_TYPES);

    switch (previewType) {
      case PostgresSiteModel.AUTHORING_TYPES.SP:
      case PostgresSiteModel.AUTHORING_TYPES.GD:
      case PostgresSiteModel.AUTHORING_TYPES.DA: {
        if (!isValidHelixPreviewUrl(previewURL)) {
          throw new DataAccessError(`Invalid Helix preview URL: ${previewURL}`, this);
        }
        const [host] = hostname.split('.');
        const [, site, owner] = host.split('--');
        return this.findByExternalOwnerIdAndExternalSiteId(owner, site);
      }
      case PostgresSiteModel.AUTHORING_TYPES.CS_CW:
      case PostgresSiteModel.AUTHORING_TYPES.CS: {
        const [, programId, envId] = AEM_CS_HOST.exec(hostname);
        const externalOwnerId = `p${programId}`;
        const externalSiteId = `e${envId}`;
        return this.findByExternalOwnerIdAndExternalSiteId(externalOwnerId, externalSiteId);
      }
      default:
        throw new DataAccessError(`Unsupported preview URL: ${previewURL}`, this);
    }
  }
}

export default PostgresSiteCollection;
