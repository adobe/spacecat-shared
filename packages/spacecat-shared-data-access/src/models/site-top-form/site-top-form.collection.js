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

import { hasText, isNonEmptyArray } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';

/**
 * SiteTopFormCollection - A collection class responsible for managing SiteTopForm entities.
 * Extends the BaseCollection to provide specific methods for interacting with SiteTopForm records.
 *
 * @class SiteTopFormCollection
 * @extends BaseCollection
 */
class SiteTopFormCollection extends BaseCollection {
  async removeForSiteId(siteId, source) {
    if (!hasText(siteId)) {
      throw new Error('SiteId is required');
    }

    let topFormsToRemove;

    if (hasText(source)) {
      topFormsToRemove = await this.allBySiteIdAndSource(siteId, source);
    } else {
      topFormsToRemove = await this.allBySiteId(siteId);
    }

    const topFormIdsToRemove = topFormsToRemove.map((topForm) => topForm.getId());

    if (isNonEmptyArray(topFormIdsToRemove)) {
      await this.removeByIds(topFormIdsToRemove);
    }
  }

  async removeByUrlAndFormSource(url, formSource) {
    if (!hasText(url)) {
      throw new Error('URL is required');
    }
    if (!hasText(formSource)) {
      throw new Error('FormSource is required');
    }

    const formToRemove = await this.findByUrlAndFormSource(url, formSource);

    if (formToRemove) {
      await this.removeByIds([formToRemove.getId()]);
    }
  }
}

export default SiteTopFormCollection;
