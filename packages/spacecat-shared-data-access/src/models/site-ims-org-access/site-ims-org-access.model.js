/*
 * Copyright 2025 Adobe. All rights reserved.
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
 * SiteImsOrgAccess - Maps delegate orgs to sites they can access, per product.
 * Part of the cross-org delegation feature (Option 2a Phase 1).
 *
 * @class SiteImsOrgAccess
 * @extends BaseModel
 */
class SiteImsOrgAccess extends BaseModel {
  static ENTITY_NAME = 'SiteImsOrgAccess';

  static DELEGATION_ROLES = {
    COLLABORATOR: 'collaborator',
    AGENCY: 'agency',
    VIEWER: 'viewer',
  };
}

export default SiteImsOrgAccess;
