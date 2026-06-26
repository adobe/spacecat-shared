/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';

describe('edge-optimize support', () => {
  let stsSendStub;
  let cfSendStub;
  let iamSendStub;
  let lambdaSendStub;
  let edgeOptimize;

  // esmock ONCE for the whole file (not per-test) — esmock re-instantiates the mocked module
  // graph on every call and accumulates memory, which contributes to the suite's heap pressure.
  // The mocked clients call the `*SendStub` closures, which read the `let` bindings reassigned
  // fresh in beforeEach, so a single esmock works for all tests.
  before(async function setupEsmock() {
    // One-time esmock of the AWS SDK module graph. This is memory-heavy, so under the full CI
    // suite (12k+ tests + nyc coverage + heap pressure) it can take well over the default/30s
    // even though it runs in ~1s locally. Give the hook generous headroom so it can't flake the
    // whole build on suite growth (it still completes in seconds in practice).
    this.timeout(120000);
    // Each command in a mocked module is a constructor FUNCTION (not a class) — eslint forbids
    // multiple class declarations in one file, so we capture the command name + input on `this`.
    const cfCommand = (Name) => function CloudFrontCommand(input) {
      this.input = input;
      this.commandName = Name;
    };
    const iamCommand = (Name) => function IamCommand(input) {
      this.input = input;
      this.commandName = Name;
    };
    const lambdaCommand = (Name) => function LambdaCommand(input) {
      this.input = input;
      this.commandName = Name;
    };
    edgeOptimize = await esmock('../../../src/cdn/cloudfront/index.js', {
      '@aws-sdk/client-sts': {
        STSClient: function STSClient() {
          this.send = (cmd) => stsSendStub(cmd);
        },
        AssumeRoleCommand: function AssumeRoleCommand(input) {
          this.input = input;
        },
      },
      '@aws-sdk/client-cloudfront': {
        CloudFrontClient: function CloudFrontClient(config) {
          this.config = config;
          this.send = (cmd) => cfSendStub(cmd);
        },
        ListDistributionsCommand: cfCommand('ListDistributions'),
        GetDistributionCommand: cfCommand('GetDistribution'),
        GetDistributionConfigCommand: cfCommand('GetDistributionConfig'),
        GetCachePolicyConfigCommand: cfCommand('GetCachePolicyConfig'),
        GetCachePolicyCommand: cfCommand('GetCachePolicy'),
        ListCachePoliciesCommand: cfCommand('ListCachePolicies'),
        CreateCachePolicyCommand: cfCommand('CreateCachePolicy'),
        UpdateCachePolicyCommand: cfCommand('UpdateCachePolicy'),
        CreateFunctionCommand: cfCommand('CreateFunction'),
        UpdateFunctionCommand: cfCommand('UpdateFunction'),
        DescribeFunctionCommand: cfCommand('DescribeFunction'),
        PublishFunctionCommand: cfCommand('PublishFunction'),
        UpdateDistributionCommand: cfCommand('UpdateDistribution'),
      },
      '@aws-sdk/client-iam': {
        IAMClient: function IAMClient(config) {
          this.config = config;
          this.send = (cmd) => iamSendStub(cmd);
        },
        CreateRoleCommand: iamCommand('CreateRole'),
        GetRoleCommand: iamCommand('GetRole'),
        GetRolePolicyCommand: iamCommand('GetRolePolicy'),
        PutRolePolicyCommand: iamCommand('PutRolePolicy'),
        UpdateAssumeRolePolicyCommand: iamCommand('UpdateAssumeRolePolicy'),
      },
      '@aws-sdk/client-lambda': {
        LambdaClient: function LambdaClient(config) {
          this.config = config;
          this.send = (cmd) => lambdaSendStub(cmd);
        },
        CreateFunctionCommand: lambdaCommand('CreateFunction'),
        UpdateFunctionCodeCommand: lambdaCommand('UpdateFunctionCode'),
        GetFunctionConfigurationCommand: lambdaCommand('GetFunctionConfiguration'),
        ListVersionsByFunctionCommand: lambdaCommand('ListVersionsByFunction'),
        PublishVersionCommand: lambdaCommand('PublishVersion'),
      },
    });
  });

  beforeEach(() => {
    // Fresh stubs per test; the esmocked clients read these `let` bindings at call time.
    stsSendStub = sinon.stub();
    cfSendStub = sinon.stub();
    iamSendStub = sinon.stub();
    lambdaSendStub = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('assumeConnectorRole', () => {
    it('assumes the role and returns mapped credentials', async () => {
      stsSendStub.resolves({
        Credentials: {
          AccessKeyId: 'AKIA',
          SecretAccessKey: 'secret',
          SessionToken: 'token',
          Expiration: new Date('2030-01-01T00:00:00Z'),
        },
      });

      const result = await edgeOptimize.assumeConnectorRole({
        accountId: '120569600543',
        externalId: 'ext-123',
      });

      expect(result.roleArn).to.equal('arn:aws:iam::120569600543:role/AdobeLLMOptimizerCloudFrontConnectorRole');
      expect(result.accountId).to.equal('120569600543');
      expect(result.credentials.accessKeyId).to.equal('AKIA');
      expect(result.credentials.secretAccessKey).to.equal('secret');
      expect(result.credentials.sessionToken).to.equal('token');
      expect(stsSendStub.calledOnce).to.equal(true);
    });

    it('uses a custom role name when provided', async () => {
      stsSendStub.resolves({
        Credentials: { AccessKeyId: 'A', SecretAccessKey: 'S', SessionToken: 'T' },
      });

      const result = await edgeOptimize.assumeConnectorRole({
        accountId: '120569600543',
        externalId: 'ext',
        roleName: 'CustomRole',
      });

      expect(result.roleArn).to.equal('arn:aws:iam::120569600543:role/CustomRole');
    });

    it('throws for an invalid account id', async () => {
      let error;
      try {
        await edgeOptimize.assumeConnectorRole({ accountId: '123', externalId: 'ext' });
      } catch (e) {
        error = e;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('12-digit');
      expect(stsSendStub.called).to.equal(false);
    });

    it('throws when the external id is missing', async () => {
      let error;
      try {
        await edgeOptimize.assumeConnectorRole({ accountId: '120569600543', externalId: '' });
      } catch (e) {
        error = e;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('externalId');
    });

    it('throws when STS returns no credentials', async () => {
      stsSendStub.resolves({});
      let error;
      try {
        await edgeOptimize.assumeConnectorRole({ accountId: '120569600543', externalId: 'ext' });
      } catch (e) {
        error = e;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('no credentials');
    });
  });

  describe('listCloudFrontDistributions', () => {
    it('maps the distribution list to the wizard projection', async () => {
      cfSendStub.resolves({
        DistributionList: {
          Items: [
            {
              Id: 'E123',
              DomainName: 'd.cloudfront.net',
              Aliases: { Items: ['www.example.com'] },
              Status: 'Deployed',
              Enabled: true,
              Comment: 'prod',
            },
          ],
        },
      });

      const result = await edgeOptimize.listCloudFrontDistributions({
        accessKeyId: 'A', secretAccessKey: 'S', sessionToken: 'T',
      });

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({
        id: 'E123',
        domainName: 'd.cloudfront.net',
        aliases: ['www.example.com'],
        status: 'Deployed',
        enabled: true,
        comment: 'prod',
      });
    });

    it('returns an empty array when there are no distributions', async () => {
      cfSendStub.resolves({ DistributionList: {} });

      const result = await edgeOptimize.listCloudFrontDistributions({});

      expect(result).to.deep.equal([]);
    });

    it('defaults aliases and comment when absent and reflects disabled state', async () => {
      cfSendStub.resolves({
        DistributionList: {
          Items: [{
            Id: 'E2', DomainName: 'd2.cloudfront.net', Status: 'InProgress', Enabled: false,
          }],
        },
      });

      const result = await edgeOptimize.listCloudFrontDistributions({});

      expect(result[0].aliases).to.deep.equal([]);
      expect(result[0].comment).to.equal('');
      expect(result[0].enabled).to.equal(false);
    });

    it('paginates through every page when the result is truncated', async () => {
      // First page is truncated (IsTruncated + NextMarker) → a second ListDistributions call must
      // follow the marker; the loop stops once IsTruncated is false. Both pages are aggregated.
      cfSendStub.onFirstCall().resolves({
        DistributionList: {
          IsTruncated: true,
          NextMarker: 'page-2',
          Items: [{
            Id: 'E1', DomainName: 'd1.cloudfront.net', Status: 'Deployed', Enabled: true,
          }],
        },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionList: {
          IsTruncated: false,
          Items: [{
            Id: 'E2', DomainName: 'd2.cloudfront.net', Status: 'Deployed', Enabled: true,
          }],
        },
      });

      const result = await edgeOptimize.listCloudFrontDistributions({});

      expect(cfSendStub.callCount).to.equal(2);
      // The first page is fetched with no Marker; the second follows the NextMarker.
      expect(cfSendStub.firstCall.args[0].input).to.deep.equal({});
      expect(cfSendStub.secondCall.args[0].input).to.deep.equal({ Marker: 'page-2' });
      expect(result.map((d) => d.id)).to.deep.equal(['E1', 'E2']);
    });
  });

  describe('getDistributionConfig', () => {
    it('maps origins, default cache behavior, and ordered cache behaviors', async () => {
      cfSendStub.resolves({
        DistributionConfig: {
          Origins: {
            Items: [
              { Id: 'origin-aem', DomainName: 'origin.example.com', OriginPath: '/content' },
              { Id: 'EdgeOptimizeOrigin', DomainName: 'live.edgeoptimize.net' },
            ],
          },
          DefaultCacheBehavior: { TargetOriginId: 'origin-aem' },
          CacheBehaviors: {
            Items: [
              { PathPattern: '/api/*', TargetOriginId: 'origin-aem' },
            ],
          },
        },
      });

      const result = await edgeOptimize.getDistributionConfig({}, 'E2EXAMPLE');

      expect(cfSendStub.calledOnce).to.equal(true);
      expect(cfSendStub.firstCall.args[0].input).to.deep.equal({ Id: 'E2EXAMPLE' });
      expect(result.origins).to.deep.equal([
        { id: 'origin-aem', domainName: 'origin.example.com', originPath: '/content' },
        { id: 'EdgeOptimizeOrigin', domainName: 'live.edgeoptimize.net', originPath: '' },
      ]);
      expect(result.defaultCacheBehavior).to.deep.equal({
        pathPattern: 'Default (*)',
        targetOriginId: 'origin-aem',
      });
      expect(result.cacheBehaviors).to.deep.equal([
        { pathPattern: '/api/*', targetOriginId: 'origin-aem' },
      ]);
    });

    it('defaults to empty collections when the config is sparse', async () => {
      cfSendStub.resolves({ DistributionConfig: {} });

      const result = await edgeOptimize.getDistributionConfig({}, 'E2EXAMPLE');

      expect(result.origins).to.deep.equal([]);
      expect(result.defaultCacheBehavior).to.equal(null);
      expect(result.cacheBehaviors).to.deep.equal([]);
    });

    it('falls back to an empty config object when DistributionConfig is absent', async () => {
      cfSendStub.resolves({});

      const result = await edgeOptimize.getDistributionConfig({}, 'E2EXAMPLE');

      expect(result.origins).to.deep.equal([]);
      expect(result.defaultCacheBehavior).to.equal(null);
      expect(result.cacheBehaviors).to.deep.equal([]);
    });

    it('falls back to an empty list when the SDK returns nothing', async () => {
      cfSendStub.resolves(undefined);

      const result = await edgeOptimize.getDistributionConfig({}, 'E2EXAMPLE');

      expect(result.origins).to.deep.equal([]);
    });

    it('throws when the distribution id is missing', async () => {
      let error;
      try {
        await edgeOptimize.getDistributionConfig({}, '');
      } catch (e) {
        error = e;
      }
      expect(error).to.be.an('error');
      expect(error.message).to.include('distributionId');
      expect(cfSendStub.called).to.equal(false);
    });
  });

  describe('listCloudFrontDistributions edge cases', () => {
    it('falls back to an empty list when the SDK returns nothing', async () => {
      cfSendStub.resolves(undefined);

      const result = await edgeOptimize.listCloudFrontDistributions({});

      expect(result).to.deep.equal([]);
    });
  });

  describe('createEdgeOptimizeOrigin', () => {
    it('adds the Edge Optimize origin when it does not exist', async () => {
      cfSendStub.onFirstCall().resolves({
        DistributionConfig: { Origins: { Quantity: 1, Items: [{ Id: 'origin-aem', DomainName: 'origin.example.com' }] } },
        ETag: 'etag-1',
      });
      cfSendStub.onSecondCall().resolves({});

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net');

      expect(result).to.deep.equal({
        created: true, alreadyExisted: false, updated: false, originId: 'EdgeOptimize_Origin',
      });
      expect(cfSendStub.secondCall.args[0].commandName).to.equal('UpdateDistribution');
      const update = cfSendStub.secondCall.args[0].input;
      expect(update.IfMatch).to.equal('etag-1');
      const added = update.DistributionConfig.Origins.Items.find((o) => o.Id === 'EdgeOptimize_Origin');
      expect(added.DomainName).to.equal('dev.edgeoptimize.net');
      expect(added.CustomOriginConfig.OriginProtocolPolicy).to.equal('https-only');
    });

    it('defaults the origin domain to the production EO domain', async () => {
      cfSendStub.onFirstCall().resolves({
        DistributionConfig: { Origins: { Items: [] } },
        ETag: 'etag-1',
      });
      cfSendStub.onSecondCall().resolves({});

      await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE');

      const added = cfSendStub.secondCall.args[0].input
        .DistributionConfig.Origins.Items.find((o) => o.Id === 'EdgeOptimize_Origin');
      expect(added.DomainName).to.equal('live.edgeoptimize.net');
    });

    it('handles an absent Origins collection on the config', async () => {
      cfSendStub.onFirstCall().resolves({ DistributionConfig: {}, ETag: 'etag-1' });
      cfSendStub.onSecondCall().resolves({});

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net');

      expect(result.created).to.equal(true);
    });

    it('sets the EO custom headers on the new origin', async () => {
      cfSendStub.onFirstCall().resolves({
        DistributionConfig: { Origins: { Quantity: 1, Items: [{ Id: 'origin-aem', DomainName: 'origin.example.com' }] } },
        ETag: 'etag-1',
      });
      cfSendStub.onSecondCall().resolves({});

      await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net', {
        apiKey: 'eo-key-123', forwardedHost: 'www.example.com', fetcherKey: 'fk-9',
      });

      const update = cfSendStub.secondCall.args[0].input;
      const added = update.DistributionConfig.Origins.Items.find((o) => o.Id === 'EdgeOptimize_Origin');
      expect(added.CustomHeaders.Quantity).to.equal(3);
      const headerMap = added.CustomHeaders.Items.reduce((acc, h) => {
        acc[h.HeaderName] = h.HeaderValue;
        return acc;
      }, {});
      expect(headerMap).to.deep.equal({
        'x-edgeoptimize-api-key': 'eo-key-123',
        'x-forwarded-host': 'www.example.com',
        'x-edgeoptimize-fetcher-key': 'fk-9',
      });
    });

    it('is idempotent when the origin already exists by id', async () => {
      cfSendStub.resolves({
        DistributionConfig: { Origins: { Quantity: 1, Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'x' }] } },
        ETag: 'etag-1',
      });

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE');

      expect(result).to.deep.equal({
        created: false, alreadyExisted: true, updated: false, originId: 'EdgeOptimize_Origin',
      });
      expect(cfSendStub.calledOnce).to.equal(true); // never updated
    });

    it('is idempotent when an origin already uses the EO domain', async () => {
      cfSendStub.resolves({
        DistributionConfig: { Origins: { Items: [{ Id: 'custom', DomainName: 'dev.edgeoptimize.net' }] } },
        ETag: 'etag-1',
      });

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net');

      expect(result.alreadyExisted).to.equal(true);
      expect(cfSendStub.calledOnce).to.equal(true);
    });

    it('patches the headers when the origin exists without them (self-heal)', async () => {
      cfSendStub.onFirstCall().resolves({
        DistributionConfig: {
          Origins: {
            Quantity: 1,
            Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net', CustomHeaders: { Quantity: 0, Items: [] } }],
          },
        },
        ETag: 'etag-1',
      });
      cfSendStub.onSecondCall().resolves({});

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net', {
        apiKey: 'eo-key-123', forwardedHost: 'www.example.com',
      });

      expect(result).to.deep.equal({
        created: false, alreadyExisted: true, updated: true, originId: 'EdgeOptimize_Origin',
      });
      expect(cfSendStub.secondCall.args[0].commandName).to.equal('UpdateDistribution');
      const patched = cfSendStub.secondCall.args[0].input
        .DistributionConfig.Origins.Items.find((o) => o.Id === 'EdgeOptimize_Origin');
      expect(patched.CustomHeaders.Quantity).to.equal(2);
    });

    it('does not patch when the existing headers already match', async () => {
      cfSendStub.resolves({
        DistributionConfig: {
          Origins: {
            Quantity: 1,
            Items: [{
              Id: 'EdgeOptimize_Origin',
              DomainName: 'dev.edgeoptimize.net',
              CustomHeaders: {
                Quantity: 2,
                Items: [
                  { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key-123' },
                  { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                ],
              },
            }],
          },
        },
        ETag: 'etag-1',
      });

      const result = await edgeOptimize.createEdgeOptimizeOrigin({}, 'E2EXAMPLE', 'dev.edgeoptimize.net', {
        apiKey: 'eo-key-123', forwardedHost: 'www.example.com',
      });

      expect(result.updated).to.equal(false);
      expect(cfSendStub.calledOnce).to.equal(true); // no UpdateDistribution
    });

    it('throws when the distribution id is missing', async () => {
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeOrigin({}, '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
      expect(cfSendStub.called).to.equal(false);
    });
  });

  describe('buildCloudfrontFunctionCode', () => {
    it('embeds the default origin id and null targeted paths', () => {
      const code = edgeOptimize.buildCloudfrontFunctionCode('origin-aem');
      expect(code).to.include('{ "originId": "origin-aem" }');
      expect(code).to.include('var TARGETED_PATHS = null;');
      expect(code).to.include("import cf from 'cloudfront';");
    });

    it('embeds explicit targeted paths as JSON', () => {
      const code = edgeOptimize.buildCloudfrontFunctionCode('origin-aem', ['/a', '/b']);
      expect(code).to.include('var TARGETED_PATHS = ["/a","/b"];');
    });
  });

  describe('buildEdgeOptimizeLambdaCode', () => {
    it('bakes the EO origin domain into the routing check (per environment)', () => {
      const dev = edgeOptimize.buildEdgeOptimizeLambdaCode('dev.edgeoptimize.net');
      expect(dev).to.include("originDomain === 'dev.edgeoptimize.net'");
      expect(dev).to.not.include("originDomain === 'live.edgeoptimize.net'");

      const prod = edgeOptimize.buildEdgeOptimizeLambdaCode('live.edgeoptimize.net');
      expect(prod).to.include("originDomain === 'live.edgeoptimize.net'");
    });
  });

  describe('createEdgeOptimizeRoutingFunction', () => {
    it('creates and publishes a new function when none exists', async () => {
      cfSendStub.onFirstCall().rejects(Object.assign(new Error('not found'), { name: 'NoSuchFunctionExists' }));
      cfSendStub.onSecondCall().resolves({ ETag: 'fn-etag' }); // CreateFunction
      cfSendStub.onThirdCall().resolves({}); // PublishFunction

      const result = await edgeOptimize.createEdgeOptimizeRoutingFunction({}, 'origin-aem', 'E2EXAMPLE');

      expect(result).to.deep.equal({ name: 'edgeoptimize-routing-adobe-E2EXAMPLE', created: true, stage: 'LIVE' });
      expect(cfSendStub.secondCall.args[0].commandName).to.equal('CreateFunction');
      expect(cfSendStub.thirdCall.args[0].commandName).to.equal('PublishFunction');
      expect(cfSendStub.thirdCall.args[0].input.IfMatch).to.equal('fn-etag');
    });

    it('updates and publishes when the function already exists', async () => {
      cfSendStub.onFirstCall().resolves({ ETag: 'dev-etag' }); // DescribeFunction DEVELOPMENT
      cfSendStub.onSecondCall().resolves({ ETag: 'updated-etag' }); // UpdateFunction
      cfSendStub.onThirdCall().resolves({}); // PublishFunction

      const result = await edgeOptimize.createEdgeOptimizeRoutingFunction({}, 'origin-aem', 'E2EXAMPLE');

      expect(result.created).to.equal(false);
      expect(cfSendStub.secondCall.args[0].commandName).to.equal('UpdateFunction');
      expect(cfSendStub.thirdCall.args[0].input.IfMatch).to.equal('updated-etag');
    });

    it('throws when defaultOriginId is missing', async () => {
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeRoutingFunction({}, '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('defaultOriginId');
      expect(cfSendStub.called).to.equal(false);
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeRoutingFunction({}, 'origin-aem', '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
      expect(cfSendStub.called).to.equal(false);
    });

    it('rethrows unexpected describe errors', async () => {
      cfSendStub.onFirstCall().rejects(new Error('boom'));
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeRoutingFunction({}, 'origin-aem', 'E2EXAMPLE');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('boom');
    });
  });

  describe('applyEdgeOptimizeCacheHeaders', () => {
    // Dispatch cfSendStub by command name so tests are robust to call order.
    const wireCloudFront = (responders) => {
      cfSendStub.callsFake((cmd) => {
        const fn = responders[cmd.commandName];
        if (!fn) {
          throw new Error(`unexpected command in test: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
    };

    const lastCommand = (name) => cfSendStub.getCalls()
      .filter((c) => c.args[0].commandName === name).pop()?.args[0];

    it('updates a CUSTOM policy to add the EO headers + MinTTL 0', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        ListCachePolicies: { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-x' } }] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'my-policy',
            MinTTL: 60,
            ParametersInCacheKeyAndForwardedToOrigin: {
              HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 1, Items: ['accept'] } },
            },
          },
          ETag: 'cp-etag',
        },
        UpdateCachePolicy: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('custom');
      expect(result.policyId).to.equal('cp-1');
      expect(result.updated).to.equal(true);
      const updated = lastCommand('UpdateCachePolicy').input.CachePolicyConfig;
      expect(updated.MinTTL).to.equal(0);
      const items = updated.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers.Items;
      expect(items).to.include('x-edgeoptimize-config');
      expect(items).to.include('x-edgeoptimize-url');
    });

    it('updates a CUSTOM policy MinTTL only when the headers are already present', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        ListCachePolicies: { CachePolicyList: { Items: [] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'my-policy',
            MinTTL: 99,
            ParametersInCacheKeyAndForwardedToOrigin: {
              HeadersConfig: {
                HeaderBehavior: 'whitelist',
                Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
              },
            },
          },
          ETag: 'cp-etag',
        },
        UpdateCachePolicy: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.updated).to.equal(true);
      const updated = lastCommand('UpdateCachePolicy').input.CachePolicyConfig;
      expect(updated.MinTTL).to.equal(0);
    });

    it('updates a sparse CUSTOM policy (no managed list, no params, no MinTTL)', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        // managed list response has no CachePolicyList → `?.Items || []` (managedIds empty).
        ListCachePolicies: {},
        // custom policy with NO ParametersInCacheKeyAndForwardedToOrigin and NO MinTTL.
        GetCachePolicyConfig: { CachePolicyConfig: { Name: 'bare' }, ETag: 'cp-etag' },
        UpdateCachePolicy: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('custom');
      expect(result.updated).to.equal(true);
      const updated = lastCommand('UpdateCachePolicy').input.CachePolicyConfig;
      const items = updated.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers.Items;
      expect(items).to.include('x-edgeoptimize-config');
    });

    it('does not add headers to a CUSTOM policy with HeaderBehavior allViewer', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        ListCachePolicies: { CachePolicyList: { Items: [] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'my-policy',
            MinTTL: 0,
            ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'allViewer' } },
          },
          ETag: 'cp-etag',
        },
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      // allViewer already forwards all headers + MinTTL already 0 → nothing to do.
      expect(result.updated).to.equal(false);
      expect(result.alreadyForwarded).to.equal(true);
      expect(lastCommand('UpdateCachePolicy')).to.equal(undefined);
    });

    it('respects setMinTTLZero:false (keeps a long MinTTL on a custom policy)', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        ListCachePolicies: { CachePolicyList: { Items: [] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'my-policy',
            MinTTL: 9999,
            ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'none' } },
          },
          ETag: 'cp-etag',
        },
        UpdateCachePolicy: {},
      });

      await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default', { setMinTTLZero: false });

      const updated = lastCommand('UpdateCachePolicy').input.CachePolicyConfig;
      expect(updated.MinTTL).to.equal(9999); // untouched
    });

    it('is a no-op when a custom policy already forwards the headers and MinTTL is 0', async () => {
      wireCloudFront({
        GetDistributionConfig: { DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp-1' } } },
        ListCachePolicies: { CachePolicyList: { Items: [] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'my-policy',
            MinTTL: 0,
            ParametersInCacheKeyAndForwardedToOrigin: {
              HeadersConfig: {
                HeaderBehavior: 'whitelist',
                Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
              },
            },
          },
          ETag: 'cp-etag',
        },
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result).to.deep.equal({
        scenario: 'custom', policyId: 'cp-1', updated: false, alreadyForwarded: true,
      });
      expect(lastCommand('UpdateCachePolicy')).to.equal(undefined); // never updated
    });

    it('CLONES an AWS-managed policy into a per-distribution custom policy and repoints the behavior', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'managed-1', ForwardedValues: { x: 1 } } },
          ETag: 'dist-etag',
        },
        ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
          ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
          : { CachePolicyList: { Items: [] } }), // no existing custom edgeoptimize-cache
        GetCachePolicy: {
          CachePolicy: {
            CachePolicyConfig: {
              Name: 'Managed-CachingOptimized',
              MinTTL: 86400,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'none' } },
            },
          },
        },
        CreateCachePolicy: { CachePolicy: { Id: 'new-eo-policy' } },
        UpdateDistribution: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('managed');
      expect(result.policyId).to.equal('new-eo-policy');
      expect(result.reused).to.equal(false);
      const created = lastCommand('CreateCachePolicy').input.CachePolicyConfig;
      expect(created.Name).to.equal('CachingOptimized-adobe-E2EXAMPLE');
      expect(created.MinTTL).to.equal(0);
      const items = created.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers.Items;
      expect(items).to.include('x-edgeoptimize-config');
      // behavior repointed to the new policy + ForwardedValues removed
      const cfg = lastCommand('UpdateDistribution').input.DistributionConfig;
      expect(cfg.DefaultCacheBehavior.CachePolicyId).to.equal('new-eo-policy');
      expect(cfg.DefaultCacheBehavior.ForwardedValues).to.equal(undefined);
    });

    it('keeps a short MinTTL (<=5s) when cloning a managed policy instead of forcing it to 0', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'managed-1' } },
          ETag: 'dist-etag',
        },
        ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
          ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
          : { CachePolicyList: { Items: [] } }),
        GetCachePolicy: {
          CachePolicy: {
            CachePolicyConfig: {
              Name: 'Managed-CachingOptimized',
              MinTTL: 3,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'none' } },
            },
          },
        },
        CreateCachePolicy: { CachePolicy: { Id: 'new-eo-policy' } },
        UpdateDistribution: {},
      });

      await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      const created = lastCommand('CreateCachePolicy').input.CachePolicyConfig;
      expect(created.MinTTL).to.equal(3); // <= 5s kept, not zeroed
    });

    it('clones a managed policy with sparse reads (no params, no custom list)', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'managed-1' } },
          ETag: 'dist-etag',
        },
        ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
          ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
          : {}), // custom list response has no CachePolicyList → `?.Items || []` fallback
        GetCachePolicy: {
          // source has NO ParametersInCacheKeyAndForwardedToOrigin → `cloned... || {}` fallback
          CachePolicy: { CachePolicyConfig: { Name: 'Managed-Basic' } },
        },
        CreateCachePolicy: { CachePolicy: { Id: 'new-eo-policy' } },
        UpdateDistribution: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('managed');
      expect(result.reused).to.equal(false);
      const created = lastCommand('CreateCachePolicy').input.CachePolicyConfig;
      const items = created.ParametersInCacheKeyAndForwardedToOrigin.HeadersConfig.Headers.Items;
      expect(items).to.include('x-edgeoptimize-config');
    });

    it('reuses an existing edgeoptimize-cache custom policy (idempotent managed path)', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'managed-1' } },
          ETag: 'dist-etag',
        },
        ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
          ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
          : { CachePolicyList: { Items: [{ CachePolicy: { Id: 'existing-eo', CachePolicyConfig: { Name: 'X-adobe-E2EXAMPLE' } } }] } }),
        GetCachePolicy: {
          CachePolicy: { CachePolicyConfig: { Name: 'Managed-X', ParametersInCacheKeyAndForwardedToOrigin: {} } },
        },
        UpdateDistribution: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('managed');
      expect(result.policyId).to.equal('existing-eo');
      expect(result.reused).to.equal(true);
      expect(lastCommand('CreateCachePolicy')).to.equal(undefined); // reused, not created
    });

    it('handles a LEGACY behavior (ForwardedValues, no CachePolicyId)', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: {
            DefaultCacheBehavior: { ForwardedValues: { Headers: { Quantity: 1, Items: ['accept'] } }, MinTTL: 60 },
          },
          ETag: 'dist-etag',
        },
        UpdateDistribution: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('legacy');
      expect(result.updated).to.equal(true);
      const cfg = lastCommand('UpdateDistribution').input.DistributionConfig;
      const items = cfg.DefaultCacheBehavior.ForwardedValues.Headers.Items;
      expect(items).to.include('x-edgeoptimize-config');
      expect(cfg.DefaultCacheBehavior.MinTTL).to.equal(0);
    });

    it('handles a sparse LEGACY behavior (no ForwardedValues / Headers / MinTTL)', async () => {
      wireCloudFront({
        // legacy (no CachePolicyId), NO ForwardedValues / Headers / MinTTL → `|| {}`,
        // `?.Items || []`, and `behavior.MinTTL ?? 0` fallbacks.
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: {} },
          ETag: 'dist-etag',
        },
        UpdateDistribution: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('legacy');
      expect(result.updated).to.equal(true);
      const cfg = lastCommand('UpdateDistribution').input.DistributionConfig;
      expect(cfg.DefaultCacheBehavior.ForwardedValues.Headers.Items).to.include('x-edgeoptimize-config');
    });

    it('is a no-op LEGACY behavior when headers already forwarded and MinTTL short', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: {
            DefaultCacheBehavior: {
              ForwardedValues: { Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              MinTTL: 0,
            },
          },
          ETag: 'dist-etag',
        },
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result).to.deep.equal({
        scenario: 'legacy', policyId: null, updated: false, alreadyForwarded: true,
      });
    });

    it('does not add headers on a LEGACY behavior that already forwards "*"', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: {
            DefaultCacheBehavior: { ForwardedValues: { Headers: { Quantity: 1, Items: ['*'] } }, MinTTL: 0 },
          },
          ETag: 'dist-etag',
        },
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', 'default');

      expect(result.scenario).to.equal('legacy');
      expect(result.updated).to.equal(false);
    });

    it('targets a named (non-default) custom-policy behavior', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: {
            DefaultCacheBehavior: { CachePolicyId: 'cp-default' },
            CacheBehaviors: { Items: [{ PathPattern: '/api/*', CachePolicyId: 'cp-api' }] },
          },
        },
        ListCachePolicies: { CachePolicyList: { Items: [] } },
        GetCachePolicyConfig: {
          CachePolicyConfig: {
            Name: 'api',
            MinTTL: 0,
            ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'none' } },
          },
          ETag: 'cp-etag',
        },
        UpdateCachePolicy: {},
      });

      const result = await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', '/api/*');
      expect(result.policyId).to.equal('cp-api');
      expect(lastCommand('GetCachePolicyConfig').input.Id).to.equal('cp-api');
    });

    it('throws when a named behavior is not found', async () => {
      wireCloudFront({
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp' }, CacheBehaviors: { Items: [] } },
        },
      });

      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', '/missing/*');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('Behavior not found: /missing/*');
    });

    it('throws for a named behavior when the config has no CacheBehaviors at all', async () => {
      wireCloudFront({
        // no CacheBehaviors → `config.CacheBehaviors?.Items || []` fallback in getBehavior.
        GetDistributionConfig: {
          DistributionConfig: { DefaultCacheBehavior: { CachePolicyId: 'cp' } },
        },
      });

      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', '/api/*');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('Behavior not found: /api/*');
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, '', 'default');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
    });

    it('throws when pathPattern is missing', async () => {
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeCacheHeaders({}, 'E2EXAMPLE', '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('pathPattern');
    });
  });

  describe('buildEoClonedCachePolicyName', () => {
    it('strips the Managed- prefix and appends the per-dist suffix', () => {
      expect(edgeOptimize.buildEoClonedCachePolicyName('Managed-CachingOptimized', 'E1'))
        .to.equal('CachingOptimized-adobe-E1');
    });

    it('defaults the base name when the source is empty', () => {
      expect(edgeOptimize.buildEoClonedCachePolicyName('', 'E1')).to.equal('cache-adobe-E1');
    });
  });

  describe('buildLambdaZip', () => {
    it('produces a zip buffer with the local-file-header signature', () => {
      const zip = edgeOptimize.buildLambdaZip('index.mjs', 'console.log(1)');
      expect(Buffer.isBuffer(zip)).to.equal(true);
      expect(zip.readUInt32LE(0)).to.equal(0x04034b50);
    });

    it('accepts a Buffer payload directly', () => {
      const zip = edgeOptimize.buildLambdaZip('index.mjs', Buffer.from('console.log(2)', 'utf-8'));
      expect(Buffer.isBuffer(zip)).to.equal(true);
      expect(zip.readUInt32LE(0)).to.equal(0x04034b50);
    });
  });

  describe('createEdgeOptimizeLambda', () => {
    const creds = { accessKeyId: 'A', secretAccessKey: 'S', sessionToken: 'T' };

    // IAM + Lambda stubs dispatch by command name (robust to call order/poll counts).
    const wireIam = (responders) => {
      iamSendStub.callsFake((cmd) => {
        const r = responders[cmd.commandName];
        return Promise.resolve(typeof r === 'function' ? r(cmd) : (r || {}));
      });
    };
    const wireLambda = (responders) => {
      lambdaSendStub.callsFake((cmd) => {
        const r = responders[cmd.commandName];
        if (r === undefined) {
          throw new Error(`unexpected lambda command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof r === 'function' ? r(cmd) : r);
      });
    };
    const lastLambda = (name) => lambdaSendStub.getCalls()
      .filter((c) => c.args[0].commandName === name).pop()?.args[0];
    const notFound = () => Promise.reject(Object.assign(new Error('nf'), { name: 'ResourceNotFoundException' }));

    it('returns provisioning WITHOUT CreateFunction when the role was just created', async () => {
      // Root-cause fix for the 503 first-byte timeout: a freshly-created IAM role needs time to
      // propagate, so we must NOT wait + CreateFunction in this same request. Return provisioning
      // immediately; the next poll (role now exists → roleIsNew false) performs the create.
      wireIam({
        GetRole: () => Promise.reject(Object.assign(new Error('no role'), { name: 'NoSuchEntityException' })),
        CreateRole: { Role: { Arn: 'arn:aws:iam::120569600543:role/edgeoptimize-origin-role' } },
        PutRolePolicy: {},
      });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: { FunctionArn: 'arn:fn' },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      expect(result.status).to.equal('provisioning');
      expect(result.created).to.equal(true);
      expect(result.functionArn).to.equal(null);
      expect(result.versionArn).to.equal(null);
      expect(result.roleArn).to.include('edgeoptimize-origin-role');
      // The expensive work is deferred: no CreateFunction (and no PublishVersion) this call.
      expect(lastLambda('CreateFunction')).to.equal(undefined);
      expect(lastLambda('PublishVersion')).to.equal(undefined);
    });

    it('creates the function (non-blocking) and returns provisioning when the role already exists', async () => {
      // Existing role + missing function: proceed to CreateFunction in the SAME call (unchanged).
      wireIam({
        GetRole: { Role: { Arn: 'arn:aws:iam::120569600543:role/edgeoptimize-origin-role' } },
        UpdateAssumeRolePolicy: {},
        PutRolePolicy: {},
      });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: { FunctionArn: 'arn:fn' },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      // Does NOT block on the new function becoming Active — returns provisioning immediately.
      expect(result.status).to.equal('provisioning');
      expect(result.created).to.equal(true);
      expect(result.functionArn).to.equal('arn:fn');
      expect(result.versionArn).to.equal(null);
      expect(result.roleArn).to.include('edgeoptimize-origin-role');
      expect(lastLambda('CreateFunction').input.Role).to.include('edgeoptimize-origin-role');
      expect(lastLambda('PublishVersion')).to.equal(undefined); // never publishes while Pending
    });

    it('retries CreateFunction on role-propagation then succeeds', async () => {
      let createAttempts = 0;
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: () => {
          createAttempts += 1;
          if (createAttempts === 1) {
            return Promise.reject(Object.assign(
              new Error('The role defined for the function cannot be assumed by Lambda.'),
              { name: 'InvalidParameterValueException' },
            ));
          }
          return Promise.resolve({ FunctionArn: 'arn:fn' });
        },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { retryDelayMs: 1, distributionId: 'E2EXAMPLE' });
      expect(result.status).to.equal('provisioning');
      expect(createAttempts).to.equal(2);
    });

    it('rethrows a non-role-propagation CreateFunction error', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: () => Promise.reject(Object.assign(new Error('boom'), { name: 'SomethingElse' })),
      });

      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('boom');
    });

    it('rethrows an InvalidParameterValue error with no message (not role propagation)', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        // name is InvalidParameterValueException but message is empty → `(message || '')` fallback,
        // `.includes('role')` is false → not role-propagation → rethrow immediately.
        CreateFunction: () => {
          const e = new Error('');
          e.name = 'InvalidParameterValueException';
          e.message = '';
          return Promise.reject(e);
        },
      });

      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });
      } catch (e) {
        error = e;
      }
      expect(error.name).to.equal('InvalidParameterValueException');
    });

    it('gives up after the retry budget on persistent role-propagation', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: () => Promise.reject(Object.assign(
          new Error('The role defined for the function cannot be assumed by Lambda.'),
          { name: 'InvalidParameterValueException' },
        )),
      });

      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { retryDelayMs: 1, distributionId: 'E2EXAMPLE' });
      } catch (e) {
        error = e;
      }
      expect(error.name).to.equal('InvalidParameterValueException');
    });

    it('rethrows an unexpected GetRole error', async () => {
      wireIam({ GetRole: () => Promise.reject(Object.assign(new Error('access denied'), { name: 'AccessDenied' })) });
      lambdaSendStub.callsFake(() => Promise.resolve({}));

      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('access denied');
    });

    it('rethrows an unexpected GetFunctionConfiguration error', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => Promise.reject(Object.assign(new Error('throttled'), { name: 'TooManyRequestsException' })),
      });

      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('throttled');
    });

    it('returns provisioning (no mutation) while the function is still finalizing', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: {
          FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'InProgress',
        },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      expect(result.status).to.equal('provisioning');
      expect(result.versionArn).to.equal(null);
      expect(lastLambda('PublishVersion')).to.equal(undefined); // never touched while InProgress
    });

    it('is idempotent: reuses the existing version when the function is idle', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: {
          FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful',
        },
        ListVersionsByFunction: { Versions: [{ Version: '$LATEST' }, { Version: '3', FunctionArn: 'arn:fn:3' }] },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      expect(result.status).to.equal('ready');
      expect(result.alreadyExisted).to.equal(true);
      expect(result.versionArn).to.equal('arn:fn:3');
      expect(lastLambda('PublishVersion')).to.equal(undefined); // reused, not re-published
    });

    it('publishes a version when the function is idle but unpublished', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: {
          FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful',
        },
        ListVersionsByFunction: { Versions: [{ Version: '$LATEST' }] },
        PublishVersion: { FunctionArn: 'arn:fn:1', Version: '1' },
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      expect(result.status).to.equal('ready');
      expect(result.versionArn).to.equal('arn:fn:1');
      expect(lastLambda('PublishVersion')).to.not.equal(undefined);
    });

    it('treats a concurrent-create conflict as provisioning', async () => {
      wireIam({ GetRole: { Role: { Arn: 'arn:role' } }, UpdateAssumeRolePolicy: {}, PutRolePolicy: {} });
      wireLambda({
        GetFunctionConfiguration: () => notFound(),
        CreateFunction: () => Promise.reject(Object.assign(new Error('exists'), { name: 'ResourceConflictException' })),
      });

      const result = await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', { distributionId: 'E2EXAMPLE' });

      expect(result.status).to.equal('provisioning');
    });

    it('throws for an invalid account id', async () => {
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '123');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('12-digit');
      expect(iamSendStub.called).to.equal(false);
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.createEdgeOptimizeLambda(creds, '120569600543', {});
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
      expect(iamSendStub.called).to.equal(false);
    });
  });

  describe('getEdgeOptimizeLambdaStatus', () => {
    it('reports roleExists:false + exists:false when nothing is provisioned', async () => {
      iamSendStub.callsFake(() => Promise.reject(Object.assign(new Error('no role'), { name: 'NoSuchEntityException' })));
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.reject(Object.assign(new Error('nf'), { name: 'ResourceNotFoundException' }));
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result).to.deep.equal({
        roleExists: false, roleOk: false, exists: false, versionArn: null, ready: false,
      });
    });

    it('reports the role (roleOk) + published version and ready:true when fully provisioned', async () => {
      const trust = encodeURIComponent(JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] },
          Action: 'sts:AssumeRole',
        }],
      }));
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role', AssumeRolePolicyDocument: trust } });
        }
        if (cmd.commandName === 'GetRolePolicy') {
          return Promise.resolve({ PolicyName: 'EdgeOptimizeLambdaLogging', PolicyDocument: '{}' });
        }
        throw new Error(`unexpected iam: ${cmd.commandName}`);
      });
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful' });
        }
        if (cmd.commandName === 'ListVersionsByFunction') {
          return Promise.resolve({ Versions: [{ Version: '$LATEST' }, { Version: '2', FunctionArn: 'arn:fn:2' }] });
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result.roleExists).to.equal(true);
      expect(result.roleOk).to.equal(true);
      expect(result.exists).to.equal(true);
      expect(result.state).to.equal('Active');
      expect(result.versionArn).to.equal('arn:fn:2');
      expect(result.version).to.equal('2');
      expect(result.ready).to.equal(true);
    });

    it('marks roleOk:false when the trust document does not parse', async () => {
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role', AssumeRolePolicyDocument: '%ZZ-not-json' } });
        }
        if (cmd.commandName === 'GetRolePolicy') {
          return Promise.resolve({ PolicyName: 'EdgeOptimizeLambdaLogging' });
        }
        throw new Error(`unexpected iam: ${cmd.commandName}`);
      });
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful' });
        }
        if (cmd.commandName === 'ListVersionsByFunction') {
          return Promise.resolve({ Versions: [{ Version: '1', FunctionArn: 'arn:fn:1' }] });
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result.roleExists).to.equal(true);
      expect(result.roleOk).to.equal(false); // trust unparsable → trustOk false
    });

    it('marks roleOk:false when the logs policy is absent', async () => {
      const trust = encodeURIComponent(JSON.stringify({
        Statement: [{ Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] } }],
      }));
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role', AssumeRolePolicyDocument: trust } });
        }
        if (cmd.commandName === 'GetRolePolicy') {
          return Promise.reject(Object.assign(new Error('no policy'), { name: 'NoSuchEntityException' }));
        }
        throw new Error(`unexpected iam: ${cmd.commandName}`);
      });
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful' });
        }
        if (cmd.commandName === 'ListVersionsByFunction') {
          return Promise.resolve({ Versions: [{ Version: '1', FunctionArn: 'arn:fn:1' }] });
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result.roleOk).to.equal(false);
    });

    it('rethrows a non-NoSuchEntity GetRole error', async () => {
      iamSendStub.callsFake(() => Promise.reject(Object.assign(new Error('denied'), { name: 'AccessDenied' })));
      lambdaSendStub.callsFake(() => Promise.resolve({}));

      let error;
      try {
        await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('denied');
    });

    it('rethrows a non-NoSuchEntity GetRolePolicy error', async () => {
      const trust = encodeURIComponent(JSON.stringify({
        Statement: [{ Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] } }],
      }));
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role', AssumeRolePolicyDocument: trust } });
        }
        return Promise.reject(Object.assign(new Error('denied'), { name: 'AccessDenied' }));
      });
      lambdaSendStub.callsFake(() => Promise.resolve({}));

      let error;
      try {
        await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('denied');
    });

    it('rethrows a non-ResourceNotFound GetFunctionConfiguration error', async () => {
      iamSendStub.callsFake(() => Promise.reject(Object.assign(new Error('no role'), { name: 'NoSuchEntityException' })));
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.reject(Object.assign(new Error('throttled'), { name: 'TooManyRequestsException' }));
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      let error;
      try {
        await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.equal('throttled');
    });

    it('handles a role with no trust document at all', async () => {
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role' } });
        }
        if (cmd.commandName === 'GetRolePolicy') {
          return Promise.resolve({ PolicyName: 'EdgeOptimizeLambdaLogging' });
        }
        throw new Error(`unexpected iam: ${cmd.commandName}`);
      });
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful' });
        }
        return Promise.resolve({ Versions: [{ Version: '1', FunctionArn: 'arn:fn:1' }] });
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');
      expect(result.roleOk).to.equal(false); // no trust doc → trustOk false
    });

    it('treats a missing Versions list as no published version (ready:false)', async () => {
      const trust = encodeURIComponent(JSON.stringify({
        Statement: [{ Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] } }],
      }));
      iamSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetRole') {
          return Promise.resolve({ Role: { Arn: 'arn:role', AssumeRolePolicyDocument: trust } });
        }
        return Promise.resolve({ PolicyName: 'EdgeOptimizeLambdaLogging' });
      });
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Active', LastUpdateStatus: 'Successful' });
        }
        // ListVersionsByFunction returns NO Versions field → `resp.Versions || []` fallback.
        return Promise.resolve({});
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result.exists).to.equal(true);
      expect(result.versionArn).to.equal(null);
      expect(result.ready).to.equal(false);
    });

    it('reports ready:false (role created, still provisioning) when not yet published', async () => {
      iamSendStub.callsFake(() => Promise.resolve({ Role: { Arn: 'arn:role' } }));
      lambdaSendStub.callsFake((cmd) => {
        if (cmd.commandName === 'GetFunctionConfiguration') {
          return Promise.resolve({ FunctionArn: 'arn:fn', State: 'Pending', LastUpdateStatus: 'InProgress' });
        }
        if (cmd.commandName === 'ListVersionsByFunction') {
          return Promise.resolve({ Versions: [{ Version: '$LATEST' }] });
        }
        throw new Error(`unexpected: ${cmd.commandName}`);
      });

      const result = await edgeOptimize.getEdgeOptimizeLambdaStatus({}, 'E2EXAMPLE');

      expect(result.roleExists).to.equal(true);
      expect(result.exists).to.equal(true);
      expect(result.versionArn).to.equal(null);
      expect(result.ready).to.equal(false);
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.getEdgeOptimizeLambdaStatus({}, '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
    });
  });

  describe('applyEdgeOptimizeAssociations', () => {
    const lambdaArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:1';

    it('wires the CF function (viewer-request) and Lambda (origin req/res) onto the behavior', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: { DefaultCacheBehavior: {} },
        ETag: 'dist-etag',
      });
      cfSendStub.onThirdCall().resolves({});

      const result = await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);

      expect(result).to.deep.equal({ cfFunctionArn: 'arn:cf-fn', lambdaArn });
      const update = cfSendStub.thirdCall.args[0];
      expect(update.commandName).to.equal('UpdateDistribution');
      const behavior = update.input.DistributionConfig.DefaultCacheBehavior;
      expect(behavior.FunctionAssociations.Items[0]).to.deep.equal({ FunctionARN: 'arn:cf-fn', EventType: 'viewer-request' });
      expect(behavior.LambdaFunctionAssociations.Quantity).to.equal(2);
      expect(behavior.LambdaFunctionAssociations.Items.map((i) => i.EventType)).to.deep.equal(['origin-request', 'origin-response']);
    });

    it('throws when the CF function is not published to LIVE', async () => {
      cfSendStub.onFirstCall().resolves({ FunctionSummary: {} });
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('not found or not published');
    });

    it('surfaces a conflicting viewer-request association', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: {
          DefaultCacheBehavior: {
            FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:other-fn' }] },
          },
        },
        ETag: 'dist-etag',
      });
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('already has a different viewer-request function');
    });

    it('surfaces a conflicting viewer-request Lambda@Edge association', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: {
          DefaultCacheBehavior: {
            LambdaFunctionAssociations: { Items: [{ EventType: 'viewer-request', LambdaFunctionARN: 'arn:cust-viewer-lambda' }] },
          },
        },
        ETag: 'dist-etag',
      });
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('viewer-request Lambda@Edge');
    });

    it('preserves the customer\'s other-slot associations (merge, not wholesale replace)', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: {
          DefaultCacheBehavior: {
            FunctionAssociations: {
              Quantity: 1,
              Items: [{ EventType: 'viewer-response', FunctionARN: 'arn:cust-fn' }],
            },
            LambdaFunctionAssociations: {
              Quantity: 1,
              Items: [{ EventType: 'viewer-response', LambdaFunctionARN: 'arn:cust-lambda', IncludeBody: false }],
            },
          },
        },
        ETag: 'dist-etag',
      });
      cfSendStub.onThirdCall().resolves({});

      await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      const behavior = cfSendStub.thirdCall.args[0].input.DistributionConfig.DefaultCacheBehavior;
      // Customer's viewer-response function is preserved; EO's viewer-request function is added.
      expect(behavior.FunctionAssociations.Items)
        .to.deep.include({ EventType: 'viewer-response', FunctionARN: 'arn:cust-fn' });
      expect(behavior.FunctionAssociations.Items)
        .to.deep.include({ FunctionARN: 'arn:cf-fn', EventType: 'viewer-request' });
      // Customer's viewer-response lambda is preserved; EO's origin-request/response are added.
      const lambdaEvents = behavior.LambdaFunctionAssociations.Items.map((i) => i.EventType);
      expect(lambdaEvents).to.include.members(['viewer-response', 'origin-request', 'origin-response']);
      expect(behavior.LambdaFunctionAssociations.Items
        .find((i) => i.EventType === 'viewer-response').LambdaFunctionARN).to.equal('arn:cust-lambda');
    });

    it('targets a named (non-default) behavior', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: { CacheBehaviors: { Items: [{ PathPattern: '/api/*' }] } },
        ETag: 'dist-etag',
      });
      cfSendStub.onThirdCall().resolves({});

      await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', '/api/*', lambdaArn);
      const { DistributionConfig } = cfSendStub.thirdCall.args[0].input;
      const behavior = DistributionConfig.CacheBehaviors.Items[0];
      expect(behavior.FunctionAssociations.Items.map((i) => i.EventType)).to.include('viewer-request');
    });

    it('refuses an origin-request Lambda@Edge association that carries no ARN', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: {
          DefaultCacheBehavior: {
            // origin-request lambda with NO LambdaFunctionARN → isEdgeOptimizeLambdaArn(undefined)
            // exercises the `arn || ''` fallback → not EO → conflict.
            LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request' }] },
          },
        },
        ETag: 'dist-etag',
      });
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('different origin-request');
    });

    it('refuses to overwrite a customer origin-request Lambda@Edge', async () => {
      cfSendStub.onFirstCall().resolves({
        FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } },
      });
      cfSendStub.onSecondCall().resolves({
        DistributionConfig: {
          DefaultCacheBehavior: {
            LambdaFunctionAssociations: {
              Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:cust-origin-lambda' }],
            },
          },
        },
        ETag: 'dist-etag',
      });
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('different origin-request');
      expect(cfSendStub.thirdCall).to.equal(null); // never issued an UpdateDistribution
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, '', 'default', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
      expect(cfSendStub.called).to.equal(false);
    });

    it('throws when pathPattern is missing', async () => {
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', '', lambdaArn);
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('pathPattern');
      expect(cfSendStub.called).to.equal(false);
    });

    it('throws when lambdaVersionArn is missing', async () => {
      let error;
      try {
        await edgeOptimize.applyEdgeOptimizeAssociations({}, 'E2EXAMPLE', 'default', '');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('lambdaVersionArn');
      expect(cfSendStub.called).to.equal(false);
    });
  });

  describe('verifyEdgeOptimizeRouting', () => {
    let fetchStub;

    const makeResponse = (status, headerMap) => ({
      status,
      headers: { forEach: (cb) => Object.entries(headerMap).forEach(([k, v]) => cb(v, k)) },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    afterEach(() => {
      if (fetchStub) {
        fetchStub.restore();
      }
      fetchStub = undefined;
    });

    it('passes when the bot response carries x-edgeoptimize-request-id and the human does not', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'req-123' }));
      fetchStub.onSecondCall().resolves(makeResponse(200, {}));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.passed).to.equal(true);
      expect(result.requestId).to.equal('req-123');
      expect(result.details.bot.status).to.equal(200);
    });

    it('ignores non-edgeoptimize response headers', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'req-1', 'content-type': 'text/html' }));
      fetchStub.onSecondCall().resolves(makeResponse(200, { 'cache-control': 'no-store' }));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.details.bot.headers['content-type']).to.equal(undefined);
      expect(result.passed).to.equal(true);
    });

    it('does NOT pass when only failover (x-edgeoptimize-fo) is present', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeResponse(200, { 'x-edgeoptimize-fo': '1' }));
      fetchStub.onSecondCall().resolves(makeResponse(200, {}));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.passed).to.equal(false);
      expect(result.requestId).to.equal(null);
    });

    it('does NOT pass when the human response is also optimized', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'req-123' }));
      fetchStub.onSecondCall().resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'req-999' }));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.passed).to.equal(false);
    });

    it('does NOT pass when the human response carries the proxy marker', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'req-123' }));
      fetchStub.onSecondCall().resolves(makeResponse(200, { 'x-edgeoptimize-proxy': '1' }));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.passed).to.equal(false);
    });

    it('passes a bounded AbortSignal to each probe', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.resolves(makeResponse(200, { 'x-edgeoptimize-request-id': 'r' }));

      await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      // Each probe carries an AbortSignal so it can be cancelled at the bounded timeout.
      expect(fetchStub.firstCall.args[1].signal).to.be.instanceOf(AbortSignal);
      expect(edgeOptimize.EDGE_OPTIMIZE_VERIFY_PROBE_TIMEOUT_MS).to.equal(20000);
    });

    it('resolves passed:false on a network error instead of throwing', async () => {
      fetchStub = sinon.stub(global, 'fetch');
      // Bot probe errors at the network layer; it must resolve to a non-passing { status: 0 }
      // result (NOT throw) so the FE poll loop simply retries. The human probe still runs.
      fetchStub.onFirstCall().rejects(new Error('ECONNREFUSED'));
      fetchStub.onSecondCall().resolves(makeResponse(200, {}));

      const result = await edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');

      expect(result.passed).to.equal(false);
      expect(result.requestId).to.equal(null);
      expect(result.details.bot.status).to.equal(0);
      expect(result.details.bot.headers).to.deep.equal({});
      // A plain network error is not flagged as a timeout.
      expect(result.details.bot.timedOut).to.equal(undefined);
      expect(result.details.human.status).to.equal(200);
    });

    it('aborts a probe that exceeds the bounded timeout and resolves passed:false', async () => {
      const clock = sinon.useFakeTimers();
      fetchStub = sinon.stub(global, 'fetch');
      // Bot probe hangs until its abort signal fires (the bounded-timeout abort); the human
      // probe resolves immediately. Driving the fake clock past the timeout triggers the abort.
      fetchStub.onFirstCall().callsFake((url, opts) => new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }));
      fetchStub.onSecondCall().resolves(makeResponse(200, {}));

      const promise = edgeOptimize.verifyEdgeOptimizeRouting('https://d.cloudfront.net/');
      await clock.tickAsync(edgeOptimize.EDGE_OPTIMIZE_VERIFY_PROBE_TIMEOUT_MS);
      const result = await promise;

      expect(result.passed).to.equal(false);
      expect(result.requestId).to.equal(null);
      expect(result.details.bot.status).to.equal(0);
      // An abort (timeout) is flagged so callers can tell "still warming up" from a hard failure.
      expect(result.details.bot.timedOut).to.equal(true);
      clock.restore();
    });

    it('throws when url is missing', async () => {
      let error;
      try {
        await edgeOptimize.verifyEdgeOptimizeRouting('');
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('url');
    });
  });

  describe('EDGE_OPTIMIZE_DEPLOY_STEPS', () => {
    it('exposes the ordered step contract', () => {
      expect(edgeOptimize.EDGE_OPTIMIZE_DEPLOY_STEPS.map((s) => s.key)).to.deep.equal([
        'origin', 'function', 'cache', 'lambda', 'associate', 'propagation', 'verify',
      ]);
    });
  });

  describe('runEdgeOptimizeDeployStep', () => {
    let fetchStub;
    const deployParams = {
      distributionId: 'E2EXAMPLE123',
      originId: 'origin-aem',
      behavior: 'default',
      originDomain: 'dev.edgeoptimize.net',
      originHeaders: { apiKey: 'eo-key', forwardedHost: 'www.example.com' },
      accountId: '120569600543',
    };

    // Dispatch each client's send() by command name; per-test overrides via the `r` map.
    const wire = (cf = {}, lambda = {}, iam = {}) => {
      cfSendStub.callsFake((cmd) => {
        const fn = cf[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected cf command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
      lambdaSendStub.callsFake((cmd) => {
        const fn = lambda[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected lambda command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
      iamSendStub.callsFake((cmd) => {
        const fn = iam[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected iam command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
    };

    const statusOf = (steps, key) => steps.find((s) => s.key === key).status;
    const cfCalls = (name) => cfSendStub.getCalls().filter((c) => c.args[0].commandName === name);

    // Returns a responder that throws an AWS-style named error (so the SDK error path triggers).
    const throwNamed = (name, message) => () => {
      const e = new Error(message);
      e.name = name;
      throw e;
    };

    const iamCalls = (name) => iamSendStub.getCalls().filter((c) => c.args[0].commandName === name);

    // Encoded trust doc allowing both Lambda@Edge principals — what inspectRole treats as valid.
    const validTrust = encodeURIComponent(JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] },
        Action: 'sts:AssumeRole',
      }],
    }));
    // IAM mock for an existing, correctly-configured role (roleExists + roleOk = true).
    const okRoleIam = (extra = {}) => ({
      GetRole: { Role: { Arn: 'arn:role', AssumeRolePolicyDocument: validTrust } },
      GetRolePolicy: { PolicyName: 'EdgeOptimizeLambdaLogging', PolicyDocument: '{}' },
      UpdateAssumeRolePolicy: {},
      PutRolePolicy: {},
      ...extra,
    });

    // CF + Lambda wiring for "function already published, behavior not yet associated, propagation
    // still in progress" — the role-heal gate tests reuse this and only vary the IAM/role mock.
    const readyDeployCf = () => ({
      GetDistributionConfig: () => ({
        DistributionConfig: {
          Origins: {
            Items: [{
              Id: 'EdgeOptimize_Origin',
              DomainName: 'dev.edgeoptimize.net',
              CustomHeaders: {
                Items: [
                  { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                  { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                ],
              },
            }],
          },
          DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
        },
        ETag: 'etag',
      }),
      DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
      ListCachePolicies: { CachePolicyList: { Items: [] } },
      GetCachePolicyConfig: {
        CachePolicyConfig: {
          Name: 'p',
          MinTTL: 0,
          ParametersInCacheKeyAndForwardedToOrigin: {
            HeadersConfig: {
              HeaderBehavior: 'whitelist',
              Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
            },
          },
        },
        ETag: 'cp-etag',
      },
      UpdateDistribution: {},
      GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'InProgress' } },
    });
    const readyLambda = () => ({
      GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
      ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: 'arn:lambda:3', CodeSha256: 'sha' }] },
    });

    const makeFetchResponse = (status, headerMap) => ({
      status,
      headers: { forEach: (cb) => Object.entries(headerMap).forEach(([k, v]) => cb(v, k)) },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });

    afterEach(() => {
      if (fetchStub) {
        fetchStub.restore();
      }
      fetchStub = undefined;
    });

    it('first call advances origin+function+cache and returns lambda in_progress (others pending)', async () => {
      wire(
        {
          // origin: existing with matching headers → idempotent no-op (no UpdateDistribution).
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          },
          // function gate: already published to LIVE → skip create+publish.
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          // cache: custom policy already forwards EO headers + MinTTL 0 → no-op.
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
            ETag: 'cp-etag',
          },
        },
        {
          // lambda: does not exist yet → kick off create → in_progress.
          GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope'),
          ListVersionsByFunction: { Versions: [] },
          CreateFunction: { FunctionArn: 'arn:lambda', Version: '$LATEST' },
        },
        // Role already exists + correctly configured → no role-propagation wait.
        okRoleIam(),
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'origin')).to.equal('done');
      expect(statusOf(out.steps, 'function')).to.equal('done');
      expect(statusOf(out.steps, 'cache')).to.equal('done');
      expect(statusOf(out.steps, 'lambda')).to.equal('in_progress');
      expect(statusOf(out.steps, 'associate')).to.equal('pending');
      expect(statusOf(out.steps, 'verify')).to.equal('pending');
      expect(out.routingDeployed).to.equal(false);
      expect(out.verified).to.equal(false);
      // function already LIVE → never created/published.
      expect(cfCalls('CreateFunction')).to.have.length(0);
      expect(cfCalls('PublishFunction')).to.have.length(0);
    });

    it('creates the routing function when not yet LIVE', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          },
          // function gate: not LIVE → create+publish path runs.
          DescribeFunction: (cmd) => {
            if (cmd.input.Stage === 'LIVE') {
              return Promise.reject(Object.assign(new Error('no live'), { name: 'NoSuchFunctionExists' }));
            }
            // DEVELOPMENT lookup inside createEdgeOptimizeRoutingFunction → also missing.
            return Promise.reject(Object.assign(new Error('no dev'), { name: 'NoSuchFunctionExists' }));
          },
          CreateFunction: { ETag: 'fn-etag' },
          PublishFunction: {},
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
        },
        {
          GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope'),
          ListVersionsByFunction: { Versions: [] },
          CreateFunction: { FunctionArn: 'arn:lambda' },
        },
        okRoleIam(),
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'function')).to.equal('done');
      expect(cfCalls('CreateFunction')).to.have.length(1);
      expect(cfCalls('PublishFunction')).to.have.length(1);
    });

    it('with lambda ready proceeds to associate then verify (in_progress until propagation)', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            // origin exists (idempotent), default behavior NOT yet associated (associate must run).
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
            ETag: 'cp-etag',
          },
          UpdateDistribution: {},
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );
      // verify probe: bot lacks request-id → not passed yet (propagation).
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeFetchResponse(200, {}));
      fetchStub.onSecondCall().resolves(makeFetchResponse(200, {}));

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('done');
      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(statusOf(out.steps, 'verify')).to.equal('in_progress');
      expect(out.routingDeployed).to.equal(true);
      expect(out.verified).to.equal(false);
      // associate ran exactly one UpdateDistribution (behavior was not associated).
      expect(cfCalls('UpdateDistribution')).to.have.length(1);
      // verify probes the customer's REAL host (forwardedHost), not the dist domain.
      expect(out.steps.find((s) => s.key === 'verify').detail).to.equal('waiting for propagation');
      expect(fetchStub.firstCall.args[0]).to.equal('https://www.example.com/');
    });

    it('verify passes → verified true and verify done', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              // already associated → associate gate skips UpdateDistribution.
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeFetchResponse(200, { 'x-edgeoptimize-request-id': 'req-1' }));
      fetchStub.onSecondCall().resolves(makeFetchResponse(200, {}));

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(statusOf(out.steps, 'propagation')).to.equal('done');
      expect(statusOf(out.steps, 'verify')).to.equal('done');
      expect(out.routingDeployed).to.equal(true);
      expect(out.verified).to.equal(true);
      // verify probe surfaces the per-UA result the wizard renders.
      const verifyProbe = out.steps.find((s) => s.key === 'verify').probe;
      expect(verifyProbe.domain).to.equal('www.example.com'); // real host, not dist domain
      expect(verifyProbe.bot).to.deep.include({ ua: 'chatgpt-user', requestId: 'req-1', failover: false });
      expect(verifyProbe.human.requestId).to.equal(null);
      // idempotent gate: behavior already associated → no UpdateDistribution at all.
      expect(cfCalls('UpdateDistribution')).to.have.length(0);
    });

    it('verify falls back to the distribution domain when no forwardedHost is supplied', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeFetchResponse(200, {}));
      fetchStub.onSecondCall().resolves(makeFetchResponse(200, {}));

      // No originHeaders → forwardedHost empty → verify falls back to the dist domain.
      const noHostParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHostParams);

      expect(out.steps.find((s) => s.key === 'verify').probe.domain).to.equal('d123.cloudfront.net');
      expect(fetchStub.firstCall.args[0]).to.equal('https://d123.cloudfront.net/');
    });

    it('holds verify "waiting for domain" when neither forwardedHost nor a dist domain is known', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          // distribution deployed but reports no domain name → no host to verify.
          GetDistribution: { Distribution: { DomainName: '', Status: 'Deployed' } },
          UpdateDistribution: {}, // origin self-heal write (api-key header added)
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      // originHeaders carries an apiKey but NO forwardedHost → verify domain falls back to the
      // (empty) dist domain → "waiting for domain".
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, { ...deployParams, originHeaders: { apiKey: 'k' } });

      expect(statusOf(out.steps, 'verify')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'verify').detail).to.equal('waiting for domain');
    });

    it('surfaces verify failover (x-edgeoptimize-fo) as in_progress', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeFetchResponse(200, { 'x-edgeoptimize-fo': '1' }));
      fetchStub.onSecondCall().resolves(makeFetchResponse(200, {}));

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'verify')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'verify').detail).to.include('failover');
    });

    it('keeps verify in_progress when a probe network error resolves to a non-passing result', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );
      fetchStub = sinon.stub(global, 'fetch');
      // Both probes hit a network error. After the bounded-timeout fix they resolve to a
      // non-passing result ({ status: 0 }) instead of throwing, so the deploy never fails — verify
      // simply stays in_progress and the FE poll loop retries on the next poll.
      fetchStub.rejects(new Error('network down'));

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'verify')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'verify').detail).to.equal('waiting for propagation');
    });

    it('holds at propagation (verify pending) while the distribution is still Deploying', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          // distribution still deploying → propagation gate holds, verify never runs.
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'InProgress' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(statusOf(out.steps, 'propagation')).to.equal('in_progress');
      expect(statusOf(out.steps, 'verify')).to.equal('pending');
      expect(out.steps.find((s) => s.key === 'propagation').detail).to.include('Deploying');
      expect(out.verified).to.equal(false);
    });

    it('holds at propagation when the distribution is not yet returned', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          // distribution not returned yet → "waiting for the distribution to appear".
          GetDistribution: {},
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'propagation')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'propagation').detail).to.include('waiting for the distribution');
    });

    it('marks propagation in_progress when getting the distribution fails', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: () => { throw new Error('get failed'); },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'propagation')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'propagation').detail).to.equal('get failed');
    });

    it('marks the step error (earlier done, later pending) and does not throw when a step fails', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          },
          // function gate DescribeFunction throws a non-NoSuchFunction error → step error.
          DescribeFunction: () => { throw new Error('AccessDenied on DescribeFunction'); },
        },
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'origin')).to.equal('done');
      expect(statusOf(out.steps, 'function')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'function').detail).to.include('AccessDenied');
      // later steps remain pending.
      expect(statusOf(out.steps, 'cache')).to.equal('pending');
      expect(statusOf(out.steps, 'lambda')).to.equal('pending');
      expect(out.routingDeployed).to.equal(false);
    });

    it('marks the origin step error (raw err.message) and stops the sequence', async () => {
      wire(
        {
          GetDistributionConfig: () => { throw new Error('GetDistributionConfig denied'); },
        },
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'origin')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'origin').detail).to.equal('GetDistributionConfig denied');
      expect(statusOf(out.steps, 'function')).to.equal('pending');
    });

    it('marks the cache step error (raw err.message) and stops the sequence', async () => {
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              // No CachePolicyId and a behavior lookup mismatch: target a missing named behavior.
              CacheBehaviors: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: () => { throw new Error('ListCachePolicies denied'); },
        },
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'cache')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'cache').detail).to.equal('ListCachePolicies denied');
      expect(statusOf(out.steps, 'lambda')).to.equal('pending');
    });

    it('marks the lambda step error (raw err.message) and stops the sequence', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                ForwardedValues: undefined,
              },
            },
            ETag: 'etag',
          },
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
        },
        {
          GetFunctionConfiguration: () => { throw Object.assign(new Error('lambda denied'), { name: 'AccessDenied' }); },
        },
        okRoleIam(),
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'lambda').detail).to.equal('lambda denied');
      expect(statusOf(out.steps, 'associate')).to.equal('pending');
    });

    it('marks the associate step error (raw err.message) and stops the sequence', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      let getCfgCount = 0;
      wire(
        {
          GetDistributionConfig: () => {
            getCfgCount += 1;
            // 1st: origin (idempotent). 2nd: associate gate (not associated). 3rd: associate write.
            if (getCfgCount === 3) {
              throw new Error('associate read denied');
            }
            return {
              DistributionConfig: {
                Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
                DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
              },
              ETag: 'etag',
            };
          },
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'associate')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'associate').detail).to.equal('associate read denied');
      expect(statusOf(out.steps, 'propagation')).to.equal('pending');
    });

    it('holds the sequence when lambda exists but is not yet ready (no re-create)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          },
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
            ETag: 'cp-etag',
          },
        },
        {
          // exists but still finalizing (Pending) → createEdgeOptimizeLambda is called to drive the
          // state machine, but it must NOT CreateFunction or PublishVersion while still Pending.
          GetFunctionConfiguration: { State: 'Pending', LastUpdateStatus: 'InProgress', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [] },
        },
        okRoleIam(),
      );

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('in_progress');
      expect(statusOf(out.steps, 'associate')).to.equal('pending');
      // Pending → neither CreateFunction nor PublishVersion (no re-create, no premature publish).
      expect(lambdaSendStub.getCalls().filter((c) => c.args[0].commandName === 'CreateFunction')).to.have.length(0);
      expect(lambdaSendStub.getCalls().filter((c) => c.args[0].commandName === 'PublishVersion')).to.have.length(0);
    });

    it('reports lambda create started when the function does not exist yet', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
            ETag: 'etag',
          },
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
        },
        {
          GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope'),
          ListVersionsByFunction: { Versions: [] },
          CreateFunction: { FunctionArn: 'arn:lambda' },
        },
        okRoleIam(),
      );

      const noHeaderParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, noHeaderParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('in_progress');
      expect(out.steps.find((s) => s.key === 'lambda').detail).to.equal('Lambda@Edge create started');
    });

    it('publishes the version once the Lambda is Active, then proceeds to associate + verify', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:1';
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'dev.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              // already associated → associate gate skips; the focus is the lambda publish path.
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:1' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          // Active + idle, NO published version yet → createEdgeOptimizeLambda must publish one.
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [] },
          PublishVersion: { Version: '1', FunctionArn: lambdaVersionArn },
        },
        okRoleIam(),
      );
      fetchStub = sinon.stub(global, 'fetch');
      fetchStub.onFirstCall().resolves(makeFetchResponse(200, { 'x-edgeoptimize-request-id': 'req-1' }));
      fetchStub.onSecondCall().resolves(makeFetchResponse(200, {}));

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      // the fix: Active-without-version gets published → lambda flips to done (not stuck).
      expect(statusOf(out.steps, 'lambda')).to.equal('done');
      expect(lambdaSendStub.getCalls().filter((c) => c.args[0].commandName === 'PublishVersion')).to.have.length(1);
      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(statusOf(out.steps, 'verify')).to.equal('done');
      expect(out.routingDeployed).to.equal(true);
      expect(out.verified).to.equal(true);
    });

    // Role-heal gate: the lambda step is "done" only when the function is ready AND the role is
    // present + correctly configured. The next three cover each role state on a ready function.
    it('lambda ready + role MISSING → recreates the role, then completes the lambda step', async () => {
      wire(readyDeployCf(), readyLambda(), {
        GetRole: throwNamed('NoSuchEntityException', 'no role'),
        CreateRole: { Role: { Arn: 'arn:role' } },
        PutRolePolicy: {},
      });

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('done');
      expect(iamCalls('CreateRole')).to.have.length(1); // role recreated despite a ready function
      expect(iamCalls('PutRolePolicy')).to.have.length(1); // logs policy re-attached
      expect(out.routingDeployed).to.equal(true);
      expect(statusOf(out.steps, 'propagation')).to.equal('in_progress');
    });

    it('lambda ready + role MIS-CONFIGURED → heals trust + logs, then completes', async () => {
      const badTrust = encodeURIComponent(JSON.stringify({
        Version: '2012-10-17',
        // missing edgelambda.amazonaws.com → roleOk is false
        Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
      }));
      wire(readyDeployCf(), readyLambda(), {
        GetRole: { Role: { Arn: 'arn:role', AssumeRolePolicyDocument: badTrust } },
        GetRolePolicy: { PolicyName: 'EdgeOptimizeLambdaLogging', PolicyDocument: '{}' },
        UpdateAssumeRolePolicy: {},
        PutRolePolicy: {},
      });

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('done');
      expect(iamCalls('UpdateAssumeRolePolicy')).to.have.length(1); // trust corrected
      expect(iamCalls('PutRolePolicy')).to.have.length(1); // logs policy re-attached
      expect(iamCalls('CreateRole')).to.have.length(0); // role exists → not recreated
      expect(out.routingDeployed).to.equal(true);
    });

    it('lambda ready + role OK → completes WITHOUT touching the role (no churn)', async () => {
      wire(readyDeployCf(), readyLambda(), okRoleIam());

      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, deployParams);

      expect(statusOf(out.steps, 'lambda')).to.equal('done');
      expect(iamCalls('CreateRole')).to.have.length(0);
      expect(iamCalls('UpdateAssumeRolePolicy')).to.have.length(0);
      expect(iamCalls('PutRolePolicy')).to.have.length(0); // gate passed → createLambda skipped
      expect(out.routingDeployed).to.equal(true);
    });

    it('targets a NAMED behavior already associated (associate gate looks it up by name)', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      const namedBehavior = {
        PathPattern: '/api/*',
        CachePolicyId: 'cp-1',
        FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:fn/edgeoptimize-routing' }] },
        LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:edgeoptimize-origin:3' }] },
      };
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              CacheBehaviors: { Items: [namedBehavior] },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'Deployed' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const namedParams = { ...deployParams, behavior: '/api/*', originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, namedParams);

      // associate gate's isBehaviorAlreadyAssociated resolves the named behavior → already wired.
      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(cfCalls('UpdateDistribution')).to.have.length(0); // already associated → no write
    });

    it('writes the association for a NAMED behavior the gate cannot find as associated', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      // Named behavior exists (so cache + applyAssociations succeed) but has no EO associations,
      // so isBehaviorAlreadyAssociated returns false via the named-lookup path.
      const namedBehavior = { PathPattern: '/api/*', CachePolicyId: 'cp-1' };
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              CacheBehaviors: { Items: [{ ...namedBehavior }] },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
          UpdateDistribution: {},
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'InProgress' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const namedParams = { ...deployParams, behavior: '/api/*', originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, namedParams);

      // gate (named lookup) returns false → associate writes the association.
      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(cfCalls('UpdateDistribution')).to.have.length(1);
    });

    it('associate gate returns false when EO slots are held by non-EO ARNs', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      // The gate's .some() predicates evaluate the ARN regex (right side of &&) on matching event
      // types whose ARNs are NOT edgeoptimize → returns false → associate runs (and then refuses).
      wire(
        {
          GetDistributionConfig: () => ({
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-1',
                // EventType matches the EO slot but the ARN fields are absent → the gate evaluates
                // the `a.FunctionARN || ''` / `a.LambdaFunctionARN || ''` fallbacks → regex false.
                FunctionAssociations: { Items: [{ EventType: 'viewer-request' }, { EventType: 'viewer-request', FunctionARN: 'arn:other-fn' }] },
                LambdaFunctionAssociations: { Items: [{ EventType: 'origin-request' }] },
              },
            },
            ETag: 'etag',
          }),
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const namedParams = { ...deployParams, originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, namedParams);

      // gate → false (ARNs not EO); applyEdgeOptimizeAssociations then refuses the non-EO slot.
      expect(statusOf(out.steps, 'associate')).to.equal('error');
      expect(out.steps.find((s) => s.key === 'associate').detail).to.include('different viewer-request function');
    });

    it('returns associate gate false when the named behavior is absent from the gate config', async () => {
      const lambdaVersionArn = 'arn:aws:lambda:us-east-1:120569600543:function:edgeoptimize-origin:3';
      let getCfgCount = 0;
      wire(
        {
          GetDistributionConfig: () => {
            getCfgCount += 1;
            // 1st: origin. 2nd: cache. 3rd: associate-gate (named behavior ABSENT → !behavior).
            // 4th: applyEdgeOptimizeAssociations read (named behavior present again).
            const hasNamed = getCfgCount !== 3;
            return {
              DistributionConfig: {
                Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'dev.edgeoptimize.net' }] },
                CacheBehaviors: { Items: hasNamed ? [{ PathPattern: '/api/*', CachePolicyId: 'cp-1' }] : [] },
              },
              ETag: 'etag',
            };
          },
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Quantity: 2, Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } } },
            },
            ETag: 'cp-etag',
          },
          UpdateDistribution: {},
          GetDistribution: { Distribution: { DomainName: 'd123.cloudfront.net', Status: 'InProgress' } },
        },
        {
          GetFunctionConfiguration: { State: 'Active', LastUpdateStatus: 'Successful', FunctionArn: 'arn:lambda' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: lambdaVersionArn, CodeSha256: 'sha' }] },
        },
        okRoleIam(),
      );

      const namedParams = { ...deployParams, behavior: '/api/*', originHeaders: undefined };
      const out = await edgeOptimize.runEdgeOptimizeDeployStep({}, namedParams);

      // gate config lacks the named behavior (!behavior → false) → associate writes it.
      expect(statusOf(out.steps, 'associate')).to.equal('done');
      expect(cfCalls('UpdateDistribution')).to.have.length(1);
    });
  });

  describe('planEdgeOptimizeDeploy', () => {
    const planParams = {
      distributionId: 'E2EXAMPLE123',
      originId: 'origin-aem',
      behavior: 'default',
      originDomain: 'live.edgeoptimize.net',
      originHeaders: { apiKey: 'eo-key', forwardedHost: 'www.example.com' },
      accountId: '120569600543',
    };

    // Dispatch each client's send() by command name; per-test overrides via the maps.
    const wire = (cf = {}, lambda = {}, iam = {}) => {
      cfSendStub.callsFake((cmd) => {
        const fn = cf[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected cf command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
      lambdaSendStub.callsFake((cmd) => {
        const fn = lambda[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected lambda command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
      iamSendStub.callsFake((cmd) => {
        const fn = iam[cmd.commandName];
        if (fn === undefined) {
          throw new Error(`unexpected iam command: ${cmd.commandName}`);
        }
        return Promise.resolve(typeof fn === 'function' ? fn(cmd) : fn);
      });
    };

    const throwNamed = (name, message) => () => {
      const e = new Error(message);
      e.name = name;
      throw e;
    };

    const stepOf = (steps, key) => steps.find((s) => s.key === key);

    it('plans an all-create deploy (nothing exists yet, legacy cache)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: {
                ForwardedValues: { Headers: { Quantity: 0, Items: [] } },
                MinTTL: 60,
              },
            },
          },
          // function gate: not published to LIVE.
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        {
          // lambda: does not exist.
          GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope'),
        },
        {
          GetRole: throwNamed('NoSuchEntityException', 'no role'),
        },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(result.canProceed).to.equal(true);
      expect(result.blocker).to.equal(null);
      expect(result.steps.map((s) => s.key)).to.deep.equal(['origin', 'function', 'cache', 'lambda', 'associate']);
      expect(stepOf(result.steps, 'origin').action).to.equal('create');
      expect(stepOf(result.steps, 'function').action).to.equal('create');
      expect(stepOf(result.steps, 'cache').action).to.equal('update');
      expect(stepOf(result.steps, 'cache').detail).to.include('Add the Edge Optimize headers');
      expect(stepOf(result.steps, 'lambda').action).to.equal('create');
      expect(stepOf(result.steps, 'associate').action).to.equal('create');
      // role-will-be-created note surfaced on the lambda row
      expect(stepOf(result.steps, 'lambda').detail).to.include('will be created');
      // no `verify` row in the plan
      expect(result.steps.some((s) => s.key === 'verify')).to.equal(false);
    });

    it('surfaces a config read failure on the origin + cache rows without blocking', async () => {
      wire(
        {
          GetDistributionConfig: () => { throw new Error('config read denied'); },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'origin').detail).to.include('could not read distribution config');
      expect(stepOf(result.steps, 'cache').detail).to.include('could not determine cache scenario');
      expect(result.canProceed).to.equal(true);
    });

    it('plans an origin-headers patch when the EO origin exists header-less', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [{ Id: 'EdgeOptimize_Origin', DomainName: 'live.edgeoptimize.net' }] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } }, MinTTL: 0 },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'origin').action).to.equal('create');
      expect(stepOf(result.steps, 'origin').detail).to.include('patch Edge Optimize origin headers');
    });

    it('handles a config that has no Origins collection at all', async () => {
      wire(
        {
          GetDistributionConfig: {
            // config present but NO Origins → `config.Origins?.Items || []` fallback.
            DistributionConfig: {
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'origin').action).to.equal('create');
      expect(stepOf(result.steps, 'origin').detail).to.include('add Edge Optimize origin');
    });

    it('matches an existing EO origin by DomainName (not id) and marks it "exists"', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              // origin id is NOT EdgeOptimize_Origin, but the DomainName matches originDomain.
              Origins: { Items: [{ Id: 'some-other-id', DomainName: 'live.edgeoptimize.net' }] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } }, MinTTL: 0 },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      // no originHeaders → desiredHeaderItems empty → headersMatch true → 'exists'.
      const result = await edgeOptimize.planEdgeOptimizeDeploy(
        {},
        { ...planParams, originHeaders: undefined },
      );

      expect(stepOf(result.steps, 'origin').action).to.equal('exists');
      expect(stepOf(result.steps, 'origin').detail).to.include('live.edgeoptimize.net');
    });

    it('marks the legacy cache step "exists" when the headers are already forwarded', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: {
                ForwardedValues: { Headers: { Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
                MinTTL: 0,
              },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('exists');
      expect(stepOf(result.steps, 'cache').detail).to.include('already forwards');
    });

    it('blocks when the behavior is already associated (canProceed:false + exact blocker)', async () => {
      const associatedBehavior = {
        ForwardedValues: { Headers: { Items: [] } },
        FunctionAssociations: {
          Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:aws:cloudfront::1:function/edgeoptimize-routing-adobe-E2EXAMPLE123' }],
        },
        LambdaFunctionAssociations: {
          Items: [{ EventType: 'origin-request', LambdaFunctionARN: 'arn:aws:lambda:us-east-1:1:function:edgeoptimize-origin-adobe-E2EXAMPLE123:1' }],
        },
      };
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: associatedBehavior,
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(result.canProceed).to.equal(false);
      expect(result.blocker).to.equal(
        "This behaviour is already associated with routes, please recheck — can't proceed with this automation.",
      );
      expect(stepOf(result.steps, 'associate').action).to.equal('blocked');
    });

    it('blocks when the customer owns a conflicting slot (assocConflict)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: {
                ForwardedValues: { Headers: { Items: [] } },
                FunctionAssociations: { Items: [{ EventType: 'viewer-request', FunctionARN: 'arn:other-fn' }] },
              },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(result.canProceed).to.equal(false);
      expect(result.blocker).to.include('already has a different viewer-request function');
      expect(stepOf(result.steps, 'associate').action).to.equal('blocked');
    });

    it('surfaces a function-status read failure on the function row', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
            },
          },
          DescribeFunction: () => { throw new Error('describe denied'); },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'function').detail).to.include('could not read routing function status');
    });

    it('describes a managed-policy clone in the cache step', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'managed-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
            ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
            : { CachePolicyList: { Items: [] } }), // no existing clone
          GetCachePolicy: {
            CachePolicy: { CachePolicyConfig: { Name: 'Managed-CachingOptimized' } },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('create');
      expect(stepOf(result.steps, 'cache').detail).to.include('CachingOptimized-adobe-E2EXAMPLE123');
      expect(result.canProceed).to.equal(true);
    });

    it('mentions the MinTTL change when cloning a managed policy with a long MinTTL', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'managed-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
            ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
            : { CachePolicyList: { Items: [] } }),
          GetCachePolicy: {
            CachePolicy: { CachePolicyConfig: { Name: 'Managed-CachingOptimized', MinTTL: 9999 } },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').detail).to.include('Minimum TTL will be set to 0');
    });

    it('marks the managed cache step "update" when the clone exists but the behavior is not associated with it', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'managed-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
            ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
            : { CachePolicyList: { Items: [{ CachePolicy: { Id: 'eo-clone', CachePolicyConfig: { Name: 'CachingOptimized-adobe-E2EXAMPLE123' } } }] } }),
          GetCachePolicy: {
            CachePolicy: { CachePolicyConfig: { Name: 'Managed-CachingOptimized' } },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);
      // The clone exists but the behavior is still on the managed policy → the deploy will switch
      // the behavior to the existing copy, so this is an 'update' with a clear created-but-not-
      // associated message that names both the current policy and the copy.
      expect(stepOf(result.steps, 'cache').action).to.equal('update');
      expect(stepOf(result.steps, 'cache').detail).to.include('not associated');
      expect(stepOf(result.steps, 'cache').detail).to.include('CachingOptimized-adobe-E2EXAMPLE123');
    });

    it('marks function + lambda + origin "exists" when already present', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: {
                Items: [{
                  Id: 'EdgeOptimize_Origin',
                  DomainName: 'live.edgeoptimize.net',
                  CustomHeaders: {
                    Items: [
                      { HeaderName: 'x-edgeoptimize-api-key', HeaderValue: 'eo-key' },
                      { HeaderName: 'x-forwarded-host', HeaderValue: 'www.example.com' },
                    ],
                  },
                }],
              },
              DefaultCacheBehavior: {
                CachePolicyId: 'cp-custom',
              },
            },
          },
          // function gate: already published to LIVE.
          DescribeFunction: { FunctionSummary: { FunctionMetadata: { FunctionARN: 'arn:cf-fn' } } },
          // cache: custom (not managed), without our headers → update in place.
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'my-custom-policy',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'none' } },
            },
          },
        },
        {
          // lambda: exists + has a published version → ready.
          GetFunctionConfiguration: { FunctionArn: 'arn:lambda', State: 'Active', LastUpdateStatus: 'Successful' },
          ListVersionsByFunction: { Versions: [{ Version: '3', FunctionArn: 'arn:lambda:3', CodeSha256: 'sha' }] },
        },
        {
          GetRole: {
            Role: {
              Arn: 'arn:role',
              AssumeRolePolicyDocument: encodeURIComponent(JSON.stringify({
                Version: '2012-10-17',
                Statement: [{
                  Effect: 'Allow',
                  Principal: { Service: ['lambda.amazonaws.com', 'edgelambda.amazonaws.com'] },
                  Action: 'sts:AssumeRole',
                }],
              })),
            },
          },
          GetRolePolicy: { PolicyName: 'EdgeOptimizeLambdaLogging', PolicyDocument: '{}' },
        },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'origin').action).to.equal('exists');
      expect(stepOf(result.steps, 'function').action).to.equal('exists');
      expect(stepOf(result.steps, 'cache').action).to.equal('update');
      expect(stepOf(result.steps, 'cache').detail).to.include('my-custom-policy');
      expect(stepOf(result.steps, 'lambda').action).to.equal('exists');
      // Role visibility: an existing, correctly-configured execution role is surfaced + reused.
      expect(stepOf(result.steps, 'lambda').detail).to.include('Execution role');
      expect(stepOf(result.steps, 'lambda').detail).to.include('correctly configured');
      expect(stepOf(result.steps, 'associate').action).to.equal('create');
      expect(result.canProceed).to.equal(true);
    });

    it('notes a provisioning lambda + a mis-configured existing role', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        {
          // function exists but not yet published → provisioning.
          GetFunctionConfiguration: { FunctionArn: 'arn:lambda', State: 'Pending', LastUpdateStatus: 'InProgress' },
          ListVersionsByFunction: { Versions: [] },
        },
        {
          GetRole: { Role: { Arn: 'arn:role', AssumeRolePolicyDocument: encodeURIComponent('{"Statement":[]}') } },
          GetRolePolicy: throwNamed('NoSuchEntityException', 'no policy'),
        },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'lambda').action).to.equal('exists');
      expect(stepOf(result.steps, 'lambda').detail).to.include('still provisioning');
      expect(stepOf(result.steps, 'lambda').detail).to.include('not correctly configured');
    });

    it('surfaces a Lambda@Edge status read failure on the lambda row', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: () => { throw Object.assign(new Error('lambda denied'), { name: 'AccessDenied' }); } },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'lambda').detail).to.include('could not read Lambda@Edge status');
    });

    it('marks the custom cache step "exists" when our headers are already present (idempotent re-deploy)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'eo-clone' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: { CachePolicyList: { Items: [] } }, // eo-clone not managed → custom
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'CachingOptimized-adobe-E2EXAMPLE123',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: {
                  HeaderBehavior: 'whitelist',
                  Headers: { Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] },
                },
              },
            },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);
      expect(stepOf(result.steps, 'cache').action).to.equal('exists');
      expect(stepOf(result.steps, 'cache').detail).to.include('Already has the Edge Optimize headers');
    });

    it('marks a custom cache policy with allViewer headers "exists"', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'cp-av' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'all-viewer-policy',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'allViewer' } },
            },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);
      expect(stepOf(result.steps, 'cache').action).to.equal('exists');
    });

    it('surfaces a behavior read failure on the associate row', async () => {
      // config available for origin/cache, but the named behavior is missing → assoc read fails.
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
              CacheBehaviors: { Items: [] },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, { ...planParams, behavior: '/missing/*' });

      expect(stepOf(result.steps, 'associate').detail).to.include('could not read behavior associations');
    });

    it('uses the default origin domain when none is supplied', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { ForwardedValues: { Headers: { Items: [] } } },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const noDomainParams = { ...planParams, originDomain: undefined, originHeaders: undefined };
      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, noDomainParams);

      expect(stepOf(result.steps, 'origin').detail).to.include('live.edgeoptimize.net');
    });

    it('handles a legacy behavior with no ForwardedValues / Headers at all', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              // legacy (no CachePolicyId) and NO ForwardedValues → both `|| {}` fallbacks.
              DefaultCacheBehavior: {},
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('update');
      expect(stepOf(result.steps, 'cache').detail).to.include('Add the Edge Optimize headers');
    });

    it('handles sparse custom-policy reads (no CachePolicyList / CachePolicyConfig)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          // no CachePolicyList → managedIds empty (`?.Items || []`) → custom branch.
          ListCachePolicies: {},
          // no CachePolicyConfig → `pc = {}`, no headers → update + `pc.Name || 'custom'`.
          GetCachePolicyConfig: {},
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('update');
      expect(stepOf(result.steps, 'cache').detail).to.include('Current policy: custom');
    });

    it('marks a sparse custom policy "exists" using the default policy name', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'cp-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          // headers present (allViewer) + MinTTL 0 + NO Name → exists + `pc.Name || 'custom'`.
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: { HeadersConfig: { HeaderBehavior: 'allViewer' } },
            },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('exists');
      expect(stepOf(result.steps, 'cache').detail).to.include('Current policy: custom');
    });

    it('handles sparse managed-policy reads (no CachePolicy / custom list)', async () => {
      wire(
        {
          GetDistributionConfig: {
            DistributionConfig: {
              Origins: { Items: [] },
              DefaultCacheBehavior: { CachePolicyId: 'managed-1' },
            },
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: (cmd) => (cmd.input.Type === 'managed'
            ? { CachePolicyList: { Items: [{ CachePolicy: { Id: 'managed-1' } }] } }
            : {}), // custom list absent → `?.Items || []`
          GetCachePolicy: {}, // no CachePolicy → `srcConfig = {}`, `srcConfig.Name || 'cache'`
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'cache').action).to.equal('create');
      expect(stepOf(result.steps, 'cache').detail).to.include('cache-adobe-E2EXAMPLE123');
    });

    it('associate gate (plan) returns false when the named behavior is absent from its own read', async () => {
      let getCfgCount = 0;
      wire(
        {
          GetDistributionConfig: () => {
            getCfgCount += 1;
            // 1st (top read): named behavior present so origin/cache/conflict succeed.
            // 2nd (isBehaviorAlreadyAssociated): config has NO CacheBehaviors at all → the
            // `config.CacheBehaviors?.Items || []` fallback fires → !behavior → false.
            if (getCfgCount === 1) {
              return {
                DistributionConfig: {
                  Origins: { Items: [] },
                  CacheBehaviors: { Items: [{ PathPattern: '/api/*', CachePolicyId: 'cp-1' }] },
                },
              };
            }
            return { DistributionConfig: { Origins: { Items: [] } } };
          },
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
          ListCachePolicies: { CachePolicyList: { Items: [] } },
          GetCachePolicyConfig: {
            CachePolicyConfig: {
              Name: 'p',
              MinTTL: 0,
              ParametersInCacheKeyAndForwardedToOrigin: {
                HeadersConfig: { HeaderBehavior: 'whitelist', Headers: { Items: ['x-edgeoptimize-config', 'x-edgeoptimize-url'] } },
              },
            },
          },
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, { ...planParams, behavior: '/api/*' });

      // gate (plan path) hits the !behavior → false branch → associate is a normal 'create'.
      expect(stepOf(result.steps, 'associate').action).to.equal('create');
      expect(result.canProceed).to.equal(true);
    });

    it('falls back to the add-origin note when the config is empty (no throw, null config)', async () => {
      // GetDistributionConfig resolves WITHOUT a DistributionConfig → config is null but no error
      // was caught, so the origin row falls through to the `else if (!detail)` add-origin branch.
      wire(
        {
          GetDistributionConfig: {},
          DescribeFunction: throwNamed('NoSuchFunctionExists', 'no fn'),
        },
        { GetFunctionConfiguration: throwNamed('ResourceNotFoundException', 'nope') },
        { GetRole: throwNamed('NoSuchEntityException', 'no role') },
      );

      const result = await edgeOptimize.planEdgeOptimizeDeploy({}, planParams);

      expect(stepOf(result.steps, 'origin').action).to.equal('create');
      expect(stepOf(result.steps, 'origin').detail).to.equal('add Edge Optimize origin (live.edgeoptimize.net)');
      expect(stepOf(result.steps, 'cache').detail).to.include('could not determine cache scenario');
    });

    it('throws when distributionId is missing', async () => {
      let error;
      try {
        await edgeOptimize.planEdgeOptimizeDeploy({}, { ...planParams, distributionId: '' });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('distributionId');
    });

    it('throws when behavior is missing', async () => {
      let error;
      try {
        await edgeOptimize.planEdgeOptimizeDeploy({}, { ...planParams, behavior: '' });
      } catch (e) {
        error = e;
      }
      expect(error.message).to.include('behavior');
    });
  });
});
