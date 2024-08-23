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

use(chaiAsPromised);

describe('ContentClient', () => {
  let sandbox;
  let env;
  let context;
  let log;
  let contentSDK;

  let ContentClient;

  const siteConfigGoogleDrive = {
    getId: () => 'test-site',
    getConfig: () => ({ content: { source: { type: 'drive.google' } } }),
  };

  const siteConfigOneDrive = {
    getId: () => 'test-site',
    getConfig: () => ({ content: { source: { type: 'onedrive' } } }),
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    log = { info: sinon.spy(), debug: sinon.spy() };
    env = {
      GOOGLE_DRIVE_CLIENT_ID: 'drive-client-id',
      GOOGLE_DRIVE_CLIENT_SECRET: 'drive-client-secret',
      ONEDRIVE_CLIENT_ID: 'onedrive-client-id',
      ONEDRIVE_CLIENT_SECRET: 'onedrive-client-secret',
    };
    context = { env, log };

    contentSDK = sinon.stub().returns({
      getPageMetadata: sinon.stub().resolves({ title: 'Test Page' }),
    });

    ContentClient = await esmock('../../src/clients/content-client.js', {
      '@adobe/spacecat-helix-content-sdk': { createFrom: contentSDK },
    });
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
      const client = new ContentClient(env, siteConfigGoogleDrive, log);
      expect(client.contentSource.type).to.equal('drive.google');
      expect(client.rawClient).to.exist;
      expect(client.rawClient.getPageMetadata).to.be.a('function');
    });

    it('validate and sets config, site, and rawClient for OneDrive', () => {
      const client = new ContentClient(env, siteConfigOneDrive, log);
      expect(client.contentSource.type).to.equal('onedrive');
      expect(client.rawClient).to.exist;
      expect(client.rawClient.getPageMetadata).to.be.a('function');
    });

    it('throws an error if site is missing', () => {
      expect(() => new ContentClient(env, null, log)).to.throw('Site is required');
      expect(() => new ContentClient(env, 'some-site', log)).to.throw('Site is required');
    });

    it('throws an error if site has no content source', () => {
      const invalidSite = { getConfig: () => ({ }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Site must have a content source');
    });

    it('throws an error if site\'s content source type is unsupported', () => {
      const invalidSite = { getConfig: () => ({ content: { source: {} } }) };
      expect(() => new ContentClient(env, invalidSite, log)).to.throw('Unsupported content source type: undefined');
    });

    it('throws an error if required config parameters are missing for Google Drive', () => {
      const invalidEnv = { GOOGLE_DRIVE_CLIENT_ID: 'drive-client-id' }; // Missing GOOGLE_DRIVE_CLIENT_SECRET
      expect(() => new ContentClient(invalidEnv, siteConfigGoogleDrive, log)).to.throw('Configuration parameter GOOGLE_DRIVE_CLIENT_SECRET is required for content source drive.google');
    });

    it('throws an error if required config parameters are missing for OneDrive', () => {
      const invalidEnv = { ONEDRIVE_CLIENT_ID: 'onedrive-client-id' }; // Missing ONEDRIVE_CLIENT_SECRET
      expect(() => new ContentClient(invalidEnv, siteConfigOneDrive, log)).to.throw('Configuration parameter ONEDRIVE_CLIENT_SECRET is required for content source onedrive');
    });
  });

  describe('getPageMetadata', () => {
    it('gets page metadata and logs duration for Google Drive', async () => {
      const client = new ContentClient(env, siteConfigGoogleDrive, log);
      const path = 'test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal({ title: 'Test Page' });
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getPageMetadata.calledOnceWith('test-path')).to.be.true;
      expect(log.debug.calledOnce).to.be.true;
    });

    it('gets page metadata and logs duration for OneDrive', async () => {
      const client = new ContentClient(env, siteConfigOneDrive, log);
      const path = 'test-path';
      const metadata = await client.getPageMetadata(path);

      expect(metadata).to.deep.equal({ title: 'Test Page' });
      expect(log.info.calledOnceWith(`Getting page metadata for test-site and path ${path}`)).to.be.true;
      expect(client.rawClient.getPageMetadata.calledOnceWith('test-path.docx')).to.be.true;
      expect(log.debug.calledOnce).to.be.true;
    });

    it('throws an error if path is invalid', async () => {
      const client = new ContentClient(env, siteConfigGoogleDrive, log);
      await expect(client.getPageMetadata('')).to.be.rejectedWith('Path must be a string');
    });

    it('throws an error if path starts with a slash', async () => {
      const client = new ContentClient(env, siteConfigGoogleDrive, log);
      await expect(client.getPageMetadata('/test-path')).to.be.rejectedWith('Path must not start with a slash');
    });

    it('correctly resolves paths ending with / for Google Drive', async () => {
      const client = new ContentClient(env, siteConfigGoogleDrive, log);
      await client.getPageMetadata('test-path/');
      expect(client.rawClient.getPageMetadata.calledOnceWith('test-path/index')).to.be.true;
    });

    it('correctly resolves paths ending with / for OneDrive', async () => {
      const client = new ContentClient(env, siteConfigOneDrive, log);
      await client.getPageMetadata('test-path/');
      expect(client.rawClient.getPageMetadata.calledOnceWith('test-path/index.docx')).to.be.true;
    });
  });
});
