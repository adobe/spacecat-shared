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

import { hasText, isValidUrl } from '@adobe/spacecat-shared-utils';
import { Base } from '../base.js';
import { ImportJobStatus } from './import-job.js';

export const ImportUrlStatus = {
  PENDING: 'PENDING',
  REDIRECT: 'REDIRECT',
  ...ImportJobStatus,
};

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
  self.getReason = () => self.state.reason;
  // Absolute path to the resource that is being imported for the given URL
  self.getPath = () => self.state.path;
  // Resulting path and filename of the imported .docx file
  self.getFile = () => self.state.file;

  /**
   * Updates the status of the ImportUrl
   */
  self.setStatus = (status) => {
    if (!Object.values(ImportUrlStatus).includes(status)) {
      throw new Error(`Invalid Import URL status during update: ${status}`);
    }

    self.state.status = status;
    self.touch();

    return self;
  };

  /**
   * Updates the reason that the import of this URL was not successful
   */
  self.setReason = (reason) => {
    if (!hasText(reason)) {
      return self; // no-op
    }

    self.state.reason = reason;
    self.touch();
    return self;
  };

  /**
   * Updates the path of the ImportUrl
   */
  self.setPath = (path) => {
    if (!hasText(path)) {
      return self; // no-op
    }

    self.state.path = path;
    self.touch();
    return self;
  };

  /**
   * Updates the file of the ImportUrl. This is the path and file name of the file which
   * was imported.
   */
  self.setFile = (file) => {
    if (!hasText(file)) {
      return self; // no-op
    }

    self.state.file = file;
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

  if (!hasText(newState.jobId)) {
    throw new Error(`Invalid Job ID: ${newState.jobId}`);
  }

  if (!Object.values(ImportUrlStatus).includes(newState.status)) {
    throw new Error(`Invalid Import URL status: ${newState.status}`);
  }

  return ImportUrl(newState);
};
