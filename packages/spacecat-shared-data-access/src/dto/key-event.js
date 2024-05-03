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

import { createKeyEvent } from '../models/key-event.js';

/**
 * Data transfer object for Key Event.
 */
export const KeyEventDto = {
  /**
     * Converts a DynamoDB item into a KeyEvent object.
     * @param {object } dynamoItem - DynamoDB item.
     * @returns {Readonly<KeyEvent>} KeyEvent object.
     */
  fromDynamoItem: (dynamoItem) => {
    const keyEventData = {
      id: dynamoItem.id,
      siteId: dynamoItem.siteId,
      name: dynamoItem.name,
      type: dynamoItem.type,
      time: dynamoItem.time,
      createdAt: dynamoItem.createdAt,
      updatedAt: dynamoItem.updatedAt,
    };

    return createKeyEvent(keyEventData);
  },

  /**
     * Converts a KeyEvent object into a DynamoDB item.
     * @param {Readonly<KeyEvent>} keyEvent - KeyEvent object.
     * @returns {object} DynamoDB item.
     */
  toDynamoItem: (keyEvent) => ({
    id: keyEvent.getId(),
    siteId: keyEvent.getSiteId(),
    name: keyEvent.getName(),
    type: keyEvent.getType(),
    time: keyEvent.getTime(),
    createdAt: keyEvent.getCreatedAt(),
    updatedAt: keyEvent.getUpdatedAt(),
  }),
};
