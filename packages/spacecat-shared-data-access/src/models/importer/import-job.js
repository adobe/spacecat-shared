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

export const ImportJobStatus = {
  RUNNING: 'RUNNING',
  COMPLETE: 'COMPLETE',
  FAILED: 'FAILED',
};

/**
 * Creates a new ImportJob object.
 *
 * @param {Object} importJobData - The data for the ImportJob object.
 * @returns {ImportJob} The new ImportJob object.
 */
const ImportJob = (data) => {
  const self = Base(data);

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
  self.getImportQueueId = () => self.state.importQueueId;
  self.getInitiatedBy = () => self.state.initiatedBy;

  /**
     * Updates the end time of the ImportJob.
     * @param {string} endTime - The new end time.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateEndTime = (endTime) => {
    if (!isIsoDate(endTime)) {
      throw new Error(`Invalid end time during update: ${endTime}`);
    }

    self.state.endTime = endTime;
    self.touch();

    return self;
  };

  /**
     * Updates the duration of the ImportJob.
     * @param {number} duration - The new duration.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateDuration = (duration) => {
    if (!isNumber(duration)) {
      throw new Error(`Invalid duration during update: ${duration}`);
    }

    self.state.duration = duration;
    self.touch();

    return self;
  };

  /**
     * Updates the status of the ImportJob.
     * @param {string} status - The new status.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateStatus = (status) => {
    if (!Object.values(ImportJobStatus).includes(status)) {
      throw new Error(`Invalid Import Job status during update: ${status}`);
    }

    self.state.status = status;
    self.touch();

    return self;
  };

  /**
   * Updates the Url count of the ImportJob
   * @param {number} urlCount - The new url count.
   * @returns {ImportJob} The updated ImportJob object.
   */
  self.updateUrlCount = (urlCount) => {
    if (!isInteger(urlCount)) {
      throw new Error(`Invalid url count during update: ${urlCount}`);
    }

    self.state.urlCount = urlCount;
    self.touch();

    return self;
  };

  /**
     * Updates the success count of the ImportJob.
     * @param {number} successCount - The new success count.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateSuccessCount = (successCount) => {
    if (!isInteger(successCount)) {
      throw new Error(`Invalid success count during update: ${successCount}`);
    }

    self.state.successCount = successCount;
    self.touch();

    return self;
  };

  /**
     * Updates the failed count of the ImportJob.
     * @param {number} failedCount - The new failed count.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateFailedCount = (failedCount) => {
    if (!isInteger(failedCount)) {
      throw new Error(`Invalid failed count during update: ${failedCount}`);
    }

    self.state.failedCount = failedCount;
    self.touch();

    return self;
  };

  /**
     * Updates the import queue id of the ImportJob.
     * @param {string} importQueueId - The new import queue id.
     * @returns {ImportJob} The updated ImportJob object.
     */
  self.updateImportQueueId = (importQueueId) => {
    if (!hasText(importQueueId)) {
      throw new Error(`Invalid import queue id during update: ${importQueueId}`);
    }

    self.state.importQueueId = importQueueId;
    self.touch();

    return self;
  };
  return Object.freeze(self);
};

/**
 * Creates a new ImportJob object.
 * @param {Object} importJobData - The data for the ImportJob object.
 * @returns {ImportJob} The new ImportJob object.
 */
export const createImportJob = (data) => {
  const newState = { ...data };

  if (!isValidUrl(newState.baseURL)) {
    throw new Error(`Invalid base URL: ${newState.baseURL}`);
  }

  if (!isString(newState.hashedApiKey)) {
    throw new Error(`Invalid API key: ${newState.hashedApiKey}`);
  }

  if (hasText(newState.startTime) && !isIsoDate(newState.startTime)) {
    throw new Error('"StartTime" should be a valid ISO string');
  }

  if (!hasText(newState.startTime)) {
    newState.startTime = new Date().toISOString();
  }

  if (!Object.values(ImportJobStatus).includes(newState.status)) {
    throw new Error(`Invalid Import Job status ${newState.status}`);
  }

  if (!isObject(newState.options)) {
    throw new Error(`Invalid options: ${newState.options}`);
  }

  if (!isObject(newState.initiatedBy)) {
    throw new Error(`Invalid initiatedBy: ${newState.initiatedBy}`);
  }

  return ImportJob(newState);
};
