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
   *
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
   * Creates a new ContentClient instance from the given domain and environment.
   *
   * @param {string} domain The domain of the site to create the ContentClient for.
   * @param {Object} env The environment object that contains the required configuration
   * for the site's content source type.
   * @returns {Promise<ContentClient>} A promise that resolves to the ContentClient instance.
   * @throws {Error} If the domain is not a string or empty.
   * @throws {Error} If the env is not an object or does not contain the required configuration.
   */
  static createFromDomain(domain: string, env: object,): Promise<ContentClient>;

  /**
   * Returns the metadata for the given page path. The document backing the path
   * is resolved and the metadata is extracted from it. The metadata is a Map where the entries
   * key is the metadata key and the value is the metadata value. If the page does not have any
   * metadata, an empty Map is returned.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The path to the page.
   * @returns {Promise<Map<string, { value: string, type: string }>>} A promise that
   * resolves to the page's metadata.
   * @throws {Error} If the path is not a string, empty or does not start with a "/"
   */
  getPageMetadata(path: string): Promise<Map<string, { value: string, type: string }>>;

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
   * @param {Map<string, { value: string, type: string }>} metadata The metadata to update.
   * @param {Object} [options] The options to use for updating the metadata.
   * @param {Object} [options.overwrite] Whether to overwrite the existing metadata.
   * @returns {Promise<Map<string, { value: string, type: string }>>}  A promise that resolves to
   * the page's merged metadata.
   * @throws {Error} If the metadata is not a Map or empty
   * @throws {Error} If any of the metadata keys or values are not a string
   * @throws {Error} If the path is not a string, empty or does not start with a "/"
   */
  updatePageMetadata(
    path: string,
    metadata: Map<string, { value: string, type: string }>,
    options: object,
  ): Promise<Map<string, { value: string, type: string }>>;

  /**
   * Retrieves the current redirects for the site from the redirects.xlsx file.
   *
   * @returns {Promise<Array<{ from: string, to: string }>>} A promise that resolves to
   * an array of redirect objects.
   * @throws {Error} If there is an issue retrieving the redirects.
   */
  getRedirects(): Promise<Array<{ from: string, to: string }>>

  /**
   * Updates the redirects for the site with the valid array of redirects.
   * The redirects are validated before updating the redirects.
   * The duplicate redirects are removed.
   * The redundant redirects are removed.
   * The valid redirects are appended at the end of the redirects.xlsx file.
   *
   * @param {Array<{ from: string, to: string }>} redirects The array of redirect objects to update.
   * @returns {Promise<void>} A promise that resolves when the redirects have been updated.
   * @throws {Error} If the redirects array is not valid or if there
   * is an issue updating the redirects.
   */
  updateRedirects(redirects: Array<{ from: string, to: string }>): Promise<void>

  /**
   * Updates the broken internal links for the given page path.
   *
   * @param {string} path The path to the page.
   * @param { from: string, to: string } brokenLink The broken link is the object to
   * update.
   * @returns {Promise<void>} A promise that resolves when the broken link has been updated.
   * @throws {Error} If the path is not a string, empty or does not start with a "/"
   * @throws {Error} If the brokenLink object is not valid or if there is an issue updating the
   * links.
   */
  updateBrokenInternalLink(path: string, brokenLink: { from: string, to: string }):
      Promise<void>;

  /**
   * Retrieves the resource path for a given content path from the AEM admin API.
   * The resource path represents the actual file location in the content source
   * (e.g., Google Drive or OneDrive) that corresponds to the given content path.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The content path to get the resource path for.
   * Must be a valid path that exists in the content source.
   * @returns {Promise<string | undefined>} A promise that resolves to the resource path
   * string if found, or undefined if not available.
   * @throws {Error} If the Helix admin API request fails or returns an error response.
   *
   * @example
   * ```typescript
   * const client = await ContentClient.createFrom(context, site);
   * const resourcePath = await client.getResourcePath('/content/page');
   * console.log(resourcePath); // e.g., '/content/page.docx'
   * ```
   */
  getResourcePath(path: string): Promise<string | undefined>;

  /**
   * Retrieves the live and preview URLs for a given content path from the AEM admin API.
   * The live URL represents the published version of the content, while the preview URL
   * represents the draft/preview version that can be used for testing before publishing.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The content path to get URLs for. Must be a valid path
   * that exists in the content source.
   * @returns {Promise<{liveURL: string | undefined, previewURL: string | undefined}>}
   * A promise that resolves to an object containing:
   * - liveURL: The live/published URL if available, undefined otherwise
   * - previewURL: The preview URL if available, undefined otherwise
   * @throws {Error} If the Helix admin API request fails or returns an error response.
   *
   * @example
   * ```typescript
   * const client = await ContentClient.createFrom(context, site);
   * const urls = await client.getLivePreviewURLs('/content/page');
   * console.log(urls.liveURL);    // e.g., 'https://owner--repo.hlx.live/content/page'
   * console.log(urls.previewURL); // e.g., 'https://main--repo--owner.hlx.page/content/page'
   * ```
   */
  getLivePreviewURLs(path: string):
       Promise<{ liveURL: string | undefined, previewURL: string | undefined }>;

  /**
   * Retrieves the edit URL for a given content path from the AEM admin API.
   * The edit URL represents the URL of the document source for the given content path
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The content path to get the edit URL for.
   *
   * @returns {Promise<string | undefined>} A promise that resolves to the edit URL
   * string if found, or undefined if not available.
   * @throws {Error} If the Helix admin API request fails or returns an error response.
   *
   * @example
   * ```typescript
   * const client = await ContentClient.createFrom(context, site);
   * const editURL = await client.getEditURL('/content/page');
   * console.log(editURL); // e.g., 'https://adobe.sharepoint.com/sites/Projects/_layouts/15/Doc.aspx?sourcedoc=%7xxxxxx-xxxx-xxxx-xxxx-xxxxxx%7D&file=page.docx&action=default'
   *
   */
  getEditURL(path: string): Promise<string | undefined>;

  /**
   * Retrieves all links from a document at the specified path.
   * This method extracts links from the document content, including both internal
   * and external links, anchors, email links, and other href attributes.
   *
   * The path should stem from a page's URL and is relative to the site's root.
   * Example: "/path/to/page" (from the full URL: "https://www.example.com/path/to/page").
   *
   * @param {string} path The path to the document to extract links from.
   * Must be a valid path that exists in the content source.
   * @returns {Promise<Array<{url: string | null, text: string | null}>>}
   * A promise that resolves to an array of link objects, where each object contains:
   * - url: The URL or path the link points to (can be null if not available)
   * - text: The display text of the link (can be null if not available)
   * @throws {Error} If there is an issue retrieving the document or extracting links.
   *
   * @example
   * ```typescript
   * const client = await ContentClient.createFrom(context, site);
   * const links = await client.getDocumentLinks('/content/page');
   * console.log(links);
   * // [
   * //   { url: 'https://example.com/external', text: 'External Link' },
   * //   { url: '/internal/page', text: 'Internal Page' },
   * // ]
   * ```
   */
  getDocumentLinks(path: string): Promise<Array<{ url: string | null, text: string | null }>>;
}
