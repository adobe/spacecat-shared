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

const Configuration = (data = {}) => {
  const self = Base(data);
  self.getConfigMap = () => self.state.configMap;

  /**
     * Updates the Config map belonging to the Configuration.
     * @param {object} configMap - The IMS Org ID.
     * @return {Base} The updated configuration.
     */
  self.updateConfigMap = (configMap) => {
    if (!isObject(configMap)) {
      throw new Error('Configuration Map must be an object');
    }

    self.state.configMap = { ...configMap };
    self.touch();

    return self;
  };
  return Object.freeze(self);
};

/**
 * Creates a new Configuration.
 *
 * @param {object} data - configuration data
 * @returns {Readonly<Configuration>} configuration - new configuration
 */
export const createConfiguration = (data) => {
  const newState = { ...data };

  if (!hasText(newState.id)) {
    throw new Error('Configuration ID must be provided');
  }
  if (!isObject(newState.configMap)) {
    throw new Error('Configuration Map must be provided');
  }

  return Configuration(newState);
};
