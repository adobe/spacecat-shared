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
  const testApiToken = 'api-test-token-67890';

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
    it('should create instance with valid sdkKey', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      expect(client).to.be.instanceOf(LaunchDarklyClient);
      expect(client.sdkKey).to.equal(testSdkKey);
    });

    it('should create instance with only apiToken', () => {
      const client = new LaunchDarklyClient({ apiToken: testApiToken });

      expect(client).to.be.instanceOf(LaunchDarklyClient);
      expect(client.apiToken).to.equal(testApiToken);
      expect(client.sdkKey).to.be.undefined;
    });

    it('should create instance with both sdkKey and apiToken', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey, apiToken: testApiToken });

      expect(client.sdkKey).to.equal(testSdkKey);
      expect(client.apiToken).to.equal(testApiToken);
    });

    it('should throw error when both sdkKey and apiToken are missing', () => {
      expect(() => new LaunchDarklyClient({}))
        .to.throw('LaunchDarkly SDK key or API token is required');
    });

    it('should throw error when both are undefined', () => {
      expect(() => new LaunchDarklyClient({ sdkKey: undefined, apiToken: undefined }))
        .to.throw('LaunchDarkly SDK key or API token is required');
    });

    it('should use default API base URL', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      expect(client.apiBaseUrl).to.equal('https://app.launchdarkly.com');
    });

    it('should accept custom API base URL', () => {
      const client = new LaunchDarklyClient({
        sdkKey: testSdkKey,
        apiBaseUrl: 'https://custom.ld.com',
      });

      expect(client.apiBaseUrl).to.equal('https://custom.ld.com');
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

    it('should create SDK logger that routes info/warn/debug to debug level', () => {
      const customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);

      client.sdkLogger.error('test error');
      expect(customLog.error).to.have.been.calledWith('[LaunchDarkly]', 'test error');

      client.sdkLogger.warn('test warn');
      client.sdkLogger.info('test info');
      client.sdkLogger.debug('test debug');
      expect(customLog.debug).to.have.been.calledThrice;
      expect(customLog.debug).to.have.been.calledWith('[LaunchDarkly]', 'test warn');
      expect(customLog.debug).to.have.been.calledWith('[LaunchDarkly]', 'test info');
      expect(customLog.debug).to.have.been.calledWith('[LaunchDarkly]', 'test debug');
    });
  });

  describe('createFrom', () => {
    it('should create instance from context with sdkKey', () => {
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

    it('should create instance from context with apiToken and apiBaseUrl', () => {
      const context = {
        env: {
          LD_API_TOKEN: testApiToken,
          LD_API_BASE_URL: 'https://custom.ld.com',
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
      expect(client.apiToken).to.equal(testApiToken);
      expect(client.apiBaseUrl).to.equal('https://custom.ld.com');
    });

    it('should throw error when both sdkKey and apiToken are missing from context', () => {
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
        .to.throw('LaunchDarkly SDK key or API token is required');
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

      expect(mockInit).to.have.been.calledOnce;
      expect(mockInit.firstCall.args[0]).to.equal(testSdkKey);
      expect(mockInit.firstCall.args[1]).to.have.property('logger');
      expect(mockClient.waitForInitialization).to.have.been.calledOnce;
      expect(customLog.info).to.have.been.calledWith('LaunchDarkly client initialized successfully');
    });

    it('should throw error when sdkKey is not provided', async () => {
      const client = new LaunchDarklyClient({ apiToken: testApiToken });

      await expect(client.init()).to.be.rejectedWith('LaunchDarkly SDK key is required for flag evaluation');
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

  describe('REST API methods', () => {
    let customLog;
    let fetchStub;

    beforeEach(() => {
      customLog = {
        info: sinon.stub(),
        error: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
      };

      fetchStub = sinon.stub(global, 'fetch');
    });

    afterEach(() => {
      fetchStub.restore();
    });

    describe('common API behavior', () => {
      it('should throw error when apiToken is not provided', async () => {
        const client = new LaunchDarklyClient({ sdkKey: testSdkKey }, customLog);

        await expect(client.getFeatureFlag('proj', 'flag'))
          .to.be.rejectedWith('LaunchDarkly API token is required for REST API operations');
      });

      it('should make authenticated GET request', async () => {
        const responseData = { key: 'test-flag', variations: [] };
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves(responseData),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        const result = await client.getFeatureFlag('proj', 'flag');

        expect(result).to.deep.equal(responseData);
        expect(fetchStub).to.have.been.calledOnce;
        const [url, options] = fetchStub.firstCall.args;
        expect(url).to.equal('https://app.launchdarkly.com/api/v2/flags/proj/flag');
        expect(options.method).to.equal('GET');
        expect(options.headers.Authorization).to.equal(testApiToken);
      });

      it('should throw on non-ok response', async () => {
        fetchStub.resolves({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: sinon.stub().resolves('{"message": "Flag not found"}'),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);

        try {
          await client.getFeatureFlag('proj', 'missing-flag');
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error.message).to.equal('LaunchDarkly API error: 404 Not Found');
          expect(error.status).to.equal(404);
          expect(error.body).to.equal('{"message": "Flag not found"}');
        }
      });

      it('should use custom API base URL', async () => {
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves({}),
        });

        const client = new LaunchDarklyClient({
          apiToken: testApiToken,
          apiBaseUrl: 'https://custom.ld.com',
        }, customLog);
        await client.getFeatureFlag('proj', 'flag');

        const [url] = fetchStub.firstCall.args;
        expect(url).to.equal('https://custom.ld.com/api/v2/flags/proj/flag');
      });
    });

    describe('getFeatureFlag', () => {
      it('should fetch flag without environment filter', async () => {
        const flagData = { key: 'test-flag', variations: [{ _id: 'v1', value: true }] };
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves(flagData),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        const result = await client.getFeatureFlag('my-project', 'test-flag');

        expect(result).to.deep.equal(flagData);
        const [url] = fetchStub.firstCall.args;
        expect(url).to.equal('https://app.launchdarkly.com/api/v2/flags/my-project/test-flag');
      });

      it('should fetch flag with environment filter', async () => {
        const flagData = { key: 'test-flag', environments: { production: {} } };
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves(flagData),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        await client.getFeatureFlag('my-project', 'test-flag', 'production');

        const [url] = fetchStub.firstCall.args;
        expect(url).to.equal('https://app.launchdarkly.com/api/v2/flags/my-project/test-flag?env=production');
      });

      it('should encode special characters in keys', async () => {
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves({}),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        await client.getFeatureFlag('my project', 'flag/key', 'env key');

        const [url] = fetchStub.firstCall.args;
        expect(url).to.include('my%20project');
        expect(url).to.include('flag%2Fkey');
        expect(url).to.include('env%20key');
      });
    });

    describe('updateFallthroughVariation', () => {
      it('should update fallthrough variation', async () => {
        const updatedFlag = { key: 'test-flag' };
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves(updatedFlag),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        const result = await client.updateFallthroughVariation(
          'my-project',
          'test-flag',
          'production',
          'variation-id-123',
        );

        expect(result).to.deep.equal(updatedFlag);

        const [url, options] = fetchStub.firstCall.args;
        expect(url).to.equal('https://app.launchdarkly.com/api/v2/flags/my-project/test-flag');
        expect(options.method).to.equal('PATCH');
        expect(options.headers['Content-Type']).to.equal('application/json; domain-model=launchdarkly.semanticpatch');

        const body = JSON.parse(options.body);
        expect(body.environmentKey).to.equal('production');
        expect(body.instructions).to.deep.equal([
          {
            kind: 'updateFallthroughVariationOrRollout',
            variationId: 'variation-id-123',
          },
        ]);
      });

      it('should include comment when provided', async () => {
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves({}),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        await client.updateFallthroughVariation(
          'my-project',
          'test-flag',
          'production',
          'variation-id-123',
          'Updating default variation',
        );

        const body = JSON.parse(fetchStub.firstCall.args[1].body);
        expect(body.comment).to.equal('Updating default variation');
      });
    });

    describe('updateVariationValue', () => {
      it('should update variation value with JSON patch', async () => {
        const updatedFlag = { key: 'test-flag' };
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves(updatedFlag),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        const result = await client.updateVariationValue(
          'my-project',
          'test-flag',
          0,
          { setting: 'new-value' },
        );

        expect(result).to.deep.equal(updatedFlag);

        const [url, options] = fetchStub.firstCall.args;
        expect(url).to.equal('https://app.launchdarkly.com/api/v2/flags/my-project/test-flag');
        expect(options.method).to.equal('PATCH');
        expect(options.headers['Content-Type']).to.equal('application/json');

        const body = JSON.parse(options.body);
        expect(body[0]).to.deep.equal({
          op: 'replace',
          path: '/variations/0/value',
          value: { setting: 'new-value' },
        });
      });

      it('should include comment as header when provided', async () => {
        fetchStub.resolves({
          ok: true,
          json: sinon.stub().resolves({}),
        });

        const client = new LaunchDarklyClient({ apiToken: testApiToken }, customLog);
        await client.updateVariationValue(
          'my-project',
          'test-flag',
          1,
          'updated-string-value',
          'Changing variation value',
        );

        const [, options] = fetchStub.firstCall.args;
        expect(options.headers['X-LaunchDarkly-Comment']).to.equal('Changing variation value');
        const body = JSON.parse(options.body);
        expect(body).to.have.length(1);
      });
    });
  });

  describe('API surface', () => {
    it('should expose expected public methods', () => {
      const client = new LaunchDarklyClient({ sdkKey: testSdkKey });

      expect(client).to.respondTo('init');
      expect(client).to.respondTo('variation');
      expect(client).to.respondTo('isFlagEnabledForIMSOrg');
      expect(client).to.respondTo('getFeatureFlag');
      expect(client).to.respondTo('updateFallthroughVariation');
      expect(client).to.respondTo('updateVariationValue');

      expect(LaunchDarklyClient.createFrom).to.be.a('function');
    });
  });
});
