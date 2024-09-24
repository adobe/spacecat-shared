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

import {
  hasText, isIsoDate, isValidUrl, isObject, isString, isNumber, isInteger,
} from '@adobe/spacecat-shared-utils';
import { Base } from '../base.js';
import { ImportJobStatus, ImportOptions } from './import-constants.js';

/**
 * Creates a new ImportJob object.
 *
 * @param {Object} data - The data for the ImportJob object.
 * @returns {ImportJob} The new ImportJob object.
 */
const ImportJob = (data) => {
  const self = Base(data);

  // generate get methods for all properties of our base object
  self.getBaseURL = () => self.state.baseURL;
  self.getHashedApiKey = () => self.state.hashedApiKey;
  self.getOptions = () => self.state.options;
  self.getStartTime = () => self.state.startTime;
  self.getEndTime = () => self.state.endTime;
  self.getDuration = () => self.state.duration;
  self.getStatus = () => self.state.status;
  self.getUrlCount = () => self.state.urlCount;
  self.getSuccessCount = () => self.state.successCount;
  self.getFailedCount = () => self.state.failedCount;
  self.getRedirectCount = () => self.state.redirectCount;
  self.getImportQueueId = () => self.state.importQueueId;
  self.getInitiatedBy = () => self.state.initiatedBy;

  /**
   * Updates the state of the ImportJob.
   * @param key - The key to update.
   * @param value - The new value.
   * @param validator - An optional validation function to use before updating the value.
   * @returns {ImportJob} The updated ImportJob object.
   */
  const updateState = (key, value, validator) => {
    if (validator && typeof validator === 'function') {
      validator(value);
    }

    self.state[key] = value;
    self.touch();

    return self;
  };

  /**
   * Updates the end time of the ImportJob.
   * @param {string} endTime - The new end time in JavaScript ISO date string in Zulu (UTC)
   * timezone. eg. 2024-05-29T14:36:00.000Z.
   */
  self.updateEndTime = (endTime) => updateState('endTime', endTime, (value) => {
    if (!isIsoDate(value)) {
      throw new Error(`Invalid end time during update: ${endTime}`);
    }
  });

  /**
   * Updates the duration of the ImportJob.
   * @param {number} duration - The new duration.
   */
  self.updateDuration = (duration) => updateState('duration', duration, (value) => {
    if (!isNumber(value)) {
      throw new Error(`Invalid duration during update: ${value}`);
    }
  });

  /**
   * Updates the status of the ImportJob.
   * @param {string} status - The new status.
   */
  self.updateStatus = (status) => updateState('status', status, (value) => {
    if (!Object.values(ImportJobStatus).includes(value)) {
      throw new Error(`Invalid Import Job status during update: ${value}`);
    }
  });

  /**
   * Updates the Url count of the ImportJob
   * @param {number} urlCount - The new url count.
   */
  self.updateUrlCount = (urlCount) => updateState('urlCount', urlCount, (value) => {
    if (!isInteger(value)) {
      throw new Error(`Invalid url count during update: ${value}`);
    }
  });

  /**
   * Updates the success count of the ImportJob.
   * @param {number} successCount - The new success count.
   * @returns {ImportJob} The updated ImportJob object.
   */
  self.updateSuccessCount = (successCount) => updateState('successCount', successCount, (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid success count during update: ${value}`);
    }
  });

  /**
   * Updates the failed count of the ImportJob.
   * @param {number} failedCount - The new failed count.
   * @returns {ImportJob} The updated ImportJob object.
   */
  self.updateFailedCount = (failedCount) => updateState('failedCount', failedCount, (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid failed count during update: ${value}`);
    }
  });

  /**
   * Updates the redirect count of the ImportJob.
   * @param {number} redirectCount - The new redirect count.
   * @returns {ImportJob} The updated ImportJob object.
   */
  self.updateRedirectCount = (redirectCount) => updateState('redirectCount', redirectCount, (value) => {
    if (!isInteger(value) || value < 0) {
      throw new Error(`Invalid redirect count during update: ${value}`);
    }
  });

  /**
   * Updates the import queue id of the ImportJob.
   * @param {string} importQueueId - The new import queue id.
   * @returns {ImportJob} The updated ImportJob object.
   */
  self.updateImportQueueId = (importQueueId) => updateState(
    'importQueueId',
    importQueueId,
    (value) => {
      if (!hasText(importQueueId)) {
        throw new Error(`Invalid import queue id during update: ${value}`);
      }
    },
  );

  return Object.freeze(self);
};

/**
 * Creates a new ImportJob object.
 * @param {Object} data - The data for the ImportJob object.
 * @returns {ImportJob} The new ImportJob object.
 */
export const createImportJob = (data) => {
  // Define a list of data type validators for each import option
  const ImportOptionTypeValidator = {
    [ImportOptions.ENABLE_JAVASCRIPT]: (value) => {
      if (value !== true && value !== false) {
        throw new Error(`Invalid value for ${ImportOptions.ENABLE_JAVASCRIPT}: ${value}`);
      }
    },
    [ImportOptions.PAGE_LOAD_TIMEOUT]: (value) => {
      if (!isInteger(value) || value < 0) {
        throw new Error(`Invalid value for ${ImportOptions.PAGE_LOAD_TIMEOUT}: ${value}`);
      }
    },
  };

  const newState = { ...data };

  // set default values for the start time if one is not provided
  if (!hasText(newState.startTime)) {
    newState.startTime = new Date().toISOString();
  }

  if (!isValidUrl(newState.baseURL)) {
    throw new Error(`Invalid base URL: ${newState.baseURL}`);
  }

  if (!isString(newState.hashedApiKey)) {
    throw new Error(`Invalid API key: ${newState.hashedApiKey}`);
  }

  if (hasText(newState.startTime) && !isIsoDate(newState.startTime)) {
    throw new Error('"StartTime" should be a valid ISO string');
  }

  if (!Object.values(ImportJobStatus).includes(newState.status)) {
    throw new Error(`Invalid Import Job status ${newState.status}`);
  }

  if (newState.options) {
    if (!isObject(newState.options)) {
      throw new Error(`Invalid options: ${newState.options}`);
    }

    const invalidOptions = Object.keys(newState.options).filter(
      (key) => !Object.values(ImportOptions)
        .some((value) => value.toLowerCase() === key.toLowerCase()),
    );

    if (invalidOptions.length > 0) {
      throw new Error(`Invalid options: ${invalidOptions}`);
    }

    // validate each option for it's expected data type
    Object.keys(newState.options).forEach((key) => {
      if (ImportOptionTypeValidator[key]) {
        ImportOptionTypeValidator[key](data.options[key]);
      }
    });
  }

  return ImportJob(newState);
};
