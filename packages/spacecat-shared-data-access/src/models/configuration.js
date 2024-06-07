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
self.isHandlerTypeEnabledForSite = (type, site) => {
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

  self.isHandlerTypeEnabledForOrg = (type, org) => {
    if (self.handlers[type]?.enabled) {
      return self.handlers[type].enabled.orgs.includes(org.getId());
    } else if (self.handlers[type]?.disabled) {
      return !self.handlers[type].disabled.orgs.includes(org.getId());
    }
    return self.handlers[type].enabledByDefault;
  };

  self.enableHandlerTypeForSite = (type, site) => {
    const isEnabled = self.isHandlerTypeEnabledForSite(type, site);
    if (isEnabled) {
      return;
    }
    if (self.handlers[type]?.enabledByDefault) {
      if (self.handlers[type]?.disabled?.sites) {
        self.handlers[type].disabled.sites = self.handlers[type].disabled.sites.filter(
          (id) => id !== site.getId(),
        );
      } else {
        self.handlers[type].disabled = { sites: [site.getId()] };
      }
    } else if (self.handlers[type]?.enabled?.sites) {
      self.handlers[type]?.enabled.sites.push(site.getId());
    } else {
      self.handlers[type].enabled = { sites: [site.getId()] };
    }
  };

  self.enableHandlerTypeForOrg = (type, org) => {
    const isEnabled = self.isHandlerTypeEnabledForOrg(type, org);
    if (isEnabled) {
      return;
    }
    if (self.handlers[type]?.enabledByDefault) {
      if (self.handlers[type]?.disabled?.orgs) {
        self.handlers[type].disabled.orgs = self.handlers[type]?.disabled.orgs.filter(
          (id) => id !== org.getId(),
        );
      } else {
        self.handlers[type].disabled = { orgs: [org.getId()] };
      }
    } else if (self.handlers[type]?.enabled?.orgs) {
      self.handlers[type]?.enabled.orgs.push(org.getId());
    } else {
      self.handlers[type].enabled = { orgs: [org.getId()] };
    }
  };

  self.disableHandlerTypeForSite = (type, site) => {
    const isEnabled = self.isHandlerTypeEnabledForSite(type, site);
    if (!isEnabled) {
      return;
    }
    if (self.handlers[type]?.enabledByDefault) {
      if (self.handlers[type]?.enabled?.sites) {
        self.handlers[type].enabled.sites = self.handlers[type]?.enabled.sites.filter(
          (id) => id !== site.getId(),
        );
      }
    } else if (self.handlers[type]?.disabled?.sites) {
      self.handlers[type]?.disabled.sites.push(site.getId());
    } else {
      self.handlers[type].disabled = { sites: [site.getId()] };
    }
  };

  self.disableHandlerTypeForOrg = (type, org) => {
    const isEnabled = self.isHandlerTypeEnabledForOrg(type, org);
    if (!isEnabled) {
      return;
    }
    if (self.handlers[type]?.enabledByDefault) {
      if (self.handlers[type]?.enabled?.orgs) {
        self.handlers[type].enabled.orgs = self.handlers[type]?.enabled.orgs.filter(
          (id) => id !== org.getId(),
        );
      }
    } else if (self.handlers[type]?.disabled?.orgs) {
      self.handlers[type]?.disabled.orgs.push(org.getId());
    } else {
      self.handlers[type].disabled = { orgs: [org.getId()] };
    }
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
