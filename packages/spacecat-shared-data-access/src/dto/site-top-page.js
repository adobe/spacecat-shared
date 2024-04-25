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

import { createSiteTopPage } from '../models/site-top-page.js';

function padWithZeros(number) {
  return String(number).padStart(12, '0');
}

export const SiteTopPageDto = {
/**
   * Converts a SiteTopPage object into a DynamoDB item.
   * @param {Readonly<SiteTopPage>} siteTopPage - SiteTopPage object.
   * @returns {{siteId, url, traffic, source, geo, importedAt, SK: string}}
   */
  toDynamoItem: (siteTopPage) => ({
    siteId: siteTopPage.getSiteId(),
    url: siteTopPage.getURL(),
    traffic: siteTopPage.getTraffic(),
    source: siteTopPage.getSource(),
    geo: siteTopPage.getGeo(),
    importedAt: siteTopPage.getImportedAt(),
    SK: `${siteTopPage.getSource()}#${siteTopPage.getGeo()}#${padWithZeros(siteTopPage.getTraffic())}`,
  }),

  /**
   * Converts a DynamoDB item into a SiteTopPage object.
   * @param {{siteId, url, traffic, source, geo, importedAt, SK: string}} item - DynamoDB item.
   * @returns {SiteTopPage}
   */
  fromDynamoItem: (item) => createSiteTopPage({
    siteId: item.siteId,
    url: item.url,
    traffic: item.traffic,
    source: item.source,
    geo: item.geo,
    importedAt: item.importedAt,
  }),
};
