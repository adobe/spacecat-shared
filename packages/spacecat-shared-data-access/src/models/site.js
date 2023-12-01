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

import { hasText, isValidUrl } from '@adobe/spacecat-shared-utils';
import { Base } from './base.js';

/**
 * Creates a new Site.
 *
 * @param {object} data - site data
 * @returns {Readonly<Site>} site - new site
 */
const Site = (data = {}) => {
  const self = Base(data);

  self.getAudits = () => self.state.audits;
  self.getBaseURL = () => self.state.baseURL;
  self.getImsOrgId = () => self.state.imsOrgId;

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

  self.updateImsOrgId = (imsOrgId) => {
    if (!hasText(imsOrgId)) {
      throw new Error('IMS Org ID must be provided');
    }

    self.state.imsOrgId = imsOrgId;
    self.touch();

    return self;
  };

  self.setAudits = (audits) => {
    self.state.audits = audits;
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

  if (!Array.isArray(newState.audits)) {
    newState.audits = [];
  }

  return Site(newState);
};
