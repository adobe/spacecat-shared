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

import { SQSClient } from '@aws-sdk/client-sqs';
import wrap from '@adobe/helix-shared-wrap';
import sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import crypto from 'crypto';
import AWSXray from 'aws-xray-sdk';
import { sqsEventAdapter, sqsWrapper } from '../src/sqs.js';

use(sinonChai);
use(chaiAsPromised);

const sandbox = sinon.createSandbox();

describe('SQS', () => {
  describe('SQS class', () => {
    let context;
    process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs22.x';

    beforeEach('setup', () => {
      context = {
        log: console,
        runtime: {
          region: 'us-east-1',
        },
      };
    });

    afterEach('clean', () => {
      sandbox.restore();
    });

    it('do not initialize a new sqs if already initialized', async () => {
      const instance = {
        sendMessage: sandbox.stub().resolves(),
      };
      context.sqs = instance;

      await wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value' });
      }).with(sqsWrapper)({}, context);

      expect(instance.sendMessage).to.have.been.calledOnce;
    });

    it('message sending fails', async () => {
      const errorResponse = {
        type: 'Sender',
        code: 'InvalidParameterValue',
        message: 'invalid param',
      };
      const errorSpy = sandbox.spy(context.log, 'error');

      nock('https://sqs.mock-region-1.mockaws.com')
        .post('/')
        .reply(400, errorResponse);

      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value' });
      }).with(sqsWrapper);

      await expect(action({}, context)).to.be.rejectedWith(errorResponse.message);

      const errorMessage = `Message send failed. Type: ${errorResponse.type}, Code: ${errorResponse.code}, Message: ${errorResponse.message}`;
      expect(errorSpy).to.have.been.calledWith(
        errorMessage,
        sinon.match.instanceOf(Error),
      );
    });

    it('message sending fails with malformed error (missing properties)', async () => {
      const errorSpy = sandbox.spy(context.log, 'error');

      // Return an empty JSON object to simulate a malformed error response
      // The AWS SDK will parse it but type/code will be undefined, message will be 'UnknownError'
      const scope = nock('https://sqs.mock-region-1.mockaws.com')
        .post('/')
        .times(3) // Allow for retries
        .reply(500, {});

      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value' });
      }).with(sqsWrapper);

      await expect(action({}, context)).to.be.rejected;

      expect(errorSpy).to.have.been.calledWith(
        sinon.match(/Message send failed\. Type: undefined, Code: undefined, Message:/),
        sinon.match.instanceOf(Error),
      );

      scope.done();
    });

    it('initialize and use a new sqs if not initialized before', async () => {
      const messageId = 'message-id';
      const message = { key: 'value' };
      const queueUrl = 'https://sqs.mock-region-1.mockaws.com/123456789012/test-queue';
      const logSpy = sandbox.spy(context.log, 'info');

      nock('https://sqs.mock-region-1.mockaws.com')
        .post('/')
        .reply(200, (_, body) => {
          const { MessageBody, QueueUrl } = JSON.parse(body);
          expect(QueueUrl).to.equal(queueUrl);
          expect(JSON.parse(MessageBody).key).to.equal(message.key);
          return {
            MessageId: messageId,
            MD5OfMessageBody: crypto.createHash('md5').update(MessageBody, 'utf-8').digest('hex'),
          };
        });

      await wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage(queueUrl, message);
      }).with(sqsWrapper)({}, context);

      const queueName = queueUrl.split('/').pop();
      expect(logSpy).to.have.been.calledWith(
        sinon.match(new RegExp(`Success, message sent\\. Queue: ${queueName}, Type: unknown, MessageID: ${messageId}`)),
      );
    });
  });

  describe('SQS helpers', () => {
    let sqsClientStub;
    let sendStub;
    let context;

    beforeEach(() => {
      // Stub the AWS SQS client so we can inspect the arguments we send it
      sqsClientStub = sandbox.createStubInstance(SQSClient);
      sendStub = sandbox.stub().callsFake(() => ({ MessageId: '12345' }));
      sandbox.stub(SQSClient.prototype, 'constructor').callsFake(() => sqsClientStub);
      sandbox.stub(SQSClient.prototype, 'send').callsFake(sendStub);
      context = {
        log: console,
        runtime: {
          region: 'us-east-1',
        },
      };
    });

    afterEach('clean', () => {
      sandbox.restore();
    });

    const exampleHandler = sandbox.spy(async (message, ctx) => {
      const { log } = ctx;
      const messageStr = JSON.stringify(message);
      log.info(`Handling message ${messageStr}`);
      return new Response(messageStr);
    });

    const emptyRequest = {};

    it('should handle an invalid context with no records', async () => {
      const contextNoRecords = {
        log: console,
      };

      const handler = sqsEventAdapter(exampleHandler);
      const response = await handler(emptyRequest, contextNoRecords);

      expect(response.status).to.equal(400);
      expect(response.headers.get('x-error')).to.equal('Event does not contain any records');
    });

    it('returns bad request when record is not valid JSON', async () => {
      const mockLog = {
        debug: sandbox.stub(),
        warn: sandbox.stub(),
        info: sandbox.stub(),
        error: sandbox.stub(),
      };
      const ctx = {
        log: mockLog,
        invocation: {
          event: {
            Records: [
              {
                body: 'not a valid JSON',
                messageId: 'abcd',
              },
            ],
          },
        },
      };

      const handler = sqsEventAdapter(exampleHandler);
      const response = await handler(emptyRequest, ctx);

      expect(response.status).to.equal(400);
      expect(response.headers.get('x-error')).to.equal('Event does not contain a valid message body');
      expect(mockLog.warn).to.have.been.calledOnce;
      expect(mockLog.warn.firstCall.args[0]).to.equal('Function was not invoked properly, message body is not a valid JSON');
    });

    it('should handle a valid context with an event record', async () => {
      const ctx = {
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
      const response = await handler(emptyRequest, ctx);

      expect(response.status).to.equal(200);
      const result = await response.json();
      expect(result.id).to.equal('1234567890');
      expect(exampleHandler.calledWith({ id: '1234567890' })).to.be.true;
    });

    it('should invoke the function with message body out of aws context', async () => {
      delete process.env.AWS_EXECUTION_ENV;
      const ctx = {
        log: console,
      };

      const request = new Request('https://space.cat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: '1234567890' }),
      });

      const handler = sqsEventAdapter(exampleHandler);
      const response = await handler(request, ctx);

      expect(response.status).to.equal(200);
      const result = await response.json();
      expect(result.id).to.equal('1234567890');
      expect(exampleHandler.calledWith({ id: '1234567890' })).to.be.true;
    });

    it('should not include a MessageGroupId when one is not provided', async () => {
      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value' });
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      expect(Object.keys(firstSendArg.input)).to.deep.equal([
        'MessageBody',
        'QueueUrl',
      ]);
    });

    it('should include a MessageGroupId when the queue is a FIFO queue', async () => {
      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/fifo-queue.fifo', { key: 'value' }, 'job-id');
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      expect(Object.keys(firstSendArg.input)).to.deep.equal([
        'MessageBody',
        'QueueUrl',
        'MessageGroupId',
      ]);
      expect(firstSendArg.input.MessageGroupId).to.equal('job-id');
    });

    it('should not include a MessageGroupId when the queue is standard queue', async () => {
      const action = wrap(async (req, ctx) => {
        // Note: no .fifo suffix
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/standard-queue', { key: 'value' }, 'job-id');
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      expect(Object.keys(firstSendArg.input)).to.deep.equal([
        'MessageBody',
        'QueueUrl',
      ]);
      expect(firstSendArg.input.MessageGroupId).to.be.undefined;
    });

    it('should not include a MessageGroupId when the queue URL is undefined', async () => {
      const action = wrap(async (req, ctx) => {
        // Edge case: no queue URL
        await ctx.sqs.sendMessage(undefined, { key: 'value' }, 'job-id');
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      expect(Object.keys(firstSendArg.input)).to.deep.equal([
        'MessageBody',
        'QueueUrl',
      ]);
      expect(firstSendArg.input.MessageGroupId).to.be.undefined;
    });

    it('should include traceId in message when explicitly provided', async () => {
      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value', traceId: '1-explicit-traceid' });
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      const messageBody = JSON.parse(firstSendArg.input.MessageBody);
      expect(messageBody.traceId).to.equal('1-explicit-traceid');
    });

    it('should automatically add traceId from X-Ray when not explicitly provided', async () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
      const getSegmentStub = sandbox.stub(AWSXray, 'getSegment').returns({
        trace_id: '1-xray-auto-traceid',
      });

      const action = wrap(async (req, ctx) => {
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', { key: 'value' });
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      const messageBody = JSON.parse(firstSendArg.input.MessageBody);
      expect(messageBody.traceId).to.equal('1-xray-auto-traceid');

      getSegmentStub.restore();
      delete process.env.AWS_EXECUTION_ENV;
    });

    it('should extract traceId from SQS message and store in context', async () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';

      const ctx = {
        log: console,
        invocation: {
          event: {
            Records: [
              {
                body: JSON.stringify({ id: '1234567890', traceId: '1-sqs-traceid' }),
                messageId: 'abcd',
              },
            ],
          },
        },
      };

      const testHandler = sandbox.spy(async (message, handlerContext) => {
        expect(handlerContext.traceId).to.equal('1-sqs-traceid');
        return new Response('ok');
      });

      const handler = sqsEventAdapter(testHandler);
      await handler({}, ctx);

      expect(testHandler.calledOnce).to.be.true;
      delete process.env.AWS_EXECUTION_ENV;
    });

    it('should not set context.traceId when message has no traceId', async () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';

      const ctx = {
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

      const testHandler = sandbox.spy(async (message, handlerContext) => {
        expect(handlerContext.traceId).to.be.undefined;
        return new Response('ok');
      });

      const handler = sqsEventAdapter(testHandler);
      await handler({}, ctx);

      expect(testHandler.calledOnce).to.be.true;
      delete process.env.AWS_EXECUTION_ENV;
    });

    it('should not include traceId when explicitly set to null (Jobs Dispatcher opt-out)', async () => {
      process.env.AWS_EXECUTION_ENV = 'AWS_Lambda_nodejs18.x';
      const getSegmentStub = sandbox.stub(AWSXray, 'getSegment').returns({
        trace_id: '1-xray-dispatcher-traceid',
      });

      const action = wrap(async (req, ctx) => {
        // Jobs Dispatcher explicitly opts out of trace propagation
        await ctx.sqs.sendMessage('https://sqs.mock-region-1.mockaws.com/123456789012/test-queue', {
          type: 'audit',
          siteId: 'site-001',
          traceId: null, // Explicit opt-out
        });
      }).with(sqsWrapper);

      await action({}, context);

      const firstSendArg = sendStub.getCall(0).args[0];
      const messageBody = JSON.parse(firstSendArg.input.MessageBody);

      // traceId should NOT be in the message
      expect(messageBody).to.not.have.property('traceId');
      expect(messageBody.type).to.equal('audit');
      expect(messageBody.siteId).to.equal('site-001');

      getSegmentStub.restore();
      delete process.env.AWS_EXECUTION_ENV;
    });
  });
});
