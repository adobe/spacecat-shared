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

import { hasText, isObject } from '@adobe/spacecat-shared-utils';

import { Base } from './base.js';
import { Config, DEFAULT_CONFIG } from './site/config.js';

export const DEFAULT_ORGANIZATION_ID = 'default';

/**
 * Creates a new Organization.
 *
 * @param {object} data - organization data
 * @returns {Readonly<Organization>} organization - new organization
 */
const Organization = (data = {}) => {
  const self = Base(data);

  self.getAuditConfig = () => self.state.config.audits;
  self.getConfig = () => self.state.config;
  self.getName = () => self.state.name;
  self.getImsOrgId = () => self.state.imsOrgId;
  self.getFulfillableItems = () => self.state.fulfillableItems;

  self.setAllAuditsDisabled = (disabled) => {
    self.state.config.audits.updateAuditsDisabled(disabled);
    self.touch();
    return self;
  };

  self.updateAuditTypeConfig = (type, config) => {
    self.state.config.audits.updateAuditTypeConfig(type, config);
    self.touch();
    return self;
  };

  /**
     * Updates the IMS Org ID belonging to the organization.
     * @param {string} imsOrgId - The IMS Org ID.
     * @return {Base} The updated organization.
     */
  self.updateImsOrgId = (imsOrgId) => {
    if (!hasText(imsOrgId)) {
      throw new Error('IMS Org ID must be provided');
    }

    self.state.imsOrgId = imsOrgId;
    self.touch();

    return self;
  };

  /**
 * Updates the organization name.
 * @param {string} name - The name of the organization.
 * @return {Base} The updated organization.
 */
  self.updateName = (name) => {
    if (!hasText(name)) {
      throw new Error('Org name must be provided');
    }

    self.state.name = name;
    self.touch();

    return self;
  };

  /**
 * Updates the organization config.
 * @param {string} config - The Org config.
 * @return {Base} The updated organization.
 */
  self.updateConfig = (config) => {
    if (!isObject(config)) {
      throw new Error('Config must be provided');
    }

    self.state.config = Config.toDynamoItem(config);
    self.touch();

    return self;
  };

  self.updateFulfillableItems = (fulfillableItems) => {
    if (!isObject(fulfillableItems)) {
      throw new Error('Fulfillable items object must be provided');
    }

    self.state.fulfillableItems = fulfillableItems;
    self.touch();

    return self;
  };

  return Object.freeze(self);
};

/**
 * Creates a new Organization.
 *
 * @param {object} data - organization data
 * @returns {Readonly<Organization>} organization - new organization
 */
export const createOrganization = (data) => {
  const newState = { ...data };

  if (!isObject(newState.config)) {
    newState.config = { ...DEFAULT_CONFIG };
  }

  if (!hasText(newState.name)) {
    throw new Error('Org name must be provided');
  }

  if (!hasText(newState.imsOrgId)) {
    newState.imsOrgId = DEFAULT_ORGANIZATION_ID;
  }

  newState.config = Config(newState.config);

  return Organization(newState);
};
