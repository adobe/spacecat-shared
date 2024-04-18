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

import { hasText } from '@adobe/spacecat-shared-utils';

import { createSiteTopPage } from '../../models/site-top-page.js';
import { SiteTopPageDto } from '../../dto/site-top-page.js';

export const getTopPagesForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
  source,
  geo,
) => {
  const queryParams = {
    TableName: config.tableNameSiteTopPages,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: { ':siteId': siteId },
    ScanIndexForward: false,
  };

  if (hasText(source)) {
    if (hasText(geo)) {
      queryParams.KeyConditionExpression += ' AND begins_with(SK, :sourceGeo)';
      queryParams.ExpressionAttributeValues[':sourceGeo'] = `${source}#${geo}`;
    } else {
      queryParams.KeyConditionExpression += ' AND begins_with(SK, :source)';
      queryParams.ExpressionAttributeValues[':source'] = `${source}#`;
    }
  }

  const dynamoItems = await dynamoClient.query(queryParams);

  return dynamoItems.map((item) => SiteTopPageDto.fromDynamoItem(item));
};

export const addSiteTopPage = async (
  dynamoClient,
  config,
  log,
  siteTopPageData,
) => {
  const newSiteTopPage = createSiteTopPage(siteTopPageData);

  await dynamoClient.putItem(
    config.tableNameSiteTopPages,
    SiteTopPageDto.toDynamoItem(newSiteTopPage),
  );

  return newSiteTopPage;
};
