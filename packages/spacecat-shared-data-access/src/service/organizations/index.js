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
  getOrganizations,
  getOrganizationByID,
  addOrganization,
  updateOrganization,
  removeOrganization,
} from './accessPatterns.js';

export const organizationFunctions = (dynamoClient, config, log) => ({
  getOrganizations: () => getOrganizations(dynamoClient, config),
  getOrganizationByID: (organizationId) => getOrganizationByID(
    dynamoClient,
    config,
    organizationId,
  ),
  addOrganization: (organizationData) => addOrganization(
    dynamoClient,
    config,
    log,
    organizationData,
  ),
  updateOrganization: (organizationData) => updateOrganization(
    dynamoClient,
    config,
    log,
    organizationData,
  ),
  removeOrganization: (organizationId) => removeOrganization(
    dynamoClient,
    config,
    log,
    organizationId,
  ),
});
