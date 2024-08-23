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
   * Creates a new ContentClient instance from the given UniversalContext and site.
   * @param {UniversalContext} context The UniversalContext to use for creating the ContentClient.
   * @param {Object} site The site object.
   * @returns {ContentClient} The ContentClient instance.
   * @throws {Error} If the site object is not an object or is empty or has
   * no content source defined.
   * @throws {Error} If the context is not configured appropriate to the site's
   * content source type.
   */
  static createFrom(context: UniversalContext, site: object): ContentClient;

  /**
   * Returns the metadata for the given page path. The document backing the URL path
   * is resolved and the metadata is extracted from it. The metadata is a Map where the entries
   * key is the metadata key and the value is the metadata value. If the page does not have any
   * metadata, an empty Map is returned.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The path to the page.
   * @returns {Map<string, string>} The page's metadata.
   * @throws {Error} If the path is not a string, empty or does not start with a "/"
   */
  getPageMetadata(path: string): Map<string, string>;

  /**
   * Updates the metadata for the given page path. The document backing the path
   * is resolved and the metadata is updated with the given metadata.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * The metadata is a Map where the entries key is the metadata key and the value is the
   * metadata value. The metadata is merged with the existing metadata where the new metadata
   * overwrites the existing metadata.
   *
   * @param {string} path The path to the page.
   * @param {Map<string, string>} metadata The metadata to update.
   * @returns {Map<string, string>} The page's merged metadata.
   * @throws {Error} If the metadata is not a Map or empty
   * @throws {Error} If any of the metadata keys or values are not a string
   * @throws {Error} If the path is not a string, empty or does not start with a "/"
   */
  updatePageMetadata(path: string, metadata: Map<string, string>): Map<string, string>;
}