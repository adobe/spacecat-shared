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
  static COLLECTION_NAME = 'SiteTopFormCollection';

  /**
   * Override create method to validate URL presence and handle optional formSource
   * @param {Object} item - The data for the entity to be created
   * @param {Object} [options] - Additional options for the creation process
   * @returns {Promise<BaseModel>} - A promise that resolves to the created model instance
   * @throws {Error} - Throws an error if URL is not present
   */
  async create(item, options = {}) {
    if (!hasText(item?.url)) {
      throw new Error('URL is required and cannot be empty');
    }

    // If formSource is not provided or empty, set it as empty string (default value)
    const processedItem = {
      ...item,
      formSource: hasText(item.formSource) ? item.formSource : '',
    };

    return super.create(processedItem, options);
  }

  /**
   * Override createMany method to validate URLs and handle optional formSource
   * @param {Array<Object>} newItems - An array of data for the entities to be created
   * @param {BaseModel} [parent] - Optional parent entity
   * @returns {Promise<Object>} - A promise that resolves to created and error items
   */
  async createMany(newItems, parent = null) {
    // Validate and process items
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

  /**
   * Remove forms by URL and optional formSource
   * @param {string} url - The URL to match
   * @param {string} [formSource] - The formSource to match (optional, defaults to empty string)
   * @returns {Promise<void>}
   */
  async removeByUrlAndFormSource(url, formSource = '') {
    if (!hasText(url)) {
      throw new Error('URL is required');
    }

    // Handle both cases: when formSource is provided and when it's not
    let formToRemove;

    if (hasText(formSource)) {
      formToRemove = await this.findByUrlAndFormSource(url, formSource);
    } else {
      // Find forms by URL where formSource is empty string (default)
      formToRemove = await this.findByUrlAndFormSource(url, '');
    }

    if (formToRemove) {
      await this.removeByIds([formToRemove.getId()]);
    }
  }

  /**
   * Find forms by URL, handling optional formSource
   * @param {string} url - The URL to search for
   * @param {string} [formSource] - The formSource to search for
   *    (optional, defaults to empty string)
   * @returns {Promise<BaseModel|null>} - The found form or null
   */
  async findByUrlAndFormSource(url, formSource = '') {
    if (!hasText(url)) {
      throw new Error('URL is required');
    }

    try {
      const searchFormSource = hasText(formSource) ? formSource : '';

      // First try to find with the provided formSource
      let indexKeys = {
        url,
        formSource: searchFormSource,
      };

      let result = await this.findByIndexKeys(indexKeys, {
        index: 'spacecat-data-gsi2pk-gsi2sk',
      });

      // If not found and searching for empty string, also try with null
      // This handles legacy data that might have null formSource
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
          // If the null search also fails, ignore and return the original null result
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

export default SiteTopFormCollection;
