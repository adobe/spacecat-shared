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

import { isObject } from '@adobe/spacecat-shared-utils';
import { ImportUrlDto } from '../../dto/import-url.js';
import { createImportUrl } from '../../models/importer/import-url.js';

/**
 * Get import url by ID
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {string} id
 * @returns {Promise<ImportUrlDto> | null}
 */
export const getImportUrlById = async (dynamoClient, config, log, id) => {
  const item = await dynamoClient.getItem(
    config.tableNameImportUrls,
    { id },
  );
  return item ? ImportUrlDto.fromDynamoItem(item) : null;
};

/**
 * Create a new Import Url
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {Object} importUrlData
 * @returns {Promise<ImportUrlDto>}
 */
export const createNewImportUrl = async (dynamoClient, config, log, importUrlData) => {
  const importUrl = createImportUrl(importUrlData);
  await dynamoClient.putItem(
    config.tableNameImportUrls,
    ImportUrlDto.toDynamoItem(importUrl),
  );
  return importUrl;
};

/**
 * Update an existing Import Url
 * @param {DynamoClient} dynamoClient
 * @param {Object} config
 * @param {Logger} log
 * @param {Object} importUrl
 * @returns {ImportUrlDto}
 */
export const updateImportUrl = async (dynamoClient, config, log, importUrl) => {
  const existingImportUrl = await getImportUrlById(
    dynamoClient,
    config,
    log,
    importUrl.getId(),
  );

  if (!isObject(existingImportUrl)) {
    throw new Error(`Import Url with ID:${importUrl.getId()} does not exist`);
  }

  await dynamoClient.putItem(config.tableNameImportUrls, ImportUrlDto.toDynamoItem(importUrl));

  return importUrl;
};
