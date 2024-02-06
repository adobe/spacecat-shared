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
 * Wrapper to turn an SQS record into a function param
 * Inspired by https://github.com/adobe/helix-admin/blob/main/src/index.js#L108-L133
 *
 * @param {UniversalAction} fn
 * @returns {function(object, UniversalContext): Promise<Response>}
 */
export function sqsEventAdapter(fn) {
  return async (req, context) => {
    const { log } = context;
    let message;

    try {
      // currently not publishing batch messages
      const records = context.invocation?.event?.Records;
      log.info(`Received ${records?.length} many records. ID of the first message in the batch: ${records[0]?.messageId}`);
      message = JSON.parse(records[0]?.body);
      log.info(`Received message with id: ${context.invocation?.event?.Records.length}`);
    } catch (e) {
      log.error('Function was not invoked properly, message body is not a valid JSON', e);
      return new Response('', {
        status: 400,
        headers: {
          'x-error': 'Event does not contain a valid message body',
        },
      });
    }
    return fn(message, context);
  };
}
