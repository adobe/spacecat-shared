/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import BaseModel from '../base/base.model.js';

/**
 * PlgOnboarding - A class representing a PLG onboarding entity.
 * Tracks the self-service onboarding lifecycle for ASO customers.
 *
 * @class PlgOnboarding
 * @extends BaseModel
 */
class PlgOnboarding extends BaseModel {
  static ENTITY_NAME = 'PlgOnboarding';

  static IMS_ORG_ID_PATTERN = /^[a-z0-9]{24}@AdobeOrg$/i;

  static DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

  static STATUSES = {
    PRE_ONBOARDING: 'PRE_ONBOARDING',
    IN_PROGRESS: 'IN_PROGRESS',
    ONBOARDED: 'ONBOARDED',
    ERROR: 'ERROR',
    WAITING_FOR_IP_ALLOWLISTING: 'WAITING_FOR_IP_ALLOWLISTING',
    WAITLISTED: 'WAITLISTED',
    INACTIVE: 'INACTIVE',
  };

  static REVIEW_DECISIONS = {
    BYPASSED: 'BYPASSED',
    UPHELD: 'UPHELD',
  };
}

export default PlgOnboarding;
