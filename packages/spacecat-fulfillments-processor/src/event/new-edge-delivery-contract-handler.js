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

/**
 * Process an event from the fulfillment_completed topic. See example below for the
 * expected event format.
 *
 * @param event
 * @param context
 *
 * @example
 * // Sample event. Not an exhaustive list of all possible properties.
 * {
 *   "external_request_id":"12345",
 *   "requestor_id":"1234567890ABCDEF12345678@adobe.com",
 *   "owner_id":"1234567890ABCDEF12345678@AdobeOrg",
 *   "request_type":"REGULAR",
 *   "requestor_system":"AAUI",
 *   "fulfillment_id":"1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
 *   "create_date":"2024-01-22T09:20:01.12345Z",
 *   "items": [
 *     {
 *       "external_item_id":"12345-abcd-1234-1234-12344321",
 *       "quantity":"UNLIMITED",
 *       "offer_id":"1234567890ABCDEF1234567890ABCDEF",
 *       "accepted_terms": {
 *         "contract_id":"1234567890ABCDEF1234",
 *         "accepted_agreement":"INITIAL"
 *       },
 *       "fulfillable_items_completed": [
 *         {
 *           "id":"123e4567-e89b-12d3-a456-426614174000",
 *           "code":"dx_example_solution",
 *           "fulfillment_details": {
 *             "fulfillable_entity_resource_locator":"https://example.com/1234567890ABCDEF12345678@AdobeOrg",
 *             "fulfillable_entity_resource_name":"Example Solution"
 *           }
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
const processFulfillmentCompletedEvent = () => { // TODO: use (event, context) => {
  // Query for an existing SpaceCat Organization, using the IMS Org ID in the message
  // If an existing Organization is found, use it. Otherwise, create a new Organization

  // Append the fulfillable_items_completed from the message to the Org to keep track of what
  // was purchased (note: list may be incomplete)

  // Query the IMS tenant ID from the IMS API (ie. @goodcorporation)

  // Check for an existing channel in Slack named #aem-${imsTenantId}
  // If channel already exists, log details to #franklin-spacecat and take no further action

  // Create Slack channel named #aem-${imsTenantId}

  // Lookup IMS Org admin(s) from the IMS API

  // Add IMS Org Admins to the channel

  // Add one of the cohorts of Adobe contacts to the channel — random, initially

  // Post Welcome message in new channel (#aem-${imsTenantId})

  // Persist Slack channel coordinates to Organization record, as part of the config object

  // Post a summary message of the actions taken to #franklin-spacecat
};

export {
  processFulfillmentCompletedEvent,
};
