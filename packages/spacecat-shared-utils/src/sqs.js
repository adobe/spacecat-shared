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

import { Response } from '@adobe/fetch';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { instrumentAWSClient } from './xray.js';

import { hasText, isNonEmptyArray } from './functions.js';
import { isAWSLambda } from './runtimes.js';

function badRequest(message) {
  return new Response('', {
    status: 400,
    headers: { 'x-error': message },
  });
}

/**
 * @class SQS utility to send messages to SQS
 * @param {string} region - AWS region
 * @param {object} log - log object
 */
class SQS {
  constructor(region, log) {
    this.sqsClient = instrumentAWSClient(new SQSClient({ region }));
    this.log = log;
  }

  /**
   * Check if the queue is a FIFO queue by examining its URL.
   * @param {string} queueUrl - the URL of the SQS queue
   * @returns {boolean} true if the queue is a FIFO queue, false otherwise
   */
  static #isFifoQueue(queueUrl) {
    return hasText(queueUrl) && queueUrl.toLowerCase().endsWith('.fifo');
  }

  /**
   * Send a message to an SQS queue. For FIFO queues, messageGroupId is required.
   * @param {string} queueUrl - The URL of the SQS queue.
   * @param {object} message - The message body to send.
   * @param {string} messageGroupId - (Optional) The message group ID for FIFO queues.
   * @return {Promise<void>}
   */
  async sendMessage(queueUrl, message, messageGroupId = undefined) {
    const body = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    const params = {
      MessageBody: JSON.stringify(body),
      QueueUrl: queueUrl,
    };

    // Only include MessageGroupId if the queue is a FIFO queue
    if (SQS.#isFifoQueue(queueUrl) && hasText(messageGroupId)) {
      params.MessageGroupId = messageGroupId;
    }

    const msgCommand = new SendMessageCommand(params);

    try {
      const data = await this.sqsClient.send(msgCommand);
      this.log.debug(`Success, message sent. MessageID:  ${data.MessageId}`);
    } catch (e) {
      const { type, code, message: msg } = e;
      this.log.error(`Message sent failed. Type: ${type}, Code: ${code}, Message: ${msg}`);
      throw e;
    }
  }
}

export function sqsWrapper(fn) {
  return async (request, context) => {
    if (!context.sqs) {
      const { log } = context;
      const { region } = context.runtime;
      context.sqs = new SQS(region, log);
    }

    return fn(request, context);
  };
}

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

    // if not in aws lambda, invoke the function with json body as message
    if (!isAWSLambda()) {
      message = await req.json();
      return fn(message, context);
    }

    // currently not processing batch messages
    const records = context.invocation?.event?.Records;

    if (!isNonEmptyArray(records)) {
      log.warn('Function was not invoked properly, event does not contain any records');
      return badRequest('Event does not contain any records');
    }

    const record = records[0];

    log.debug(`Received ${records.length} records. ID of the first message in the batch: ${record.messageId}`);

    try {
      message = JSON.parse(record.body);
      log.debug(`Received message with id: ${record.messageId}`);
    } catch (e) {
      log.warn('Function was not invoked properly, message body is not a valid JSON', e);
      return badRequest('Event does not contain a valid message body');
    }
    return fn(message, context);
  };
}
