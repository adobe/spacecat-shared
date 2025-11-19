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

import { isNonEmptyObject, isNonEmptyArray } from '@adobe/spacecat-shared-utils';

import { sanitizeIdAndAuditFields } from '../../util/util.js';
import BaseModel from '../base/base.model.js';
import { Entitlement } from '../entitlement/index.js';

/**
 * Configuration - A class representing an Configuration entity.
 * Provides methods to access and manipulate Configuration-specific data.
 *
 * @class Configuration
 * @extends BaseModel
 */
class Configuration extends BaseModel {
  static JOB_GROUPS = {
    AUDITS: 'audits',
    IMPORTS: 'imports',
    REPORTS: 'reports',
    SCRAPES: 'scrapes',
  };

  static JOB_INTERVALS = {
    NEVER: 'never', // allows to enable imports without scheduling them.
    EVERY_HOUR: 'every-hour',
    TWENTY_PAST: 'twenty-past',
    DAILY: 'daily',
    DAILY_1AM: 'daily-1am',
    WEEKLY: 'weekly',
    EARLY_MONDAY: 'early-monday',
    EVERY_SATURDAY: 'every-saturday',
    EVERY_SUNDAY: 'every-sunday',
    FORTNIGHTLY: 'fortnightly',
    FORTNIGHTLY_SATURDAY: 'fortnightly-saturday',
    FORTNIGHTLY_SUNDAY: 'fortnightly-sunday',
    MONTHLY: 'monthly',
  };

  static AUDIT_NAME_REGEX = /^[a-z0-9-]+$/;

  static AUDIT_NAME_MAX_LENGTH = 37;

  // add your custom methods or overrides here

  getHandler(type) {
    return this.getHandlers()?.[type];
  }

  addHandler = (type, handlerData) => {
    const handlers = this.getHandlers() || {};
    handlers[type] = { ...handlerData };

    this.setHandlers(handlers);
  };

  getSlackRoleMembersByRole(role) {
    return this.getSlackRoles()?.[role] || [];
  }

  getEnabledSiteIdsForHandler(type) {
    return this.getHandler(type)?.enabled?.sites || [];
  }

  getEnabledAuditsForSite(site) {
    const enabledHandlers = new Set(
      Object.keys(this.getHandlers() || {})
        .filter((handler) => this.isHandlerEnabledForSite(handler, site)),
    );

    return (this.getJobs() || [])
      .filter((job) => job.group === 'audits' && enabledHandlers.has(job.type))
      .map((job) => job.type);
  }

  getDisabledAuditsForSite(site) {
    const disabledHandlers = new Set(
      Object.keys(this.getHandlers() || {})
        .filter((handler) => !this.isHandlerEnabledForSite(handler, site)),
    );

    return (this.getJobs() || [])
      .filter((job) => job.group === 'audits' && disabledHandlers.has(job.type))
      .map((job) => job.type);
  }

  isHandlerEnabledForSite(type, site) {
    const handler = this.getHandlers()?.[type];
    if (!handler) return false;

    const siteId = site.getId();
    const orgId = site.getOrganizationId();

    if (handler.disabled) {
      const sites = handler.disabled.sites || [];
      const orgs = handler.disabled.orgs || [];
      if (sites.includes(siteId) || orgs.includes(orgId)) {
        return false;
      }
    }

    if (handler.enabledByDefault) {
      return true;
    }
    if (handler.enabled) {
      const sites = handler.enabled.sites || [];
      const orgs = handler.enabled.orgs || [];
      return sites.includes(siteId) || orgs.includes(orgId);
    }

    return false;
  }

  isHandlerEnabledForOrg(type, org) {
    const handler = this.getHandlers()?.[type];
    if (!handler) return false;

    const orgId = org.getId();

    if (handler.disabled && handler.disabled.orgs?.includes(orgId)) {
      return false;
    }

    if (handler.enabledByDefault) {
      return true;
    }

    if (handler.enabled) {
      return handler.enabled.orgs?.includes(orgId);
    }

    return false;
  }

  #updatedHandler(type, entityId, enabled, entityKey) {
    const handlers = this.getHandlers();
    const handler = handlers?.[type];

    if (!isNonEmptyObject(handler)) return;

    if (!isNonEmptyObject(handler.disabled)) {
      handler.disabled = { orgs: [], sites: [] };
    }

    if (!isNonEmptyObject(handler.enabled)) {
      handler.enabled = { orgs: [], sites: [] };
    }

    if (enabled) {
      if (handler.enabledByDefault) {
        handler.disabled[entityKey] = handler.disabled[entityKey]
          .filter((id) => id !== entityId) || [];
      } else {
        handler.enabled[entityKey] = Array
          .from(new Set([...(handler.enabled[entityKey] || []), entityId]));
      }
    } else if (handler.enabledByDefault) {
      handler.disabled[entityKey] = Array
        .from(new Set([...(handler.disabled[entityKey] || []), entityId]));
    } else {
      handler.enabled[entityKey] = handler.enabled[entityKey].filter((id) => id !== entityId) || [];
    }

    handlers[type] = handler;
    this.setHandlers(handlers);
  }

  updateHandlerOrgs(type, orgId, enabled) {
    this.#updatedHandler(type, orgId, enabled, 'orgs');
  }

  updateHandlerSites(type, siteId, enabled) {
    this.#updatedHandler(type, siteId, enabled, 'sites');
  }

  enableHandlerForSite(type, site) {
    const siteId = site.getId();
    if (this.isHandlerEnabledForSite(type, site)) return;

    const deps = this.isHandlerDependencyMetForSite(type, site);
    if (deps !== true) {
      throw new Error(`Cannot enable handler ${type} for site ${siteId} because of missing dependencies: ${deps}`);
    }

    this.updateHandlerSites(type, siteId, true);
  }

  /**
   * Check if all dependencies for a handler of given type are met for the given org.
   *
   * @param {string} type handler type
   * @param {object} org org object
   * @returns true if all dependencies are met, array with missing dependencies otherwise
   */
  isHandlerDependencyMetForOrg(type, org) {
    const handler = this.getHandler(type);

    if (!handler || !isNonEmptyArray(handler?.dependencies)) return true;

    const unmetDependencies = handler.dependencies
      .filter(({ handler: depHandler }) => !this.isHandlerEnabledForOrg(depHandler, org))
      .map(({ handler: depHandler }) => depHandler);

    return isNonEmptyArray(unmetDependencies) ? unmetDependencies : true;
  }

  /**
   * Check if all dependencies for a handler of given type are met for the given site.
   *
   * @param {string} type handler type
   * @param {object} site site object
   * @returns true if all dependencies are met, array with missing dependencies otherwise
   */
  isHandlerDependencyMetForSite(type, site) {
    const handler = this.getHandler(type);
    if (!handler || !isNonEmptyArray(handler?.dependencies)) return true;

    const unmetDependencies = handler.dependencies
      .filter(({ handler: depHandler }) => !this.isHandlerEnabledForSite(depHandler, site))
      .map(({ handler: depHandler }) => depHandler);

    return isNonEmptyArray(unmetDependencies) ? unmetDependencies : true;
  }

  enableHandlerForOrg(type, org) {
    const orgId = org.getId();
    if (this.isHandlerEnabledForOrg(type, org)) return;
    const deps = this.isHandlerDependencyMetForOrg(type, org);
    if (deps !== true) {
      throw new Error(`Cannot enable handler ${type} for org ${orgId} because of missing dependencies: ${deps}`);
    }

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

  /**
   * Updates the queue URLs configuration by merging with existing queues.
   * Only the specified queue URLs will be updated; others remain unchanged.
   *
   * @param {object} queues - Queue URLs to update (merged with existing)
   * @throws {Error} If queues object is empty or invalid
   */
  updateQueues(queues) {
    if (!isNonEmptyObject(queues)) {
      throw new Error('Queues configuration cannot be empty');
    }
    const existingQueues = this.getQueues() || {};
    const mergedQueues = { ...existingQueues, ...queues };
    this.setQueues(mergedQueues);
  }

  /**
   * Updates a job's properties (interval, group).
   *
   * @param {string} type - The job type to update
   * @param {object} properties - Properties to update (interval, group)
   * @throws {Error} If job not found or properties are invalid
   */
  updateJob(type, properties) {
    const jobs = this.getJobs();
    const jobIndex = jobs.findIndex((job) => job.type === type);

    if (jobIndex === -1) {
      throw new Error(`Job type "${type}" not found in configuration`);
    }

    if (properties.interval && !Object.values(Configuration.JOB_INTERVALS)
      .includes(properties.interval)) {
      throw new Error(`Invalid interval "${properties.interval}". Must be one of: ${Object.values(Configuration.JOB_INTERVALS).join(', ')}`);
    }

    if (properties.group && !Object.values(Configuration.JOB_GROUPS).includes(properties.group)) {
      throw new Error(`Invalid group "${properties.group}". Must be one of: ${Object.values(Configuration.JOB_GROUPS).join(', ')}`);
    }

    jobs[jobIndex] = { ...jobs[jobIndex], ...properties };
    this.setJobs(jobs);
  }

  /**
   * Updates a handler's properties.
   *
   * @param {string} type - The handler type to update
   * @param {object} properties - Properties to update
   * @throws {Error} If handler not found or properties are invalid
   */
  updateHandlerProperties(type, properties) {
    const handlers = this.getHandlers();
    if (!handlers[type]) {
      throw new Error(`Handler "${type}" not found in configuration`);
    }

    if (properties.productCodes !== undefined) {
      if (!isNonEmptyArray(properties.productCodes)) {
        throw new Error('productCodes must be a non-empty array');
      }
      const validProductCodes = Object.values(Entitlement.PRODUCT_CODES);
      if (!properties.productCodes.every((pc) => validProductCodes.includes(pc))) {
        throw new Error('Invalid product codes provided');
      }
    }

    if (isNonEmptyArray(properties.dependencies)) {
      for (const dep of properties.dependencies) {
        if (!handlers[dep.handler]) {
          throw new Error(`Dependency handler "${dep.handler}" does not exist in configuration`);
        }
      }
    }

    if (properties.movingAvgThreshold !== undefined && properties.movingAvgThreshold < 1) {
      throw new Error('movingAvgThreshold must be greater than or equal to 1');
    }

    if (properties.percentageChangeThreshold !== undefined && properties
      .percentageChangeThreshold < 1) {
      throw new Error('percentageChangeThreshold must be greater than or equal to 1');
    }

    handlers[type] = { ...handlers[type], ...properties };
    this.setHandlers(handlers);
  }

  /**
   * Updates the configuration by merging changes into existing sections.
   * This is a flexible update method that allows updating one or more sections at once.
   * Changes are merged, not replaced - existing data is preserved.
   *
   * @param {object} data - Configuration data to update
   * @param {object} [data.handlers] - Handlers to merge (adds new, updates existing)
   * @param {Array} [data.jobs] - Jobs to merge (updates matching jobs by type)
   * @param {object} [data.queues] - Queues to merge (updates specific queue URLs)
   * @throws {Error} If validation fails
   */
  updateConfiguration(data) {
    if (!isNonEmptyObject(data)) {
      throw new Error('Configuration data cannot be empty');
    }

    if (data.handlers !== undefined) {
      if (!isNonEmptyObject(data.handlers)) {
        throw new Error('Handlers must be a non-empty object if provided');
      }
      const existingHandlers = this.getHandlers() || {};
      const mergedHandlers = { ...existingHandlers };

      Object.keys(data.handlers).forEach((handlerType) => {
        mergedHandlers[handlerType] = {
          ...existingHandlers[handlerType],
          ...data.handlers[handlerType],
        };
      });

      this.setHandlers(mergedHandlers);
    }

    if (data.jobs !== undefined) {
      if (!isNonEmptyArray(data.jobs)) {
        throw new Error('Jobs must be a non-empty array if provided');
      }
      const existingJobs = this.getJobs() || [];
      const mergedJobs = [...existingJobs];

      data.jobs.forEach((newJob) => {
        const existingIndex = mergedJobs.findIndex(
          (job) => job.type === newJob.type && job.group === newJob.group,
        );

        if (existingIndex !== -1) {
          mergedJobs[existingIndex] = { ...mergedJobs[existingIndex], ...newJob };
        } else {
          mergedJobs.push(newJob);
        }
      });

      this.setJobs(mergedJobs);
    }

    if (data.queues !== undefined) {
      if (!isNonEmptyObject(data.queues)) {
        throw new Error('Queues must be a non-empty object if provided');
      }
      const existingQueues = this.getQueues() || {};
      const mergedQueues = { ...existingQueues, ...data.queues };

      this.setQueues(mergedQueues);
    }
  }

  registerAudit(
    type,
    enabledByDefault = false,
    interval = Configuration.JOB_INTERVALS.NEVER,
    productCodes = [],
  ) {
    if (!type || typeof type !== 'string' || type.trim() === '') {
      throw new Error('Audit type must be a non-empty string');
    }

    if (type.length > Configuration.AUDIT_NAME_MAX_LENGTH) {
      throw new Error(`Audit type must not exceed ${Configuration.AUDIT_NAME_MAX_LENGTH} characters`);
    }
    if (!Configuration.AUDIT_NAME_REGEX.test(type)) {
      throw new Error('Audit type can only contain lowercase letters, numbers, and hyphens');
    }

    const handlers = this.getHandlers();
    if (handlers && handlers[type]) {
      throw new Error(`Audit type "${type}" is already registered`);
    }

    if (!Object.values(Configuration.JOB_INTERVALS).includes(interval)) {
      throw new Error(`Invalid interval ${interval}`);
    }

    if (!isNonEmptyArray(productCodes)) {
      throw new Error('No product codes provided');
    }
    if (!productCodes.every((pc) => Object.values(Entitlement.PRODUCT_CODES).includes(pc))) {
      throw new Error('Invalid product codes provided');
    }

    const updatedHandlers = handlers || {};
    updatedHandlers[type] = {
      enabledByDefault,
      enabled: {
        sites: [],
        orgs: [],
      },
      disabled: {
        sites: [],
        orgs: [],
      },
      dependencies: [],
      productCodes,
    };
    this.setHandlers(updatedHandlers);

    const jobs = this.getJobs();
    const exists = jobs.find((job) => job.group === 'audits' && job.type === type);
    if (!exists) {
      jobs.push({
        group: 'audits',
        type,
        interval,
      });
      this.setJobs(jobs);
    }
  }

  unregisterAudit(type) {
    if (!type || typeof type !== 'string' || type.trim() === '') {
      throw new Error('Audit type must be a non-empty string');
    }

    const handlers = this.getHandlers();
    if (!handlers || !handlers[type]) {
      throw new Error(`Audit type "${type}" is not registered`);
    }

    delete handlers[type];
    this.setHandlers(handlers);

    const jobs = this.getJobs();
    const jobIndex = jobs.findIndex((job) => job.group === 'audits' && job.type === type);
    if (jobIndex !== -1) {
      jobs.splice(jobIndex, 1);
      this.setJobs(jobs);
    }
  }

  async save() {
    return this.collection.create(sanitizeIdAndAuditFields(this.constructor.name, this.toJSON()));
  }
}

export default Configuration;
