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

import { fetch } from './adobe-fetch.js';

export const CONTENT_API_PREFIX = '/adobe';

/**
 * Determines the AEM CS/AMS page ID for Content API, from the page URL
 * @param {string} pageURL - The URL of the page
 * @param {string} authorURL - The URL of the author instance
 * @param {string} bearerToken - The access token for the author instance
 * @param {boolean} preferContentApi - Whether to prefer the Content API over the PSS, default is
 * false
 * @param {Object} log - The logger object, default is console
 * @return {string|null} - The AEM page ID
 */
export async function determineAEMCSPageId(
  pageURL,
  authorURL,
  bearerToken,
  preferContentApi = false,
  log = console,
) {
  log.info(`Fetching HTML from ${pageURL} to retrieve content-page-id for AEM CS Content API mode.`);
  const htmlResponse = await fetch(pageURL);

  if (!htmlResponse.ok) {
    return null;
  }

  const html = await htmlResponse.text();

  // First try to find a content-page-ref meta tag
  const contentPageRefRegex = /<meta\s+name=['"]content-page-ref['"]\s+content=['"]([^'"]*)['"]\s*\/?>/i;
  const refMatch = html.match(contentPageRefRegex);

  if (refMatch?.[1]?.trim()) {
    if (!authorURL || !bearerToken) {
      // If ref was present but resolution failed, return null per spec
      log.warn('Content-page-ref found but authorURL or bearerToken is missing, skipping resolution.');
      return null;
    }
    const contentPageRef = refMatch[1].trim();
    try {
      const base = preferContentApi
        ? `${authorURL}${CONTENT_API_PREFIX}`
        : `${authorURL}/adobe/experimental/pss`;
      const resolveUrl = `${base}/pages/resolve?pageRef=${contentPageRef}`;
      log.info(`Resolving content-page-ref via ${resolveUrl} (preferContentApi=${preferContentApi})`);
      const resp = await fetch(resolveUrl, {
        method: 'GET',
        headers: { Authorization: bearerToken },
        redirect: 'follow',
      });
      if (resp.status === 200) {
        let pageId = null;
        if (preferContentApi) {
          const data = await resp.json();
          pageId = data?.id || null;
        } else {
          const data = await resp.text();
          pageId = data || null;
        }

        if (pageId) {
          log.info(`Resolved pageId: "${pageId}" from JSON directly for ref "${contentPageRef}"`);
          return pageId;
        }
        log.error('resolve response did not contain an "id" property.');
        return null;
      } else {
        log.warn(`Unexpected status ${resp.status} when resolving content-page-ref.`);
      }
    } catch (e) {
      log.error(`Error while resolving content-page-ref: ${e.message}`);
    }
    // If ref was present but resolution failed, return null per spec
    return null;
  }

  // Fallback to content-page-id meta tag
  const contentPageIdRegex = /<meta\s+name=['"]content-page-id['"]\s+content=['"]([^'"]*)['"]\s*\/?>/i;
  const idMatch = html.match(contentPageIdRegex);

  let pageId = null;
  if (idMatch?.[1]?.trim()) {
    pageId = idMatch[1].trim();
    if (pageId) {
      log.info(`Extracted pageId: "${pageId}" from "content-page-id" meta tag at ${pageURL}`);
    }
  }
  return pageId;
}

/**
 * Fetch the edit URL for a given page ID using the Content API
 * @param {string} authorURL - The author URL
 * @param {string} bearerToken - The bearer token
 * @param {string} pageId - The page ID
 * @returns {string} The edit URL or null if the page ID is not found
 */
export const getPageEditUrl = async (authorURL, bearerToken, pageId) => {
  const PAGE_ID_API = `${authorURL}${CONTENT_API_PREFIX}/pages/${pageId}`;
  const response = await fetch(PAGE_ID_API, {
    method: 'GET',
    headers: { Authorization: bearerToken },
  });
  if (response.ok) {
    const responseData = await response.json();
    // eslint-disable-next-line no-underscore-dangle
    return responseData?._links?.edit;
  }
  return null;
};
