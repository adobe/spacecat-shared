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

import { createKeyEvent } from '../../models/key-event.js';
import { KeyEventDto } from '../../dto/key-event.js';

/**
 * Adds a new key event for a site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {object} log - the logger object
 * @param {object} keyEventData - The key event data.
 * @returns {Promise<Readonly<KeyEvent>>} newly created key event
 */
export const addKeyEvent = async (
  dynamoClient,
  config,
  log,
  keyEventData,
) => {
  const keyEvent = createKeyEvent(keyEventData);

  await dynamoClient.putItem(
    config.tableNameKeyEvents,
    KeyEventDto.toDynamoItem(keyEvent),
  );

  return keyEvent;
};

/**
 * Retrieves key events for a specified site.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} siteId - The ID of the site for which key events are being retrieved.
 * @param {boolean} ascending - Determines if the key events should be sorted ascending
 * or descending by createdAt.
 * @returns {Promise<Readonly<KeyEvent>[]>} A promise that resolves to an array of key events
 * for the specified site.
 */
export const getKeyEventsForSite = async (
  dynamoClient,
  config,
  log,
  siteId,
  ascending = false,
) => {
  const dynamoItems = await dynamoClient.query({
    TableName: config.tableNameKeyEvents,
    IndexName: config.indexNameAllKeyEventsBySiteId,
    KeyConditionExpression: 'siteId = :siteId',
    ExpressionAttributeValues: { ':siteId': siteId },
    ScanIndexForward: ascending, // Sorts ascending if true, descending if false
  });

  return dynamoItems.map((item) => KeyEventDto.fromDynamoItem(item));
};

/**
 * Removes a key event.
 *
 * @param {DynamoDbClient} dynamoClient - The DynamoDB client.
 * @param {DataAccessConfig} config - The data access config.
 * @param {Logger} log - The logger.
 * @param {string} keyEventId - The ID of the key event to remove.
 * @returns {Promise<void>}
 */
export const removeKeyEvent = async (
  dynamoClient,
  config,
  log,
  keyEventId,
) => {
  try {
    await dynamoClient.removeItem(config.tableNameKeyEvents, { id: keyEventId });
  } catch (error) {
    log.error(`Error removing key event: ${error.message}`);
    throw error;
  }
};
