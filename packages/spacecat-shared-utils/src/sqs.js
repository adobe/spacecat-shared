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

import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import AWSXray from 'aws-xray-sdk';
import { hasText } from './functions.js';

/**
 * @class SQS utility to send messages to SQS
 * @param {string} region - AWS region
 * @param {object} log - log object
 */
class SQS {
  constructor(region, log) {
    this.sqsClient = AWSXray.captureAWSv3Client(new SQSClient({ region }));
    this.log = log;
  }

  /**
   * Send a message to an SQS queue. For FIFO queues, messageGroupId is required.
   * @param {string} queueUrl - The URL of the SQS queue.
   * @param {object} message - The message body to send.
   * @param {string} messageGroupId - (Optional) The message group ID for FIFO queues.
   * @return {Promise<void>}
   */
  async sendMessage(queueUrl, message, messageGroupId) {
    const body = {
      ...message,
      timestamp: new Date().toISOString(),
    };

    const params = {
      MessageBody: JSON.stringify(body),
      QueueUrl: queueUrl,
    };

    if (hasText(messageGroupId)) {
      // MessageGroupId is required for FIFO queues
      params.MessageGroupId = messageGroupId;
    }

    const msgCommand = new SendMessageCommand(params);

    try {
      const data = await this.sqsClient.send(msgCommand);
      this.log.info(`Success, message sent. MessageID:  ${data.MessageId}`);
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

    try {
      // currently not publishing batch messages
      const records = context.invocation?.event?.Records;
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('No records found');
      }

      log.info(`Received ${records.length} records. ID of the first message in the batch: ${records[0]?.messageId}`);
      message = JSON.parse(records[0]?.body);
      log.info(`Received message with id: ${records[0]?.messageId}`);
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
