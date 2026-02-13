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

import { hasText, isNonEmptyArray } from '@adobe/spacecat-shared-utils';

import PostgresBaseCollection from '../base/postgres-base.collection.js';

class PostgresSiteTopFormCollection extends PostgresBaseCollection {
  static COLLECTION_NAME = 'SiteTopFormCollection';

  async create(item, options = {}) {
    if (!hasText(item?.url)) {
      throw new Error('URL is required and cannot be empty');
    }

    const processedItem = {
      ...item,
      formSource: hasText(item.formSource) ? item.formSource : '',
    };

    return super.create(processedItem, options);
  }

  async createMany(newItems, parent = null) {
    const processedItems = newItems.map((item) => {
      if (!hasText(item?.url)) {
        throw new Error('URL is required and cannot be empty for all items');
      }

      return {
        ...item,
        formSource: hasText(item.formSource) ? item.formSource : '',
      };
    });

    return super.createMany(processedItems, parent);
  }

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

  async removeByUrlAndFormSource(url, formSource = '') {
    if (!hasText(url)) {
      throw new Error('URL is required');
    }

    let formToRemove;

    if (hasText(formSource)) {
      formToRemove = await this.findByUrlAndFormSource(url, formSource);
    } else {
      formToRemove = await this.findByUrlAndFormSource(url, '');
    }

    if (formToRemove) {
      await this.removeByIds([formToRemove.getId()]);
    }
  }

  async findByUrlAndFormSource(url, formSource = '') {
    if (!hasText(url)) {
      throw new Error('URL is required');
    }

    try {
      const searchFormSource = hasText(formSource) ? formSource : '';

      let indexKeys = {
        url,
        formSource: searchFormSource,
      };

      let result = await this.findByIndexKeys(indexKeys, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });

      if (!result && searchFormSource === '') {
        try {
          indexKeys = {
            url,
            formSource: null,
          };

          result = await this.findByIndexKeys(indexKeys, {
            index: 'spacecat-data-gsi2pk-gsi2sk',
          });
        } catch (legacyError) {
          this.log.error(`Legacy null formSource search failed: ${legacyError.message}`);
        }
      }

      return result;
    } catch (error) {
      this.log.error(`Failed to find form by URL and formSource: ${error.message}`);
      return null;
    }
  }
}

export default PostgresSiteTopFormCollection;
