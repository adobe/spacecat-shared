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

use(chaiAsPromised);
use(sinonChai);

describe('ContentClient', () => {
  let sandbox;
  let env;
  let context;
  let log;

  let ContentClient;

  const siteConfigGoogleDrive = {
    getId: () => 'test-site',
    getConfig: () => ({ content: { source: { type: 'drive.google' } } }),
  };

  const siteConfigOneDrive = {
    getId: () => 'test-site',
    getConfig: () => ({ content: { source: { type: 'onedrive' } } }),
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

  const createContentClient = async (getPageMetadata) => {
    const contentSDK = sinon.stub().returns({
      getPageMetadata: sinon.stub().resolves(getPageMetadata),
      updatePageMetadata: sinon.stub().resolves({ status: 200 }),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  const createErrorContentClient = async (getError, updateError, errorMessage) => {
    const contentSDK = sinon.stub().returns({
      getPageMetadata: getError
        ? sinon.stub().rejects(new Error(errorMessage)) : sinon.stub().resolves(new Map()),
      updatePageMetadata: sinon.stub().resolves(updateError ? { status: 500 } : { status: 200 }),
      getRedirects: getError
        ? sinon.stub().rejects(new Error(errorMessage)) : sinon.stub().resolves(existingRedirects),
      appendRedirects: sinon.stub().resolves(updateError ? { status: 500 } : { status: 200 }),
    });

    return esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
  };

  const createContentClientForRedirects = async (getRedirects) => {
    const contentSDK = sinon.stub().returns({
      getRedirects: sinon.stub().resolves(getRedirects),
      appendRedirects: sinon.stub().resolves({ status: 200 }),
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
    };
    context = { env, log };

    ContentClient = await createContentClient(sampleMetadata);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createFrom', () => {
    it('creates a new ContentClient instance', () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      expect(client).to.be.an.instanceof(ContentClient);
    });
  });

  describe('constructor', () => {
    it('validates and sets config, site, and rawClient for Google Drive', () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
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

    it('validate and sets config, site, and rawClient for OneDrive', () => {
      const client = ContentClient.createFrom(context, siteConfigOneDrive);
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
      const invalidSite = { getConfig: () => ({ }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Site must have a valid content source');
    });

    it('throws an error if site\'s content source type is unsupported', () => {
      const invalidSite = { getConfig: () => ({ content: { source: {} } }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Unsupported content source type: undefined');
    });

    it('throws an error if required config parameters are missing for Google Drive', () => {
      context.env = { GOOGLE_DRIVE_CLIENT_ID: 'drive-client-id' };
      expect(() => ContentClient.createFrom(context, siteConfigGoogleDrive)).to.throw('Configuration parameter auth_provider_x509_cert_url is required for content source drive.google');
    });

    it('throws an error if required config parameters are missing for OneDrive', () => {
      context.env = { ONEDRIVE_CLIENT_ID: 'onedrive-client-id' };
      expect(() => new ContentClient(context, siteConfigOneDrive)).to.throw('Configuration parameter authority is required for content source onedrive');
    });
  });

  describe('getPageMetadata', () => {
    it('throws an error if raw client throws an error', async () => {
      ContentClient = await createErrorContentClient(true, true, 'Error getting page metadata');
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      await expect(client.getPageMetadata(path)).to.be.rejectedWith('Error getting page metadata');
    });

    it('gets page metadata and logs duration for Google Drive', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      const path = '/test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal(sampleMetadata);
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getPageMetadata.calledOnceWith('/test-path')).to.be.true;
      expect(log.debug.calledOnce).to.be.true;
    });

    it('gets page metadata and logs duration for OneDrive', async () => {
      const client = ContentClient.createFrom(context, siteConfigOneDrive);
      const path = '/test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal(sampleMetadata);
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getPageMetadata.calledOnceWith('/test-path.docx')).to.be.true;
      expect(log.debug.calledOnce).to.be.true;
    });

    it('throws an error if path is invalid', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.getPageMetadata('')).to.be.rejectedWith('Path must be a string');
    });

    it('throws an error if path does not start with a slash', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.getPageMetadata('test-path')).to.be.rejectedWith('Path must start with a slash');
    });

    it('correctly resolves paths ending with / for Google Drive', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.getPageMetadata('/test-path/');
      expect(client.rawClient.getPageMetadata.calledOnceWith('/test-path/index')).to.be.true;
    });

    it('correctly resolves paths ending with / for OneDrive', async () => {
      const client = ContentClient.createFrom(context, siteConfigOneDrive);
      await client.getPageMetadata('/test-path/');
      expect(client.rawClient.getPageMetadata.calledOnceWith('/test-path/index.docx')).to.be.true;
    });
  });

  describe('updatePageMetadata', () => {
    it('throws an error if raw client has non-200 status', async () => {
      ContentClient = await createErrorContentClient(false, true, 'Error updating page metadata');
      const metadata = new Map([
        ['lang', { value: 'en', type: 'text' }],
        ['keywords', { value: 'test, metadata', type: 'text' }],
      ]);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
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
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, metadata);

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.updatePageMetadata.calledOnceWith('/test-path', expectedMetadata)).to.be.true;
      expect(log.info.calledTwice).to.be.true;
      expect(log.info.firstCall.args[0]).to.equal(`Updating page metadata for test-site and path ${path}`);
      expect(log.info.secondCall.args[0]).to.equal(`Getting page metadata for test-site and path ${path}`);
    });

    it('throws an error if metadata is not a Map', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = { description: 'Test description' }; // Not a Map

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata must be a map');
    });

    it('throws an error if metadata Map is empty', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = new Map();

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata must not be empty');
    });

    it('throws an error if metadata key is invalid', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      const metadata = new Map([
        ['', 'Test description'], // Invalid key
      ]);

      await expect(client.updatePageMetadata('/test-path', metadata)).to.be.rejectedWith('Metadata key  must be a string');
    });

    it('throws an error if metadata value is invalid', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
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
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, newMetadata);

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.updatePageMetadata.calledOnceWith('/test-path', expectedMetadata)).to.be.true;
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
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);

      const path = '/test-path';
      const updatedMetadata = await client.updatePageMetadata(path, newMetadata, {
        overwrite: false,
      });

      expect(updatedMetadata).to.deep.equal(expectedMetadata);
      expect(client.rawClient.updatePageMetadata.calledOnceWith('/test-path', expectedMetadata)).to.be.true;
    });
  });

  describe('updateRedirects', () => {
    it('throws an error if raw client has non-200 status', async () => {
      ContentClient = await createErrorContentClient(false, true, 'Error updating redirects');
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }])).to.be.rejectedWith('Failed to update redirects');
    });
    it('throws an error if new redirects are not an array', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects({})).to.be.rejectedWith('Redirects must be an array');
    });
    it('throws an error if new redirects are an empty array', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([])).to.be.rejectedWith('Redirects must not be empty');
    });
    it('throws an error if new redirects contains an invalid entry', async () => {
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, 'malformed-redirect'])).to.be.rejectedWith('Redirect must be an object');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '', to: '/B' }])).to.be.rejectedWith('Redirect must have a valid from path');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '/A', to: '' }])).to.be.rejectedWith('Redirect must have a valid to path');
      await expect(client.updateRedirects([{ from: 'A', to: '/B' }, { from: '/A', to: '/C' }])).to.be.rejectedWith('Redirect from path must start with a slash');
      await expect(client.updateRedirects([{ from: '/A', to: 'B' }, { from: '/A', to: '/C' }])).to.be.rejectedWith('Redirect to path must start with a slash');
      await expect(client.updateRedirects([{ from: '/A', to: '/B' }, { from: '/A', to: '/A' }])).to.be.rejectedWith('Redirect from and to paths must be different');
    });
    it('update success', async () => {
      const newRedirects = [
        { from: '/test-X', to: '/test-Y' },
      ];

      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(client.rawClient.appendRedirects.calledOnceWith(sinon.match([{ from: '/test-X', to: '/test-Y' }]))).to.be.true;
    });
    it('update success ignores duplicates', async () => {
      const newRedirects = [
        { from: '/test-A', to: '/test-B' },
        { from: '/test-X', to: '/test-Y' },
        { from: '/test-B', to: '/test-D' },
        { from: '/test-X', to: '/test-Y' },
      ];

      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(client.rawClient.appendRedirects.calledOnceWith(sinon.match([{ from: '/test-X', to: '/test-Y' }]))).to.be.true;
    });
    it('detect cycles in new redirects', async () => {
      const newRedirects = [
        { from: '/test-D', to: '/test-A' },
        { from: '/test-C', to: '/test-E' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(client.rawClient.appendRedirects.calledOnceWith(sinon.match([{ from: '/test-C', to: '/test-E' }]))).to.be.true;
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
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await expect(client.updateRedirects(newRedirects)).to.be.rejectedWith('Redirect cycle detected');
    });
    it('does not call rawClient when all redirects are duplicates', async () => {
      const newRedirects = [
        { from: '/test-A', to: '/test-B' },
        { from: '/test-C', to: '/test-D' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(client.rawClient.appendRedirects).to.not.have.been.called;
    });
    it('does not call rawClient when there are no valid redirects', async () => {
      const newRedirects = [
        { from: '/test-D', to: '/test-A' },
      ];
      ContentClient = await createContentClientForRedirects(existingRedirects);
      const client = ContentClient.createFrom(context, siteConfigGoogleDrive);
      await client.updateRedirects(newRedirects);
      await expect(client.rawClient.appendRedirects).to.not.have.been.called;
    });
  });
});
