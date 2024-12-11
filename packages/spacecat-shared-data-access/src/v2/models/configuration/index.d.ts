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

import type {
  BaseCollection, BaseModel, Organization, Site,
} from '../index';

export interface Configuration extends BaseModel {
  /**
   * Retrieves the configuration version.
   * @returns {number} The configuration version.
   */
  getVersion: () => number;

  /**
   * Retrieves the queues configuration.
   * @returns {object} The queues configuration.
   */
  getQueues: () => object;

  /**
   * Retrieves the jobs configuration.
   * @returns {Array} The jobs configurations.
   */
  getJobs: () => Array<object>;

  /**
   * Retrieves the handlers configuration.
   * @returns {object} The handlers configuration.
   */
  getHandlers: () => object;

  /**
   * Retrieves the handler configuration for handler type.
   * @param type The handler type.
   * @returns {object} The handler type configuration.
   */
  getHandler: (type) => object;

  /**
   * Retrieves the slack roles configuration.
   * @returns {object} The slack roles configuration.
   */
  getSlackRoles: () => object;

  /**
   * Return true if a handler type is enabled for an organization.
   * @param type handler type
   * @param org organization
   */
  isHandlerEnabledForOrg: (type: string, org: Organization) => boolean;

  /**
   * Return true if a handler type is enabled for a site.
   * @param type handler type
   * @param site site
   */
  isHandlerEnabledForSite: (type: string, site: Site) => boolean;

  /**
   * Enables a handler type for an site.
   * @param type handler type
   * @param site site
   */
  enableHandlerForSite: (type: string, site: Site) => void;

  /**
   * Enables a handler type for an organization.
   * @param type handler type
   * @param org organization
   */
  enableHandlerForOrg: (type: string, org: Organization) => void;

  /**
   * Disables a handler type for an site.
   * @param type handler type
   * @param site site
   */
  disableHandlerForSite: (type: string, site: Site) => void;

  /**
   * Disables a handler type for an organization.
   * @param type handler type
   * @param org organization
   */
  disableHandlerForOrg: (type:string, org: Organization) => void;
}

export interface ConfigurationCollection extends BaseCollection<Configuration> {
  /**
   * Retrieves the latest configuration by version.
   * @returns {Configuration} The configuration.
   */
  findLatest: () => Configuration;

  /**
   * Retrieves the configuration by version.
   * @param version The configuration version.
   * @returns {Configuration} The configuration.
   */
  findByVersion: (version: number) => Configuration;
}
