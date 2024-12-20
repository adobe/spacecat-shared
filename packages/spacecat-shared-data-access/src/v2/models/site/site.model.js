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

import { Config } from '../../../models/site/config.js';
import BaseModel from '../base/base.model.js';

export const DELIVERY_TYPES = {
  AEM_CS: 'aem_cs',
  AEM_EDGE: 'aem_edge',
  OTHER: 'other',
};

export const DEFAULT_DELIVERY_TYPE = DELIVERY_TYPES.AEM_EDGE;

/**
 * A class representing a Site entity. Provides methods to access and manipulate Site-specific data.
 * @class Site
 * @extends BaseModel
 */
class Site extends BaseModel {
  getConfig() {
    return Config(this.record.config);
  }

  async getLatestAuditByType(auditType) {
    const collection = this.entityRegistry.getCollection('AuditCollection');

    return collection.findByIndexKeys({ siteId: this.getId(), auditType });
  }

  async toggleLive() {
    const newIsLive = !this.getIsLive();
    this.setIsLive(newIsLive);
    return this;
  }
}

export default Site;
