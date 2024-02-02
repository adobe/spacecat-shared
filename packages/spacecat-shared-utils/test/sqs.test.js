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

/* eslint-env mocha */

import { expect } from 'chai';
import sinon from 'sinon';

import { sqsEventAdapter } from '../src/sqs.js';

const exampleHandler = sinon.spy(async (message, context) => {
  const { log } = context;
  const messageStr = JSON.stringify(message);
  log.info(`Handling message ${messageStr}`);
  return new Response(messageStr);
});

describe('SQS helpers', () => {
  const emptyRequest = {};

  it('should handle an invalid context with no records', async () => {
    const contextNoRecords = {
      log: console,
    };

    const handler = sqsEventAdapter(exampleHandler);
    const response = await handler(emptyRequest, contextNoRecords);

    expect(response.status).to.equal(400);
    expect(response.headers.get('x-error')).to.equal('Event does not contain a valid message body');
  });

  it('should handle a valid context with an event record', async () => {
    const context = {
      log: console,
      invocation: {
        event: {
          Records: [
            {
              body: JSON.stringify({ id: '1234567890' }),
              messageId: 'abcd',
            },
          ],
        },
      },
    };

    const handler = sqsEventAdapter(exampleHandler);
    const response = await handler(emptyRequest, context);

    expect(response.status).to.equal(200);
    const result = await response.json();
    expect(result.id).to.equal('1234567890');
    expect(exampleHandler.calledWith({ id: '1234567890' })).to.be.true;
  });
});
