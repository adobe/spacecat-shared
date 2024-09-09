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
import { ImportUrlStatus } from './import-constants.js';

/**
 * Creates a new ImportUrl object
 *
 * @param {Object} data
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
   * Updates the state of the ImportJob.
   * @param key - The key to update.
   * @param value - The new value.
   * @param validator - An optional validation function to use before updating the value.
   * The validator can return false to indicate that the value isn't worth throwing an exception,
   * but continue to use the previous value.
   */
  const updateState = (key, value, validator) => {
    if (validator && typeof validator === 'function') {
      // a validator can return true or false to indicate if the value is valid
      // however if a validator throws an error, it is considered critical and invalid.
      if (!validator(value)) {
        return self;
      }
    }

    self.state[key] = value;
    self.touch();

    return self;
  };

  /**
   * Updates the status of the ImportUrl
   */
  self.setStatus = (status) => updateState('status', status, (value) => {
    if (!ImportUrlStatus[value]) {
      throw new Error(`Invalid Import URL status during update: ${value}`);
    }
    return true;
  });

  /**
   * Updates the reason that the import of this URL was not successful.
   */
  self.setReason = (reason) => updateState('reason', reason, hasText);

  /**
   * Updates the path of the ImportUrl
   */
  self.setPath = (path) => updateState('path', path, hasText);

  /**
   * Updates the file of the ImportUrl. This is the path and file name of the file which
   * was imported.
   */
  self.setFile = (file) => updateState('file', file, hasText);

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

  if (!Object.values(ImportUrlStatus).includes(newState.status)) {
    throw new Error(`Invalid Import URL status: ${newState.status}`);
  }

  return ImportUrl(newState);
};
