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
import nock from 'nock';
import { tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import SplunkAPIClient from '../src/index.js';

use(chaiAsPromised);

describe('SplunkAPIClient unit tests', () => {
  let client;

  const config = {
    apiBaseUrl: 'https://example.com',
    apiUser: 'user',
    apiPass: 'pass',
  };

  const loginSuccessResponse = `<response>
      <sessionKey>sessionKey123</sessionKey>
      <messages>
        <msg code=""></msg>
      </messages>
    </response>`;

  const loginSuccessSetCookieHeader = 'OMM-nom-nom-nom...=123abc; path=/; SameSite=None; Secure';

  const loginFailedResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <response>
      <messages>
        <msg type="WARN" code="incorrect_username_or_password">Login failed</msg>
      </messages>
    </response>`;

  const notFoundsResponse = {
    preview: false,
    init_offset: 0,
    messages: [
      {
        type: 'INFO',
        text: 'Your timerange was substituted based on your search string',
      },
    ],
    fields: [
      {
        name: 'aem_service',
        groupby_rank: '0',
      },
      {
        name: 'request_x_forwarded_host',
        groupby_rank: '1',
      },
      {
        name: 'url',
        groupby_rank: '2',
      },
      {
        name: 'count',
      },
    ],
    results: [
      {
        aem_service: 'cm-p12345-e123456',
        request_x_forwarded_host: 'www.example.com',
        url: '/404',
        count: '2176',
      },
      {
        aem_service: 'cm-p23456-e234567',
        request_x_forwarded_host: 'www.example2.com',
        url: '/page-not-found.html',
        count: '432',
      },
    ],
    highlighted: {},
  };

  const invalidResponse = '<invalid>oops</invalid>';

  beforeEach(() => {
    client = new SplunkAPIClient(config, fetch);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('throws error when api base url is missing', () => {
      expect(() => new SplunkAPIClient({})).to.throw('Invalid Splunk API Base URL: undefined');
    });

    it('throws error when fetch is not a function', () => {
      expect(() => new SplunkAPIClient(config, 'fetch')).to.throw('"fetchAPI" must be a function');
    });
  });

  describe('createFrom', () => {
    it('creates an instance of SplunkAPIClient', () => {
      const context = {
        env: {
          SPLUNK_API_BASE_URL: config.apiBaseUrl,
          SPLUNK_API_USER: config.apiUser,
          SPLUNK_API_PASS: config.apiPass,
        },
      };

      const splunkAPIClient = SplunkAPIClient.createFrom(context);
      expect(splunkAPIClient).to.be.instanceOf(SplunkAPIClient);
    });
  });

  describe('login', () => {
    it('login with correct credentials', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      const result = await client.login();
      expect(result).to.deep.equal({
        sessionId: 'sessionKey123',
        cookie: 'OMM-nom-nom-nom...=123abc',
      });
    });

    it('login with correct credentials but invalid response', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, invalidResponse);

      const result = await client.login();
      expect(result).to.have.property('error');
    });

    it('login with incorrect credentials', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(401, loginFailedResponse);

      const result = await client.login('wronguser', 'wrongpassword');
      expect(result).to.deep.equal({
        error: 'Login failed',
      });
    });
  });

  describe('getNotFounds', () => {
    it('get Not Founds with correct credentials', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .reply(200, notFoundsResponse);

      const result = await client.getNotFounds();
      expect(result).to.deep.equal({
        results: [
          {
            aem_service: 'cm-p12345-e123456',
            request_x_forwarded_host: 'www.example.com',
            url: '/404',
            count: '2176',
          },
          {
            aem_service: 'cm-p23456-e234567',
            request_x_forwarded_host: 'www.example2.com',
            url: '/page-not-found.html',
            count: '432',
          },
        ],
      });
    });

    it('get Not Founds with correct credentials but invalid response', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .reply(200, invalidResponse);

      const result = await client.getNotFounds();
      expect(result).to.have.property('error');
    });

    it('get Not Founds with incorrect credentials', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(401, loginFailedResponse);

      const result = await client.getNotFounds('wronguser', 'wrongpassword');
      expect(result).to.deep.equal({
        error: 'Login failed',
      });
    });
  });

  describe('oneshotSearch', () => {
    it('throws when searchString is missing', async () => {
      await expect(client.oneshotSearch('')).to.be.rejectedWith('Missing searchString');
    });

    it('runs oneshot search after login', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .reply(200, notFoundsResponse);

      const resp = await client.oneshotSearch('search index=dx_aem_engineering | head 1');
      expect(resp).to.deep.equal(notFoundsResponse);
    });

    it('reuses login across calls', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .once()
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .twice()
        .reply(200, notFoundsResponse);

      await client.oneshotSearch('search index=dx_aem_engineering | head 1');
      await client.oneshotSearch('search index=dx_aem_engineering | head 1');
    });

    it('runs without logging in if loginObj is already set', async () => {
      client.loginObj = { sessionId: 'sessionKey123', cookie: 'cookie123' };

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .reply(200, notFoundsResponse);

      const resp = await client.oneshotSearch('search index=dx_aem_engineering | head 1');
      expect(resp).to.deep.equal(notFoundsResponse);
    });

    it('throws with non-200 response', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, loginSuccessResponse, { 'Set-Cookie': loginSuccessSetCookieHeader });

      nock(config.apiBaseUrl)
        .post('/servicesNS/admin/search/search/jobs')
        .reply(400, { error: 'bad_request' });

      await expect(client.oneshotSearch('search index=dx_aem_engineering | head 1'))
        .to.be.rejectedWith('Splunk oneshot search failed. Status: 400');
    });

    it('propagates login parse errors (error is an Error instance)', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(200, invalidResponse);

      await expect(client.oneshotSearch('search index=dx_aem_engineering | head 1'))
        .to.be.rejected;
    });

    it('throws when login fails (error is string)', async () => {
      nock(config.apiBaseUrl)
        .post('/services/auth/login')
        .reply(401, loginFailedResponse);

      await expect(client.oneshotSearch('search index=dx_aem_engineering | head 1'))
        .to.be.rejectedWith('Login failed');
    });
  });
});
