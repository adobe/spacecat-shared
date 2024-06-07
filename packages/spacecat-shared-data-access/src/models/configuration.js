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

import Joi from 'joi';

const Configuration = (data = {}) => {
  const self = { ...data };
  self.getJobs = () => self.jobs;
  self.getVersion = () => self.version;
  self.getQueues = () => self.queues;
  self.getHandlers = () => self.handlers;
  self.getHandler = (type) => self.handlers[type];
  self.isHandlerEnabledForSite = (type, site) => {
    const handler = self.handlers[type];
    if (!handler) return false;

    const siteId = site.getId();
    const orgId = site.getOrgId();

    if (handler.enabled) {
      return handler.enabled.sites.includes(siteId) || handler.enabled.orgs.includes(orgId);
    }

    if (handler.disabled) {
      return !(handler.disabled.sites.includes(siteId) || handler.disabled.orgs.includes(orgId));
    }

    return handler.enabledByDefault;
  };

  self.isHandlerEnabledForOrg = (type, org) => {
    const handler = self.handlers[type];
    if (!handler) return false;

    const orgId = org.getId();

    if (handler.enabled) {
      return handler.enabled.orgs.includes(orgId);
    }

    if (handler.disabled) {
      return !handler.disabled.orgs.includes(orgId);
    }

    return handler.enabledByDefault;
  };

  const updateHandlerOrgs = (type, orgId, enabled) => {
    const handler = self.handlers[type];
    if (!handler) return;

    if (enabled) {
      if (handler.enabledByDefault) {
        handler.disabled.orgs = handler.disabled.orgs?.filter((id) => id !== orgId) || [];
      } else {
        handler.enabled.orgs = [...(handler.enabled.orgs || []), orgId];
      }
    } else if (handler.enabledByDefault) {
      handler.enabled.orgs = handler.enabled.orgs?.filter((id) => id !== orgId) || [];
    } else {
      handler.disabled.orgs = [...(handler.disabled.orgs || []), orgId];
    }
  };

  const updateHandlerSites = (type, siteId, enabled) => {
    const handler = self.handlers[type];
    if (!handler) return;

    if (enabled) {
      if (handler.enabledByDefault) {
        handler.disabled.sites = handler.disabled.sites?.filter((id) => id !== siteId) || [];
      } else {
        handler.enabled.sites = [...(handler.enabled.sites || []), siteId];
      }
    } else if (handler.enabledByDefault) {
      handler.enabled.sites = handler.enabled.sites?.filter((id) => id !== siteId) || [];
    } else {
      handler.disabled.sites = [...(handler.disabled.sites || []), siteId];
    }
  };

  self.enableHandlerForSite = (type, site) => {
    const siteId = site.getId();
    if (self.isHandlerEnabledForSite(type, site)) return;

    updateHandlerSites(type, siteId, true);
  };

  self.enableHandlerForOrg = (type, org) => {
    const orgId = org.getId();
    if (self.isHandlerEnabledForOrg(type, org)) return;

    updateHandlerOrgs(type, orgId, true);
  };

  self.disableHandlerForSite = (type, site) => {
    const siteId = site.getId();
    if (!self.isHandlerEnabledForSite(type, site)) return;

    updateHandlerSites(type, siteId, false);
  };

  self.disableHandlerForOrg = (type, org) => {
    const orgId = org.getId();
    if (!self.isHandlerEnabledForOrg(type, org)) return;

    updateHandlerOrgs(type, orgId, false);
  };

  return Object.freeze(self);
};

/**
 *
 * @param configuration
 * @returns {any}
 */

export const checkConfiguration = (configuration) => {
  const schema = Joi.object({
    version: Joi.string().required(),
    queues: Joi.object().required(),
    handlers: Joi.object().pattern(Joi.string(), Joi.object(
      {
        enabled: Joi.object({
          sites: Joi.array().items(Joi.string()),
          orgs: Joi.array().items(Joi.string()),
        }),
        disabled: Joi.object({
          sites: Joi.array().items(Joi.string()),
          orgs: Joi.array().items(Joi.string()),
        }),
        enabledByDefault: Joi.boolean().required(),
        dependencies: Joi.array().items(Joi.object(
          {
            handler: Joi.string(),
            actions: Joi.array().items(Joi.string()),
          },
        )),
      },
    )),
    jobs: Joi.array().required(),
  }).unknown(true);
  const { error, value } = schema.validate(configuration);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value; // Validated and sanitized configuration
};

/**
 * Creates a new Configuration.
 *
 * @param {object} data - configuration data
 * @returns {Readonly<Configuration>} configuration - new configuration
 */
export const createConfiguration = (data) => {
  const value = checkConfiguration(data);
  const newState = { ...value };
  return Configuration(newState);
};
