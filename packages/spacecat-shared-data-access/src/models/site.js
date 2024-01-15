/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { isObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { Base } from './base.js';
import AuditConfig from './site/audit-config.js';
import Config from './site/config.js';

/**
 * Creates a new Site.
 *
 * @param {object} data - site data
 * @returns {Readonly<Site>} site - new site
 */
const Site = (data = {}) => {
  const self = Base(data);

  self.getAuditConfig = () => self.state.auditConfig;
  self.getAudits = () => self.state.audits;
  self.getBaseURL = () => self.state.baseURL;
  self.getGitHubURL = () => self.state.gitHubURL;
  self.getOrganizationId = () => self.state.organizationId;
  self.isLive = () => self.state.isLive;

  // TODO: updating the baseURL is not supported yet, it will require a transact write
  //  on dynamodb (put then delete) since baseURL is part of the primary key, something like:
  // const updateSiteBaseURL = async (oldBaseURL, updatedSiteData) => {
  //   const params = {
  //     TransactItems: [
  //       {
  //         Put: {
  //           TableName: 'YourSiteTableName',
  //           Item: updatedSiteData,
  //         },
  //       },
  //       {
  //         Delete: {
  //           TableName: 'YourSiteTableName',
  //           Key: {
  //             baseURL: oldBaseURL,
  //           },
  //         },
  //       },
  //     ],
  //   };
  //
  //   await dynamoDbClient.transactWrite(params).promise();
  //
  //   return createSite(updatedSiteData);
  // };
  /*  self.updateBaseURL = (baseURL) => {
    if (!isValidUrl(baseURL)) {
      throw new Error('Base URL must be a valid URL');
    }

    self.state.baseURL = baseURL;
    self.touch();

    return self;
  }; */

  self.setAllAuditsDisabled = (disabled) => {
    self.state.auditConfig.updateAuditsDisabled(disabled);
    self.touch();
    return self;
  };

  self.updateAuditTypeConfig = (type, config) => {
    self.state.auditConfig.updateAuditTypeConfig(type, config);
    self.touch();
    return self;
  };

  /**
   * Updates the GitHub URL belonging to the site.
   * @param {string} gitHubURL - The GitHub URL.
   * @return {Base} The updated site.
   */
  self.updateGitHubURL = (gitHubURL) => {
    if (!isValidUrl(gitHubURL)) {
      throw new Error('GitHub URL must be a valid URL');
    }

    self.state.gitHubURL = gitHubURL;
    self.touch();

    return self;
  };

  /**
   * Updates the organizationId the site belongs to.
   * @param {string} organizationId - The Org ID.
   * @return {Base} The organization site.
   */
  self.updateOrganizationId = (organizationId) => {
    self.state.organizationId = organizationId;
    self.touch();

    return self;
  };

  self.setAudits = (audits) => {
    self.state.audits = audits;
    return self;
  };

  /**
   * Sets whether the site is live.
   * @return {Base} The updated site.
   */
  self.toggleLive = () => {
    self.state.isLive = !self.state.isLive;
    return self;
  };

  return Object.freeze(self);
};

/**
 * Creates a new Site.
 *
 * @param {object} data - site data
 * @returns {Readonly<Site>} site - new site
 */
export const createSite = (data) => {
  const newState = { ...data };

  if (!isValidUrl(newState.baseURL)) {
    throw new Error('Base URL must be a valid URL');
  }

  if (!Object.prototype.hasOwnProperty.call(newState, 'isLive')) {
    newState.isLive = false;
  }

  if (!Array.isArray(newState.audits)) {
    newState.audits = [];
  }

  if (!isObject(newState.auditConfig)) {
    newState.auditConfig = {
      auditsDisabled: false,
      auditTypeConfigs: {},
    };
  }

  newState.auditConfig = AuditConfig(newState.auditConfig);

  if (!isObject(newState.config)) {
    newState.config = {
      slack: {
      },
      alerts: {
      },
    };
  }

  newState.config = Config(newState.config);

  return Site(newState);
};
