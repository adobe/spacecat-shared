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

import { BaseModel } from '../base/index.js';

/**
 * A class representing a Site entity. Provides methods to access and manipulate Site-specific data.
 * @class Site
 * @extends BaseModel
 */
class Site extends BaseModel {
  getIsLiveToggledAt() {
    return this.record.isLiveToggledAt ? new Date(this.record.isLiveToggledAt).toISOString() : null;
  }

  async getLatestAuditByType(auditType) {
    const collection = this.modelFactory.getCollection('AuditCollection');

    return collection.findByIndexKeys({ siteId: this.getId(), auditType });
  }

  async toggleLive() {
    const newIsLive = !this.getIsLive();
    this.setIsLive(newIsLive);
    return this;
  }
}

export default Site;
