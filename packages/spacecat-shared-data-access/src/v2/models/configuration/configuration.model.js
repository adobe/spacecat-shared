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

import BaseModel from '../base/base.model.js';
import { sanitizeIdAndAuditFields } from '../../util/util.js';

/**
 * Configuration - A class representing an Configuration entity.
 * Provides methods to access and manipulate Configuration-specific data.
 *
 * @class Configuration
 * @extends BaseModel
 */
class Configuration extends BaseModel {
  // add your custom methods or overrides here

  addHandler = (type, handlerData) => {
    const handlers = this.getHandlers() || {};
    handlers[type] = { ...handlerData };

    this.setHandlers(handlers);
  };

  getSlackRoleMembersByRole(role) {
    const roles = this.getSlackRoles();
    return roles ? roles[role] : [];
  }

  getEnabledSiteIdsForHandler(type) {
    const handler = this.getHandlers()?.[type];
    return handler?.enabled?.sites || [];
  }

  isHandlerEnabledForSite(type, site) {
    const handler = this.getHandlers()?.[type];
    if (!handler) return false;

    const siteId = site.getId();
    const orgId = site.getOrganizationId();

    if (handler.enabled) {
      const sites = handler.enabled.sites || [];
      const orgs = handler.enabled.orgs || [];
      return sites.includes(siteId) || orgs.includes(orgId);
    }

    if (handler.disabled) {
      const sites = handler.disabled.sites || [];
      const orgs = handler.disabled.orgs || [];
      return !(sites.includes(siteId) || orgs.includes(orgId));
    }

    return handler.enabledByDefault;
  }

  isHandlerEnabledForOrg(type, org) {
    const handler = this.getHandlers()?.[type];
    if (!handler) return false;

    const orgId = org.getId();

    if (handler.enabled) {
      return handler.enabled.orgs.includes(orgId);
    }

    if (handler.disabled) {
      return !handler.disabled.orgs.includes(orgId);
    }

    return handler.enabledByDefault;
  }

  updateHandlerOrgs(type, orgId, enabled) {
    const handlers = this.getHandlers();
    const handler = handlers?.[type];

    if (!handler) return;

    if (enabled) {
      if (handler.enabledByDefault) {
        handler.disabled.orgs = handler.disabled.orgs?.filter((id) => id !== orgId) || [];
      } else {
        handler.enabled = handler.enabled || { orgs: [] };
        handler.enabled.orgs = Array.from(new Set([...(handler.enabled?.orgs || []), orgId]));
      }
    } else if (handler.enabledByDefault) {
      handler.disabled = handler.disabled || { orgs: [] };
      handler.disabled.orgs = Array.from(new Set([...(handler.disabled?.orgs || []), orgId]));
    } else {
      handler.enabled.orgs = handler.enabled.orgs?.filter((id) => id !== orgId) || [];
    }

    handlers[type] = handler;
    this.setHandlers(handlers);
  }

  updateHandlerSites(type, siteId, enabled) {
    const handlers = this.getHandlers();
    const handler = handlers?.[type];

    if (!handler) return;

    if (enabled) {
      if (handler.enabledByDefault) {
        handler.disabled.sites = handler.disabled.sites?.filter((id) => id !== siteId) || [];
      } else {
        handler.enabled = handler.enabled || { sites: [] };
        handler.enabled.sites = Array.from(new Set([...(handler.enabled.sites || []), siteId]));
      }
    } else if (handler.enabledByDefault) {
      handler.disabled = handler.disabled || { sites: [] };
      handler.disabled.sites = Array.from(new Set([...(handler.disabled.sites || []), siteId]));
    } else {
      handler.enabled.sites = handler.enabled.sites?.filter((id) => id !== siteId) || [];
    }

    handlers[type] = handler;
    this.setHandlers(handlers);
  }

  enableHandlerForSite(type, site) {
    const siteId = site.getId();
    if (this.isHandlerEnabledForSite(type, site)) return;

    this.updateHandlerSites(type, siteId, true);
  }

  enableHandlerForOrg(type, org) {
    const orgId = org.getId();
    if (this.isHandlerEnabledForOrg(type, org)) return;

    this.updateHandlerOrgs(type, orgId, true);
  }

  disableHandlerForSite(type, site) {
    const siteId = site.getId();
    if (!this.isHandlerEnabledForSite(type, site)) return;

    this.updateHandlerSites(type, siteId, false);
  }

  disableHandlerForOrg(type, org) {
    const orgId = org.getId();
    if (!this.isHandlerEnabledForOrg(type, org)) return;

    this.updateHandlerOrgs(type, orgId, false);
  }

  async save() {
    return this.collection.create(sanitizeIdAndAuditFields(this.constructor.name, this.toJSON()));
  }
}

export default Configuration;