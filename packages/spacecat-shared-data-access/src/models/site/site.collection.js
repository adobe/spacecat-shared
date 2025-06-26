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

import { hasText, isValidHelixPreviewUrl, isValidUrl } from '@adobe/spacecat-shared-utils';

import DataAccessError from '../../errors/data-access.error.js';
import BaseCollection from '../base/base.collection.js';

import Site, { AEM_CS_HOST, getAuthoringType } from './site.model.js';

/**
 * SiteCollection - A collection class responsible for managing Site entities.
 * Extends the BaseCollection to provide specific methods for interacting with Site records.
 *
 * @class SiteCollection
 * @extends BaseCollection
 */
class SiteCollection extends BaseCollection {
  async allSitesToAudit() {
    return (await this.all({}, { attributes: ['siteId'] })).map((site) => site.getId());
  }

  async allWithLatestAudit(auditType, order = 'asc', deliveryType = null) {
    if (!hasText(auditType)) {
      throw new DataAccessError('auditType is required', this);
    }

    const latestAuditCollection = this.entityRegistry.getCollection('LatestAuditCollection');

    const sitesQuery = Object.values(Site.DELIVERY_TYPES)
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
    // getLatestAuditByAuditType:["cwv"]

    // First, append sites with a latest audit in the sorted order
    latestAudits.forEach((audit) => {
      const site = sitesMap.get(audit.getSiteId());
      if (site) {
        // eslint-disable-next-line no-underscore-dangle
        site._accessorCache[cacheKey] = audit;
        orderedSites.push(site);
        sitesMap.delete(site.getId()); // Remove the site from the map to avoid adding it again
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

  async findByPreviewURL(previewURL) {
    if (!isValidUrl(previewURL)) {
      throw new DataAccessError(`Invalid preview URL: ${previewURL}`, this);
    }

    const { hostname } = new URL(previewURL);
    const previewType = getAuthoringType(hostname, Site.AUTHORING_TYPES);

    switch (previewType) {
      case Site.AUTHORING_TYPES.DA: {
        if (!isValidHelixPreviewUrl(previewURL)) {
          throw new DataAccessError(`Invalid Helix preview URL: ${previewURL}`, this);
        }
        const [host] = hostname.split('.');
        const [ref, site, owner] = host.split('--');
        const externalOwnerId = `${ref}#${owner}`;
        return this.findByExternalOwnerIdAndExternalSiteId(externalOwnerId, site);
      }
      case Site.AUTHORING_TYPES.CW:
      case Site.AUTHORING_TYPES.CS: {
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

export default SiteCollection;
