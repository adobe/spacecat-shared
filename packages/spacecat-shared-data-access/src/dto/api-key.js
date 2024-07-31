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

import { createApiKey } from '../models/api-key.js';

export const ApiKeyDto = {

  /**
     * Converts an ApiKey object into a DynamoDB item.
     * @param apiKey
     * @returns {{createdAt: *, name: *, imsUserId, scopes, revokedAt, key: *,
     *          imsOrgId: *, expiresAt: *}}
     */
  toDynamoItem: (apiKey) => ({
    hashedKey: apiKey.getHashedKey(),
    name: apiKey.getName(),
    imsUserId: apiKey.getImsUserId(),
    imsOrgId: apiKey.getImsOrgId(),
    createdAt: apiKey.getCreatedAt(),
    expiresAt: apiKey.getExpiresAt(),
    revokedAt: apiKey.getRevokedAt(),
    scopes: apiKey.getScopes(),
  }),

  /**
     * Converts a DynamoDB item into an ApiKey object.
     * @param dynamoItem
     * @returns {ApiKey}
     */
  fromDynamoItem: (dynamoItem) => {
    const apiKeyData = {
      hashedKey: dynamoItem.hashedKey,
      name: dynamoItem.name,
      imsUserId: dynamoItem.imsUserId,
      imsOrgId: dynamoItem.imsOrgId,
      createdAt: dynamoItem.createdAt,
      expiresAt: dynamoItem.expiresAt,
      revokedAt: dynamoItem.revokedAt,
      scopes: dynamoItem.scopes,
    };

    return createApiKey(apiKeyData);
  },
};
