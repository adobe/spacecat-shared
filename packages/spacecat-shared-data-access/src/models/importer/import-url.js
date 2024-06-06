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

import { isValidUrl } from '@adobe/spacecat-shared-utils';
import { Base } from '../base.js';
import { IMPORT_JOB_STATUS } from './import-job.js';

/**
 * Creates a new ImportUrl object
 *
 * @param {Object} importUrlData
 * @returns {ImportUrl}
 */
const ImportUrl = (data) => {
  const self = Base(data);

  self.getJobId = () => self.state.jobId;
  self.getUrl = () => self.state.url;
  self.getStatus = () => self.state.status;

  /**
     * Updates the status of the ImportUrl
     */
  self.updateStatus = (status) => {
    if (!Object.values(IMPORT_JOB_STATUS).includes(status)) {
      throw new Error(`Invalid Import URL status during update: ${status}`);
    }

    self.state.status = status;
    self.touch();

    return self;
  };
  return Object.freeze(self);
};

/**
 * Creates a new ImportUrl object
 */
export const createImportUrl = (data) => {
  const newState = { ...data };

  if (!isValidUrl(newState.url)) {
    throw new Error(`Invalid Url: ${newState.url}`);
  }

  if (!Object.values(IMPORT_JOB_STATUS).includes(newState.status)) {
    throw new Error(`Invalid Import URL status: ${newState.status}`);
  }

  return ImportUrl(newState);
};
