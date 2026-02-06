/*
 * Copyright 2025 Adobe. All rights reserved.
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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import esmock from 'esmock';

use(chaiAsPromised);
use(sinonChai);

describe('LaunchDarklyClient', () => {
  let LaunchDarklyClient;
  let mockClient;
  let mockInit;
  const testSdkKey = 'sdk-test-key-12345';

  before(async () => {
    // Create a mock LaunchDarkly client
    mockClient = {
      waitForInitialization: sinon.stub().resolves(),
      variation: sinon.stub().resolves(true),
      close: sinon.stub().resolves(),
    };

    // Mock ld.init
    mockInit = sinon.stub().returns(mockClient);

    // Use esmock to mock the LaunchDarkly SDK dependency
    const module = await esmock('../src/launchdarkly-client.js', {
      '@launchdarkly/node-server-sdk': {
        init: mockInit,
      },
    });

    LaunchDarklyClient = module.default;
  });

  afterEach(() => {
    sinon.resetHistory();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      expect(client).to.be.instanceOf(LaunchDarklyClient);
      expect(client.sdkKey).to.equal(testSdkKey);
    });

    it('should throw error when SDK key is missing', () => {
      expect(() => new LaunchDarklyClient({})).to.throw('LaunchDarkly SDK key is required');
    });

    it('should throw error when SDK key is undefined', () => {
      expect(() => new LaunchDarklyClient({ sdkKey: undefined }))
        .to.throw('LaunchDarkly SDK key is required');
    });

    it('should accept custom logger', () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);

      expect(client.log).to.equal(customLog);
    });

    it('should use console as default logger', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      expect(client.log).to.equal(console);
    });
  });

  describe('createFrom', () => {
    it('should create instance from context', () => {
      const context = {
        env: {
          LD_SDK_KEY: testSdkKey,
        },
        log: {
          info: sinon.stub(),
          error: sinon.stub(),
          debug: sinon.stub(),
          warn: sinon.stub(),
        },
      };

      const client = LaunchDarklyClient.createFrom(context);

      expect(client).to.be.instanceOf(LaunchDarklyClient);
      expect(client.sdkKey).to.equal(testSdkKey);
      expect(client.log).to.equal(context.log);
    });

    it('should throw error when SDK key is missing from context', () => {
      const context = {
        env: {},
        log: {
          info: sinon.stub(),
          error: sinon.stub(),
          debug: sinon.stub(),
          warn: sinon.stub(),
        },
      };

      expect(() => LaunchDarklyClient.createFrom(context))
        .to.throw('LaunchDarkly SDK key is required');
    });
  });

  describe('init', () => {
    it('should initialize LaunchDarkly client', async () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);

      await client.init();

      expect(mockInit).to.have.been.calledOnceWith(testSdkKey, {});
      expect(mockClient.waitForInitialization).to.have.been.calledOnce;
      expect(customLog.info).to.have.been.calledWith('LaunchDarkly client initialized successfully');
    });

    it('should return undefined if already initialized', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });
      await client.init();

      const result = await client.init();

      expect(result).to.be.undefined;
      expect(mockInit).to.have.been.calledOnce;
    });

    it('should handle concurrent initialization calls', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      // Start first init but don't await it yet
      const firstInit = client.init();

      // Immediately call init again while first one is in progress
      const secondInit = client.init();
      const thirdInit = client.init();

      const [result1, result2, result3] = await Promise.all([
        firstInit,
        secondInit,
        thirdInit,
      ]);

      expect(result1).to.be.undefined;
      expect(result2).to.be.undefined;
      expect(result3).to.be.undefined;
      expect(mockInit).to.have.been.calledOnce;
    });

    it('should handle sequential initialization calls', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      // First initialization
      await client.init();

      // Try to initialize again after completion
      const result = await client.init();

      expect(result).to.be.undefined;
      expect(mockInit).to.have.been.calledOnce;
    });

    it('should wait for initPromise when concurrent calls happen', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      // Manually create a scenario where initPromise exists
      // This simulates the exact moment between two concurrent init() calls
      let resolvePromise;
      const testPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      // Set initPromise directly to simulate initialization in progress
      client.initPromise = testPromise;

      // Temporarily set client to null to force the code path
      const originalClient = client.client;
      client.client = null;

      // Now call init() - this should hit lines 66-68
      const initCall = client.init();

      // Verify we're waiting
      expect(client.initPromise).to.equal(testPromise);

      // Restore client and resolve
      client.client = originalClient;
      resolvePromise();

      // Wait for init to complete
      const result = await initCall;
      expect(result).to.be.undefined;
    });

    it('should throw error if initialization fails', async () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const initError = new Error('Initialization failed');
      mockClient.waitForInitialization.rejects(initError);

      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);

      await expect(client.init()).to.be.rejectedWith('Initialization failed');
      expect(customLog.error).to.have.been.calledWith('Failed to initialize LaunchDarkly client:', initError);

      // Reset for other tests
      mockClient.waitForInitialization.resolves();
    });
  });

  describe('variation', () => {
    it('should evaluate a feature flag', async () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);
      const context = { kind: 'user', key: 'test-user' };

      mockClient.variation.resolves(true);

      const result = await client.variation('test-flag', context, false);

      expect(result).to.be.true;
      expect(mockClient.variation).to.have.been.calledWith('test-flag', context, false);
      expect(customLog.debug).to.have.been.calledWith('Flag "test-flag" evaluated to:', true);
    });

    it('should return default value on error', async () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);
      const context = { kind: 'user', key: 'test-user' };
      const flagError = new Error('Flag evaluation failed');

      mockClient.variation.rejects(flagError);

      const result = await client.variation('test-flag', context, false);

      expect(result).to.be.false;
      expect(customLog.error).to.have.been.calledWith('Error evaluating flag "test-flag":', flagError);

      // Reset for other tests
      mockClient.variation.resolves(true);
    });
  });

  describe('isFlagEnabledForIMSOrg', () => {
    it('should check if flag is enabled for IMS org', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });
      mockClient.variation.resolves(true);

      const result = await client.isFlagEnabledForIMSOrg(
        'FT_LLMO-2817',
        '855422996904EB9F0A495F9A@AdobeOrg',
      );

      expect(result).to.be.true;
      expect(mockClient.variation).to.have.been.calledWith(
        'FT_LLMO-2817',
        {
          kind: 'multi',
          user: { key: 'anonymous' },
          organization: {
            key: '855422996904EB9F0A495F9A@AdobeOrg',
            identityProviderId: '855422996904EB9F0A495F9A@AdobeOrg',
          },
        },
        false,
      );
    });

    it('should use custom user key when provided', async () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });
      mockClient.variation.resolves(false);

      const result = await client.isFlagEnabledForIMSOrg(
        'test-flag',
        'test-org-id',
        'custom-user',
      );

      expect(result).to.be.false;
      expect(mockClient.variation).to.have.been.calledWith(
        'test-flag',
        {
          kind: 'multi',
          user: { key: 'custom-user' },
          organization: {
            key: 'test-org-id',
            identityProviderId: 'test-org-id',
          },
        },
        false,
      );
    });
  });

  describe('API surface', () => {
    it('should expose expected public methods', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      // Should have these instance methods
      expect(client).to.respondTo('init');
      expect(client).to.respondTo('variation');
      expect(client).to.respondTo('isFlagEnabledForIMSOrg');

      // Should have static method
      expect(LaunchDarklyClient.createFrom).to.be.a('function');
    });
  });
});
