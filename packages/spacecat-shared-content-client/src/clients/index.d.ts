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

import type { UniversalContext } from '@adobe/helix-universal';

export class ContentClient {
  /**
   * Creates a new ContentClient instance from the given UniversalContext.
   * @param {UniversalContext} context The UniversalContext to use for creating the ContentClient.
   * @param {Object} site The site object.
   * @returns {ContentClient} The ContentClient instance.
   */
  static createFrom(context: UniversalContext, site: object): ContentClient;

  /**
   * Returns the metadata for the given site and URL path. The document backing the URL path
   * is resolved and the metadata is extracted from it. The metadata is an object with
   * key-value pairs.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {Object} site The site object.
   * @param {string} path The path to the page.
   * @returns {Map<string, string>} The page's metadata.
   */
  getPageMetadata(site: object, path: string): Map<string, string>;

  /**
   * Updates the metadata for the given site and URL path. The document backing the URL path
   * is resolved and the metadata is updated with the given metadata.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * The metadata is a Map where the entries key is the metadata key and the value is the
   * metadata value. The metadata is merged with the existing metadata where the new metadata
   * overwrites the existing metadata.
   *
   * @param {Object} site The site object.
   * @param {string} path The path to the page.
   * @param {Map<string, string>} metadata The metadata to update.
   * @returns {Map<string, string>} The page's merged metadata.
   */
  updatePageMetadata(
    site: object,
    path: string,
    metadata: Map<string, string>
  ): Map<string, string>;
}
