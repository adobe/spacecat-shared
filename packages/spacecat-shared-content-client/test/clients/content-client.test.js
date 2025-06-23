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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import esmock from 'esmock';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { resolveCustomerSecretsName } from '@adobe/spacecat-shared-utils';

use(chaiAsPromised);
use(sinonChai);

describe('ContentClient', () => {
  let sandbox;
  let env;
  let context;
  let log;
  let documentSdk;
  let redirectsSdk;

  let ContentClient;

  const hlxConfigGoogle = { content: { source: { type: 'drive.google' } } };
  const baseUrl = 'https://base.spacecat';
  const siteConfigGoogleDrive = {
    getId: () => 'test-site',
    getHlxConfig: () => hlxConfigGoogle,
    getBaseURL: () => baseUrl,
  };

  const siteConfigOneDrive = {
    getId: () => 'test-site',
    getHlxConfig: () => ({ content: { source: { type: 'onedrive' } } }),
    getBaseURL: () => baseUrl,
  };

  const sampleMetadata = new Map(
    [['title', { value: 'Test Page', type: 'text' }],
      ['description', { value: 'Test description', type: 'text' }],
      ['keywords', { value: 'test, metadata', type: 'text' }]],
  );

  const existingRedirects = [
    { from: '/test-A', to: '/test-B' },
    { from: '/test-C', to: '/test-D' },
    { from: '/test-B', to: '/test-D' },
  ];

  const sampleLinks = [
    { href: 'https://example.com/page1', text: 'Page 1' },
    { href: 'https://example.com/page2', text: 'Page 2' },
    { href: '/internal/page', text: 'Internal Page' },
  ];

  const createContentClient = async (getPageMetadata) => {
    documentSdk = {
      getMetadata: sinon.stub().resolves(getPageMetadata),
      updateMetadata: sinon.stub().resolves({ status: 200 }),
    };
    const contentSDK = sinon.stub().returns({
      getDocument: sinon.stub().returns(documentSdk),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  const createErrorContentClient = async (getError, updateError, errorMessage) => {
    const contentSDK = sinon.stub().returns({
      getDocument: sinon.stub().returns({
        updateMetadata: updateError ? sinon.stub().resolves({ status: 500 })
          : sinon.stub().resolves({ status: 200 }),
        getMetadata: getError
          ? sinon.stub().rejects(new Error(errorMessage))
          : sinon.stub().resolves(new Map()),
        getLinks: getError
          ? sinon.stub().rejects(new Error(errorMessage))
          : sinon.stub().resolves(sampleLinks),
      }),
      getRedirects: sinon.stub().returns({
        get: getError
          ? sinon.stub().rejects(new Error(errorMessage))
          : sinon.stub().resolves(existingRedirects),
        append: sinon.stub().resolves(updateError ? { status: 500 } : { status: 200 }),
      }),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  const createContentClientForRedirects = async (getRedirects) => {
    redirectsSdk = {
      get: sinon.stub().resolves(getRedirects),
      append: sinon.stub().resolves({ status: 200 }),
    };
    const contentSDK = sinon.stub().returns({
      getRedirects: sinon.stub().returns(redirectsSdk),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  const createContentClientForLinks = async (getLinks) => {
    const linksSdk = {
      getLinks: sinon.stub().resolves(getLinks),
    };
    const contentSDK = sinon.stub().returns({
      getDocument: sinon.stub().returns(linksSdk),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    log = { info: sinon.spy(), debug: sinon.spy() };
    env = {
      GDRIVE_AUTH_URI: 'https://auth.uri',
      GDRIVE_CLIENT_ID: 'drive-client-id',
      GDRIVE_EMAIL: 'drive-email',
      GDRIVE_PRIVATE_KEY: 'drive-private-key',
      GDRIVE_PRIVATE_KEY_ID: 'drive-private-key-id',
      GDRIVE_PROJECT_ID: 'drive-project-id',
      GDRIVE_TOKEN_URI: 'https://some.token.uri',
      GDRIVE_TYPE: 'drive-type',
      GDRIVE_UNIVERSE_DOMAIN: 'drive-universe-domain',
      GDRIVE_X509_AUTH_PROVIDER_CERT_URL: 'https://auth-provider.uri',
      GDRIVE_X509_CLIENT_CERT_URL: 'GDRIVE_X509_CLIENT_CERT_URL',
      ADOBE_ONEDRIVE_DOMAIN_ID: 'onedrive-domain-id',
      ONEDRIVE_AUTHORITY: 'https://authority.uri',
      ONEDRIVE_CLIENT_ID: 'onedrive-client-id',
      ONEDRIVE_CLIENT_SECRET: 'onedrive-client-secret',
      SPACECAT_API_ENDPOINT: 'https://spacecat.experiencecloud.live/api/v1',
    };
    context = {
      env,
      log,
      func: {
        version: 'v1',
      },
    };

    ContentClient = await createContentClient(sampleMetadata);
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('createFrom', () => {
    it('creates a new ContentClient instance', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      expect(client).to.be.an.instanceof(ContentClient);
    });
  });

  describe('createFromDomain', () => {
    it('should create a ContentClient instance from a domain', async () => {
      const domain = 'example.com';
      const encodedBaseURL = 'aHR0cHM6Ly9leGFtcGxlLmNvbQ==';
      const site = {
        id: 'test-site',
        baseURL: 'https://example.com',
        hlxConfig: { content: { source: { type: 'drive.google' } } },
      };
      nock(env.SPACECAT_API_ENDPOINT)
        .get(`/sites/by-base-url/${encodedBaseURL}`)
        .reply(200, site);

      const client = await ContentClient.createFromDomain(
        domain,
        env,
        log = { info: sinon.spy(), error: sinon.spy(), debug: sinon.spy() },
      );
      expect(client).to.be.an.instanceof(ContentClient);
    });

    it('should throw an error if site is not fetched', async () => {
      const domain = 'example.com';
      const encodedBaseURL = 'aHR0cHM6Ly9leGFtcGxlLmNvbQ==';
      nock(env.SPACECAT_API_ENDPOINT)
        .get(`/sites/by-base-url/${encodedBaseURL}`)
        .reply(404, null);

      try {
        await ContentClient.createFromDomain(
          domain,
          env,
          log = { info: sinon.spy(), error: sinon.spy() },
        );
      } catch (error) {
        expect(error.message).to.equal(`Failed to fetch ${domain}`);
        expect(log.error.calledOnce).to.be.true;
      }
    });

    it('should log and throw an error if fetch fails', async () => {
      const domain = 'example.com';
      const encodedBaseURL = 'aHR0cHM6Ly9leGFtcGxlLmNvbQ==';
      nock(env.SPACECAT_API_ENDPOINT)
        .get(`/sites/by-base-url/${encodedBaseURL}`)
        .replyWithError(200, 'Network error');

      try {
        await ContentClient.createFromDomain(
          domain,
          env,
          log = { info: sinon.spy(), error: sinon.spy() },
        );
        throw new Error('Expected error was not thrown');
      } catch (error) {
        expect(error.message).to.equal(`Failed to fetch ${domain}`);
      }
    });
  });

  describe('constructor', () => {
    it('validates and sets config, site, and rawClient for Google Drive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      expect(client.log).to.eql(log);
      expect(client.config).to.eql({
        auth_provider_x509_cert_url: 'https://auth-provider.uri',
        auth_uri: 'https://auth.uri',
        client_email: 'drive-email',
        client_id: 'drive-client-id',
        client_x509_cert_url: 'GDRIVE_X509_CLIENT_CERT_URL',
        private_key: 'drive-private-key',
        private_key_id: 'drive-private-key-id',
        project_id: 'drive-project-id',
        token_uri: 'https://some.token.uri',
        type: 'drive-type',
        universe_domain: 'drive-universe-domain',
      });
      expect(client.contentSource).to.eql({ type: 'drive.google' });
      expect(client.rawClient).to.be.null;
      expect(client.site).to.eql(siteConfigGoogleDrive);
    });

    it('validate and sets config, site, and rawClient for OneDrive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigOneDrive);
      expect(client.log).to.eql(log);
      expect(client.config).to.eql({
        authority: 'https://authority.uri',
        clientId: 'onedrive-client-id',
        clientSecret: 'onedrive-client-secret',
        domainId: 'onedrive-domain-id',
      });
      expect(client.contentSource.type).to.equal('onedrive');
      expect(client.rawClient).to.be.null;
      expect(client.site).to.eql(siteConfigOneDrive);
    });

    it('throws an error if site is missing', () => {
      expect(() => new ContentClient(env, null, log)).to.throw('Site is required');
      expect(() => new ContentClient(env, 'some-site', log)).to.throw('Site is required');
    });

    it('throws an error if site has no content source', () => {
      const invalidSite = { getHlxConfig: () => ({ }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Site must have a valid content source');
    });

    it('throws an error if site\'s content source type is unsupported', () => {
      const invalidSite = { getHlxConfig: () => ({ content: { source: {} } }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Unsupported content source type: undefined');
    });

    it('throws an error if required config parameters are missing for Google Drive', async () => {
      context.env = { GOOGLE_DRIVE_CLIENT_ID: 'drive-client-id' };
      await expect(ContentClient.createFrom(context, siteConfigGoogleDrive)).to.eventually.be.rejectedWith('Configuration parameter auth_provider_x509_cert_url is required for content source drive.google');
    });

    it('throws an error if required config parameters are missing for OneDrive', () => {
      context.env = { ONEDRIVE_CLIENT_ID: 'onedrive-client-id' };
      expect(() => new ContentClient(context, siteConfigOneDrive)).to.throw('Configuration parameter authority is required for content source onedrive');
    });
  });

  describe('getPageMetadata', () => {
    it('throws an error if raw client throws an error', async () => {
      ContentClient = await createErrorContentClient(true, true, 'Error getting page metadata');
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      await expect(client.getPageMetadata(path)).to.be.rejectedWith('Error getting page metadata');
    });

    it('gets page metadata and logs duration for Google Drive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal(sampleMetadata);
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(documentSdk.getMetadata.calledOnce).to.be.true;
      expect(log.debug.calledTwice).to.be.true;
    });

    it('gets page metadata and logs duration for OneDrive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigOneDrive);
      const path = '/test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal(sampleMetadata);
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path.docx')).to.be.true;
      expect(documentSdk.getMetadata.calledOnce).to.be.true;
      expect(log.debug.calledTwice).to.be.true;
    });

    it('throws an error if path is invalid', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.getPageMetadata('')).to.be.rejectedWith('Path must be a string');
    });

    it('throws an error if path does not start with a slash', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.getPageMetadata('test-path')).to.be.rejectedWith('Path must start with a slash');
    });

    it('correctly resolves paths ending with / for Google Drive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.getPageMetadata('/test-path/');
      expect(client.rawClient.getDocument.calledOnceWith('/test-path/index')).to.be.true;
    });

    it('correctly resolves paths ending with / for OneDrive', async () => {
      const client = await ContentClient.createFrom(context, siteConfigOneDrive);
      await client.getPageMetadata('/test-path/');
      expect(client.rawClient.getDocument.calledOnceWith('/test-path/index.docx')).to.be.true;
    });
  });

  describe('updatePageMetadata', () => {
    it('throws an error if raw client has non-200 status', async () => {
      ContentClient = await createErrorContentClient(false, true, 'Error updating page metadata');
      const metadata = new Map([
        ['lang', { value: 'en', type: 'text' }],
        ['keywords', { value: 'test, metadata', type: 'text' }],
      ]);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      await expect(client.updatePageMetadata(path, metadata)).to.be.rejectedWith('Failed to update metadata for path /test-path');
    });

    it('updates page metadata with valid metadata', async () => {
      const metadata = new Map([
        ['lang', { value: 'en', type: 'text' }],
        ['keywords', { value: 'test, metadata', type: 'text' }],
      ]);
      const expectedMetadata = new Map([...sampleMetadata, ...metadata]);

      ContentClient = await createContentClient(sampleMetadata);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, metadata);

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(documentSdk.updateMetadata.calledOnceWith(expectedMetadata)).to.be.true;
      expect(log.info.calledOnce).to.be.true;
      expect(log.info.firstCall.args[0]).to.equal(`Updating page metadata for test-site and path ${path}`);
    });

    it('throws an error if metadata is not a Map', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = { description: 'Test description' }; // Not a Map

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata must be a map');
    });

    it('throws an error if metadata Map is empty', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = new Map();

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata must not be empty');
    });

    it('throws an error if metadata key is invalid', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = new Map([
        ['', 'Test description'], // Invalid key
      ]);

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata key  must be a string');
    });

    it('throws an error if metadata value is invalid', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = new Map([
        ['description', ''], // Invalid value
      ]);

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata value for key description must be a object that has a value and type');
    });

    it('overwrites existing metadata by default when updating', async () => {
      const newMetadata = new Map([
        ['description', { value: 'New description', type: 'text' }],
        ['author', { value: 'New Author', type: 'text' }],
      ]);
      const expectedMetadata = new Map([
        ['title', { value: 'Test Page', type: 'text' }], // Original key remains
        ['description', { value: 'New description', type: 'text' }], // Overwritten
        ['author', { value: 'New Author', type: 'text' }], // Added
        ['keywords', { value: 'test, metadata', type: 'text' }], // Original key remains
      ]);

      ContentClient = await createContentClient(sampleMetadata);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, newMetadata);

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(documentSdk.updateMetadata.calledOnceWith(expectedMetadata)).to.be.true;
    });

    it('merges without overwriting when overwrite option is false', async () => {
      const newMetadata = new Map([
        ['description', { value: 'New description', type: 'text' }],
        ['author', { value: 'New Author', type: 'text' }],
      ]);
      const expectedMetadata = new Map([
        ['description', { value: 'Test description', type: 'text' }], // Original key remains
        ['keywords', { value: 'test, metadata', type: 'text' }], // Original key remains
        ['title', { value: 'Test Page', type: 'text' }], // Original key remains
        ['author', { value: 'New Author', type: 'text' }], // Added
      ]);

      ContentClient = await createContentClient(sampleMetadata);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, newMetadata, {
        overwrite: false,
      });

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(documentSdk.updateMetadata.calledOnceWith(expectedMetadata)).to.be.true;
    });
  });

  describe('getRedirects', () => {
    it('successfully retrieves redirects', async () => {
      const expectedRedirects = [
        { from: '/old-path', to: '/new-path' },
        { from: '/another-old-path', to: '/another-new-path' },
      ];
      ContentClient = await createContentClientForRedirects(expectedRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      const redirects = await client.getRedirects();

      expect(redirects).to.deep.equal(expectedRedirects);
      expect(log.info.calledOnceWith('Getting redirects for test-site')).to.be.true;
      expect(redirectsSdk.get.calledOnce).to.be.true;
      expect(log.debug.calledTwice).to.be.true;
    });

    it('returns an empty array when there are no redirects', async () => {
      ContentClient = await createContentClientForRedirects([]);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      const redirects = await client.getRedirects();

      expect(redirects).to.be.an('array').that.is.empty;
    });

    it('throws an error if raw client throws an error', async () => {
      ContentClient = await createErrorContentClient(true, false, 'Error getting redirects');
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);

      await expect(client.getRedirects()).to.be.rejectedWith('Error getting redirects');
    });
  });

  describe('updateRedirects', () => {
    it('throws an error if raw client has non-200 status', async () => {
      ContentClient = await createErrorContentClient(false, true, 'Error updating redirects');
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }])).to.be.rejectedWith('Failed to update redirects');
    });
    it('throws an error if new redirects are not an array', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects({})).to.be.rejectedWith('Redirects must be an array');
    });
    it('throws an error if new redirects are an empty array', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([])).to.be.rejectedWith('Redirects must not be empty');
    });
    it('throws an error if new redirects contains an invalid entry', async () => {
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, 'malformed-redirect'])).to.be.rejectedWith('Redirect must be an object');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '', to: '/B' }])).to.be.rejectedWith('Redirect must have a valid from path');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '/A', to: '' }])).to.be.rejectedWith('Redirect must have a valid to path');
      await expect(client.updateRedirects([{ from: 'A', to: '/B' }, { from: '/A', to: '/C' }])).to.be.rejectedWith('Invalid Redirect from path: A');
      await expect(client.updateRedirects([{ from: '/A', to: 'B' }, { from: '/A', to: '/C' }])).to.be.rejectedWith('Invalid Redirect to path: B');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '/A', to: '/A' }])).to.be.rejectedWith('Redirect from and to paths must be different');
    });
    it('update success', async () => {
      const newRedirects = [
        { from: '/test-X', to: '/test-Y' },
      ];

      const secretsManagerClient = new SecretsManagerClient({});
      sinon.stub(secretsManagerClient, 'send').resolves({
        SecretString: JSON.stringify({
          onedrive_domain_id: 'onedrive-domain-id-secret',
        }),
      });

      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = await ContentClient.createFrom(
        context,
        siteConfigGoogleDrive,
        secretsManagerClient,
      );
      await client.updateRedirects(newRedirects);
      await expect(redirectsSdk.append.calledOnceWith(sinon.match([{ from: '/test-X', to: '/test-Y' }]))).to.be.true;
    });
    it('update success ignores duplicates', async () => {
      const newRedirects = [
        { from: '/test-A', to: '/test-B' },
        { from: '/test-X', to: '/test-Y' },
        { from: '/test-B', to: '/test-D' },
        { from: '/test-X', to: '/test-Y' },
      ];

      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(redirectsSdk.append.calledOnceWith(sinon.match([{ from: '/test-X', to: '/test-Y' }]))).to.be.true;
    });
    it('detect cycles in new redirects', async () => {
      const newRedirects = [
        { from: '/test-D', to: '/test-A' },
        { from: '/test-C', to: '/test-E' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(redirectsSdk.append.calledOnceWith(sinon.match([{ from: '/test-C', to: '/test-E' }]))).to.be.true;
    });
    it('detect cycles in current redirects', async () => {
      const newRedirects = [
        { from: '/test-I', to: '/test-J' },
      ];
      const cycleRedirects = [
        { from: '/test-A', to: '/test-C' },
        { from: '/test-C', to: '/test-E' },
        { from: '/test-E', to: '/test-A' },
      ];
      ContentClient = await createContentClientForRedirects(cycleRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects(newRedirects)).to.be.rejectedWith('Redirect cycle detected');
    });
    it('does not call rawClient when all redirects are duplicates', async () => {
      const newRedirects = [
        { from: '/test-A', to: '/test-B' },
        { from: '/test-C', to: '/test-D' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(redirectsSdk.append).to.not.have.been.called;
    });
    it('does not call rawClient when there are no valid redirects', async () => {
      const newRedirects = [
        { from: '/test-D', to: '/test-A' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(redirectsSdk.append).to.not.have.been.called;
    });
  });

  describe('updateBrokenInternalLink', () => {
    let client;

    beforeEach(async () => {
      client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.getPageMetadata('/test-path'); // This will initialize the rawClient
    });

    it('should throw an error if brokenLink is not an object', async () => {
      await expect(client.updateBrokenInternalLink('/test-path', 'not-an-object')).to.be.rejectedWith('URL must be an object');
    });

    it('should throw an error if brokenLink is missing from path', async () => {
      const brokenLink = { to: 'https://new-link' };
      await expect(client.updateBrokenInternalLink('/test-path', brokenLink)).to.be.rejectedWith('URL must have a valid from path');
    });

    it('should throw an error if brokenLink is missing to path', async () => {
      const brokenLink = { from: 'http://old-link' };
      await expect(client.updateBrokenInternalLink('/test-path', brokenLink)).to.be.rejectedWith('URL must have a valid to path');
    });

    it('should throw an error if brokenLink from path is invalid', async () => {
      const brokenLink = { from: 'invalid-url', to: 'https://new-link' };
      await expect(client.updateBrokenInternalLink('/test-path', brokenLink)).to.be.rejectedWith('Invalid URL from path: invalid-url');
    });

    it('should throw an error if brokenLink to path is invalid', async () => {
      const brokenLink = { from: 'http://old-link', to: 'invalid-url' };
      await expect(client.updateBrokenInternalLink('/test-path', brokenLink)).to.be.rejectedWith('Invalid URL to path: invalid-url');
    });

    it('should update broken internal link for Google Drive', async () => {
      const brokenLink = { from: 'http://old-link', to: 'https://new-link' };
      client.rawClient.getDocument = sinon.stub().returns({
        updateLink: sinon.stub().resolves({ status: 200 }),
      });
      await client.updateBrokenInternalLink('/test-path', brokenLink);
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(client.rawClient.getDocument().updateLink.calledOnceWith('http://old-link', 'https://new-link')).to.be.true;
    });

    it('should update broken internal link for OneDrive', async () => {
      const brokenLink = { from: 'http://old-link', to: 'https://new-link' };
      client = await ContentClient.createFrom(context, siteConfigOneDrive);
      await client.getPageMetadata('/test-path'); // This will initialize the rawClient
      client.rawClient.getDocument = sinon.stub().returns({
        updateLink: sinon.stub().resolves({ status: 200 }),
      });
      await client.updateBrokenInternalLink('/test-path', brokenLink);
      expect(client.rawClient.getDocument.calledOnceWith('/test-path.docx')).to.be.true;
      expect(client.rawClient.getDocument().updateLink.calledOnceWith('http://old-link', 'https://new-link')).to.be.true;
    });

    it('should throw an error if updateLink fails', async () => {
      const brokenLink = { from: 'http://old-link', to: 'https://new-link' };
      client.rawClient.getDocument = sinon.stub().returns({
        updateLink: sinon.stub().resolves({ status: 500 }),
      });
      await expect(client.updateBrokenInternalLink('/test-path', brokenLink)).to.be.rejectedWith('Failed to update link from http://old-link to https://new-link // [object Object]');
    });
  });

  describe('getResourcePath', () => {
    let client;

    function getHlxConfig() {
      return {
        ...hlxConfigGoogle,
        rso: {
          owner: 'owner',
          site: 'repo',
          ref: 'main',
        },
      };
    }

    const helixAdminToken = 'test-token';
    /** @type {SecretsManagerClient} */
    let secretsManagerClient;
    /** @type
     * {sinon.SinonStub<
     *    Parameters<SecretsManagerClient['send']>,
     *    ReturnType<SecretsManagerClient['send']>>
     * } */
    let sendStub;
    beforeEach(async () => {
      secretsManagerClient = new SecretsManagerClient();
      sendStub = sinon.stub(secretsManagerClient, 'send');
      sendStub.resolves({ SecretString: JSON.stringify({ helix_admin_token: helixAdminToken }) });

      client = await ContentClient.createFrom(
        context,
        { ...siteConfigGoogleDrive, getHlxConfig },
        secretsManagerClient,
      );
    });

    it('should return the document path on success', async () => {
      const path = 'example/path';

      nock('https://admin.hlx.page', {
        reqheaders: {
          authorization: `token ${helixAdminToken}`,
        },
      })
        .get('/status/owner/repo/main/example/path')
        .reply(200, { resourcePath: '/mocked/resource/path' });

      expect(sendStub).to.have.been.calledWithMatch(
        {
          input: {
            SecretId: resolveCustomerSecretsName(baseUrl, context),
          },
        },
      );
      const result = await client.getResourcePath(path);

      expect(result).to.equal('/mocked/resource/path');
    });

    it('should throw an error on failure', async () => {
      const path = '/example-path';

      nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/example-path')
        .reply(500, { message: 'Internal Server Error' });

      try {
        await client.getResourcePath(path);
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch document path for /example-path: {"message":"Internal Server Error"}');
      }
    });
  });

  describe('getLivePreviewURLs', () => {
    let client;

    function getHlxConfig() {
      return {
        ...hlxConfigGoogle,
        rso: {
          owner: 'owner',
          site: 'repo',
          ref: 'main',
        },
      };
    }

    const helixAdminToken = 'test-token';
    /** @type {SecretsManagerClient} */
    let secretsManagerClient;
    /** @type
     * {sinon.SinonStub<
     *    Parameters<SecretsManagerClient['send']>,
     *    ReturnType<SecretsManagerClient['send']>>
     * } */
    let sendStub;
    beforeEach(async () => {
      secretsManagerClient = new SecretsManagerClient();
      sendStub = sinon.stub(secretsManagerClient, 'send');
      sendStub.resolves({ SecretString: JSON.stringify({ helix_admin_token: helixAdminToken }) });

      client = await ContentClient.createFrom(
        context,
        { ...siteConfigGoogleDrive, getHlxConfig },
        secretsManagerClient,
      );
    });

    it('should return live and preview URLs on success', async () => {
      const path = 'example/path';
      const mockResponse = {
        live: { url: 'https://owner--repo.hlx.live/example/path' },
        preview: { url: 'https://main--repo--owner.hlx.page/example/path' },
      };

      nock('https://admin.hlx.page', {
        reqheaders: {
          authorization: `token ${helixAdminToken}`,
        },
      })
        .get('/status/owner/repo/main/example/path')
        .reply(200, mockResponse);

      expect(sendStub).to.have.been.calledWithMatch(
        {
          input: {
            SecretId: resolveCustomerSecretsName(baseUrl, context),
          },
        },
      );
      const result = await client.getLivePreviewURLs(path);

      expect(result).to.deep.equal({
        liveURL: 'https://owner--repo.hlx.live/example/path',
        previewURL: 'https://main--repo--owner.hlx.page/example/path',
      });
    });

    it('should handle undefined URLs in response', async () => {
      const path = '/example-path';
      const mockResponse = {
        live: null,
        preview: { url: 'https://main--repo--owner.hlx.page/example-path' },
      };

      nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/example-path')
        .reply(200, mockResponse);

      const result = await client.getLivePreviewURLs(path);

      expect(result).to.deep.equal({
        liveURL: undefined,
        previewURL: 'https://main--repo--owner.hlx.page/example-path',
      });
    });

    it('should handle empty response object', async () => {
      const path = '/example-path';

      nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/example-path')
        .reply(200, {});

      const result = await client.getLivePreviewURLs(path);

      expect(result).to.deep.equal({
        liveURL: undefined,
        previewURL: undefined,
      });
    });

    it('should remove leading slashes from path in API call', async () => {
      const path = '///multiple/leading/slashes';
      const mockResponse = {
        live: { url: 'https://owner--repo.hlx.live/multiple/leading/slashes' },
        preview: { url: 'https://main--repo--owner.hlx.page/multiple/leading/slashes' },
      };

      const scope = nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/multiple/leading/slashes')
        .reply(200, mockResponse);

      await client.getLivePreviewURLs(path);

      expect(scope.isDone()).to.be.true;
    });

    it('should throw an error on HTTP failure', async () => {
      const path = '/example-path';

      nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/example-path')
        .reply(404, { message: 'Not Found' });

      try {
        await client.getLivePreviewURLs(path);
      } catch (err) {
        expect(err.message).to.equal('Failed to fetch document path for /example-path: {"message":"Not Found"}');
      }
    });

    it('should throw an error on network failure', async () => {
      const path = '/example-path';

      nock('https://admin.hlx.page')
        .get('/status/owner/repo/main/example-path')
        .replyWithError('Network error');

      try {
        await client.getLivePreviewURLs(path);
      } catch (err) {
        expect(err.message).to.include('Network error');
      }
    });
  });

  describe('getDocumentLinks', () => {
    it('should throw an error if raw client throws an error', async () => {
      const errorContentClient = await createErrorContentClient(true, false, 'Error getting document links');
      const client = await errorContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      await expect(client.getDocumentLinks(path)).to.be.rejectedWith('Error getting document links');
    });

    it('should get document links and log duration for Google Drive', async () => {
      const linksContentClient = await createContentClientForLinks(sampleLinks);
      const client = await linksContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      const links = await client.getDocumentLinks(path);

      expect(links).to.deep.equal(sampleLinks);
      expect(log.info.calledWith(`Getting document links for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(log.debug.calledTwice).to.be.true;
    });

    it('should get document links and log duration for OneDrive', async () => {
      const linksContentClient = await createContentClientForLinks(sampleLinks);
      const client = await linksContentClient.createFrom(context, siteConfigOneDrive);
      const path = '/test-path';
      const links = await client.getDocumentLinks(path);

      expect(links).to.deep.equal(sampleLinks);
      expect(log.info.calledWith(`Getting document links for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path.docx')).to.be.true;
      expect(log.debug.calledTwice).to.be.true;
    });

    it('should return empty array when document has no links', async () => {
      const linksContentClient = await createContentClientForLinks([]);
      const client = await linksContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      const links = await client.getDocumentLinks(path);

      expect(links).to.be.an('array').that.is.empty;
      expect(log.info.calledWith(`Getting document links for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
    });

    it('should correctly resolve paths ending with / for Google Drive', async () => {
      const linksContentClient = await createContentClientForLinks(sampleLinks);
      const client = await linksContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path/';
      await client.getDocumentLinks(path);

      expect(client.rawClient.getDocument.calledOnceWith('/test-path/index')).to.be.true;
    });

    it('should correctly resolve paths ending with / for OneDrive', async () => {
      const linksContentClient = await createContentClientForLinks(sampleLinks);
      const client = await linksContentClient.createFrom(context, siteConfigOneDrive);
      const path = '/test-path/';
      await client.getDocumentLinks(path);

      expect(client.rawClient.getDocument.calledOnceWith('/test-path/index.docx')).to.be.true;
    });

    it('should handle null/undefined link properties gracefully', async () => {
      const linksWithNulls = [
        { url: 'https://example.com/page1', text: null },
        { url: null, text: 'Text Only' },
        { url: 'https://example.com/page2', text: '' },
      ];
      const linksContentClient = await createContentClientForLinks(linksWithNulls);
      const client = await linksContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      const links = await client.getDocumentLinks(path);

      expect(links).to.deep.equal(linksWithNulls);
    });

    it('should handle very long paths correctly', async () => {
      const longPath = '/very/long/path/with/many/segments/that/goes/deep/into/the/folder/structure';
      const linksContentClient = await createContentClientForLinks(sampleLinks);
      const client = await linksContentClient.createFrom(context, siteConfigGoogleDrive);
      const links = await client.getDocumentLinks(longPath);

      expect(links).to.deep.equal(sampleLinks);
      expect(client.rawClient.getDocument.calledOnceWith(longPath)).to.be.true;
    });
  });

  describe('updateImageAltText', () => {
    let client;
    let mockDocument;

    beforeEach(async () => {
      client = await ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.getPageMetadata('/test-path');
      mockDocument = {
        getMetadata: sinon.stub().resolves(new Map()),
        updateImageAltText: sinon.stub().resolves({ status: 200 }),
      };
      client.rawClient.getDocument = sinon.stub().returns(mockDocument);
    });

    it('should throw if imageAltText is not an array', async () => {
      const path = '/test-path';
      const imageAltText = 'not-an-array';
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejectedWith('not-an-array must be an array');
    });

    it('should throw if an item in imageAltText is not an object', async () => {
      const path = '/test-path';
      const imageAltText = ['not-an-object'];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejectedWith('not-an-object must be an object');
    });

    it('should throw if an item in imageAltText is missing imageUrl', async () => {
      const path = '/test-path';
      const imageAltText = [{ altText: 'desc' }];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejectedWith('No imageUrl found for [object Object]');
    });

    it('should throw if an item in imageAltText is missing altText', async () => {
      const path = '/test-path';
      const imageAltText = [{ imageUrl: 'https://example.com/image.png' }];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejectedWith('No altText found for [object Object]');
    });

    it('should throw if imageAltText is invalid', async () => {
      const path = '/test-path';
      const imageAltText = [{ imageUrl: '', altText: '' }];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejected;
    });

    it('should update image alt text for Google Drive', async () => {
      const path = '/test-path';
      const imageAltText = [
        { imageUrl: 'https://example.com/image.png', altText: 'desc' },
      ];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.fulfilled;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path')).to.be.true;
      expect(mockDocument.updateImageAltText.calledOnceWith(imageAltText)).to.be.true;
    });

    it('should update image alt text for OneDrive', async () => {
      client = await ContentClient.createFrom(context, siteConfigOneDrive);
      await client.getPageMetadata('/test-path');
      mockDocument = {
        updateImageAltText: sinon.stub().resolves({ status: 200 }),
      };
      client.rawClient.getDocument = sinon.stub().returns(mockDocument);

      const path = '/test-path';
      const imageAltText = [
        { imageUrl: 'https://example.com/image.png', altText: 'desc' },
      ];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.fulfilled;
      expect(client.rawClient.getDocument.calledOnceWith('/test-path.docx')).to.be.true;
      expect(mockDocument.updateImageAltText.calledOnceWith(imageAltText)).to.be.true;
    });

    it('should throw if updateImageAltText response is not 200', async () => {
      mockDocument.updateImageAltText.resolves({ status: 500 });
      const path = '/test-path';
      const imageAltText = [
        { imageUrl: 'https://example.com/image.png', altText: 'desc' },
      ];
      await expect(client.updateImageAltText(path, imageAltText)).to.be.rejectedWith('Failed to update image alt text for path /test-path');
    });
  });
});
