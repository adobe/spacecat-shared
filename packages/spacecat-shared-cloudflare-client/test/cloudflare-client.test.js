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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';

import CloudflareClient from '../src/index.js';

use(chaiAsPromised);
use(sinonChai);

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const FAKE_TOKEN = 'test-cf-token-abc123';
const ACCOUNT_ID = 'acc-0001';
const ZONE_ID = 'zone-0001';
const ROUTE_ID = 'route-0001';
const SCRIPT_NAME = 'edge-optimize-router';

function makeLog() {
  return {
    info: sinon.stub(),
    debug: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
  };
}

describe('CloudflareClient', () => {
  let client;
  let log;

  beforeEach(() => {
    log = makeLog();
    client = new CloudflareClient({ token: FAKE_TOKEN }, log);
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  // ─── createFrom ──────────────────────────────────────────────────────────

  describe('createFrom', () => {
    it('creates a client when CLOUDFLARE_API_TOKEN is set', () => {
      const c = CloudflareClient.createFrom({
        env: { CLOUDFLARE_API_TOKEN: FAKE_TOKEN },
        log,
      });
      expect(c).to.be.instanceOf(CloudflareClient);
    });

    it('uses console as default log', () => {
      const c = CloudflareClient.createFrom({ env: { CLOUDFLARE_API_TOKEN: FAKE_TOKEN } });
      expect(c).to.be.instanceOf(CloudflareClient);
    });

    it('throws when CLOUDFLARE_API_TOKEN is missing', () => {
      expect(() => CloudflareClient.createFrom({ env: {}, log }))
        .to.throw('CloudflareClient requires CLOUDFLARE_API_TOKEN in context.env');
    });

    it('throws when CLOUDFLARE_API_TOKEN is an empty string', () => {
      expect(() => CloudflareClient.createFrom({ env: { CLOUDFLARE_API_TOKEN: '' }, log }))
        .to.throw('CloudflareClient requires CLOUDFLARE_API_TOKEN in context.env');
    });
  });

  // ─── constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when token is empty', () => {
      expect(() => new CloudflareClient({ token: '' }))
        .to.throw('CloudflareClient requires a token');
    });

    it('accepts a custom apiBase', () => {
      const c = new CloudflareClient({ token: FAKE_TOKEN, apiBase: 'https://custom.example.com' }, log);
      expect(c).to.be.instanceOf(CloudflareClient);
    });
  });

  // ─── listAccounts ────────────────────────────────────────────────────────

  describe('listAccounts', () => {
    it('returns accounts on success', async () => {
      const result = [{ id: ACCOUNT_ID, name: 'Acme Corp' }];
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .matchHeader('Authorization', `Bearer ${FAKE_TOKEN}`)
        .reply(200, { success: true, result });

      const accounts = await client.listAccounts();
      expect(accounts).to.deep.equal(result);
      expect(log.info).to.have.been.calledWith('Listing Cloudflare accounts');
    });

    it('passes through custom page and perPage', async () => {
      const result = [{ id: ACCOUNT_ID, name: 'Acme Corp' }];
      nock(CF_API_BASE)
        .get('/accounts?page=3&per_page=10')
        .reply(200, { success: true, result });

      const accounts = await client.listAccounts({ page: 3, perPage: 10 });
      expect(accounts).to.deep.equal(result);
    });

    it('throws when the API returns success:false with an error message', async () => {
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .reply(200, { success: false, errors: [{ message: 'Unauthorized' }] });

      await expect(client.listAccounts()).to.be.rejectedWith('Unauthorized');
    });

    it('throws with a generic message when errors array is empty', async () => {
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .reply(200, { success: false, errors: [] });

      await expect(client.listAccounts())
        .to.be.rejectedWith('Cloudflare API error on /accounts?page=1&per_page=50');
    });

    it('throws a contextual error on a non-OK HTML response', async () => {
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .reply(502, '<html>Bad Gateway</html>');

      await expect(client.listAccounts())
        .to.be.rejectedWith('Cloudflare API returned 502 on /accounts?page=1&per_page=50');
    });

    it('throws a contextual error when fetch itself fails', async () => {
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .replyWithError('ECONNREFUSED');

      await expect(client.listAccounts())
        .to.be.rejectedWith('Cloudflare API request to /accounts?page=1&per_page=50 failed');
    });

    it('throws a contextual error on a non-JSON 200 response', async () => {
      nock(CF_API_BASE)
        .get('/accounts?page=1&per_page=50')
        .reply(200, 'not json', { 'Content-Type': 'text/plain' });

      await expect(client.listAccounts())
        .to.be.rejectedWith('Cloudflare API returned a non-JSON response on /accounts?page=1&per_page=50');
    });
  });

  // ─── deployWorkerScript ──────────────────────────────────────────────────

  describe('deployWorkerScript', () => {
    it('uploads a worker script with default options', async () => {
      const result = { id: SCRIPT_NAME, etag: 'abc123' };
      let capturedBody;
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, { success: true, result });

      const res = await client.deployWorkerScript(
        ACCOUNT_ID,
        SCRIPT_NAME,
        'export default { async fetch(r) { return fetch(r); } }',
        [{ name: 'HOST', type: 'plain_text', text: 'example.com' }],
        { overwrite: true },
      );
      expect(res).to.deep.equal(result);
      // Verify the multipart body carries the expected metadata, bindings and observability flag.
      expect(capturedBody).to.contain('"main_module":"worker.js"');
      expect(capturedBody).to.contain('"compatibility_date":"2025-01-01"');
      expect(capturedBody).to.contain('"observability":{"enabled":true}');
      expect(capturedBody).to.contain('"name":"HOST"');
      expect(capturedBody).to.contain('"text":"example.com"');
      expect(log.info).to.have.been.calledWith(
        `Deploying worker script '${SCRIPT_NAME}' to account ${ACCOUNT_ID}`,
      );
    });

    it('deploys without observability when disabled', async () => {
      const result = { id: SCRIPT_NAME };
      let capturedBody;
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, { success: true, result });

      const res = await client.deployWorkerScript(
        ACCOUNT_ID,
        SCRIPT_NAME,
        'export default {}',
        [],
        { observability: false, overwrite: true },
      );
      expect(res).to.deep.equal(result);
      expect(capturedBody).to.not.contain('observability');
    });

    it('accepts a custom compatibilityDate', async () => {
      const result = { id: SCRIPT_NAME };
      let capturedBody;
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, { success: true, result });

      const res = await client.deployWorkerScript(
        ACCOUNT_ID,
        SCRIPT_NAME,
        'export default {}',
        [],
        { compatibilityDate: '2024-06-01', overwrite: true },
      );
      expect(res).to.deep.equal(result);
      expect(capturedBody).to.contain('"compatibility_date":"2024-06-01"');
    });

    it('throws when accountId is missing', async () => {
      await expect(client.deployWorkerScript('', SCRIPT_NAME, 'export default {}'))
        .to.be.rejectedWith('accountId is required');
    });

    it('throws when scriptName is missing', async () => {
      await expect(client.deployWorkerScript(ACCOUNT_ID, '', 'export default {}'))
        .to.be.rejectedWith('scriptName is required');
    });

    it('throws when scriptContent is missing', async () => {
      await expect(client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, ''))
        .to.be.rejectedWith('scriptContent is required');
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(200, { success: false, errors: [{ message: 'Script too large' }] });

      await expect(
        client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}', [], { overwrite: true }),
      ).to.be.rejectedWith('Script too large');
    });

    it('throws by default when the script already exists', async () => {
      nock(CF_API_BASE)
        .get(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(200, 'export default {}');

      await expect(
        client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}'),
      ).to.be.rejectedWith(`Worker script '${SCRIPT_NAME}' already exists in account ${ACCOUNT_ID}`);
    });

    it('deploys when script does not exist and overwrite is false', async () => {
      const result = { id: SCRIPT_NAME, etag: 'abc123' };
      nock(CF_API_BASE)
        .get(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(404);
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(200, { success: true, result });

      const res = await client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}');
      expect(res).to.deep.equal(result);
    });

    it('skips existence check and deploys when overwrite is true', async () => {
      const result = { id: SCRIPT_NAME, etag: 'abc123' };
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(200, { success: true, result });

      const res = await client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}', [], { overwrite: true });
      expect(res).to.deep.equal(result);
    });

    it('throws when existence check returns a non-404 error status', async () => {
      nock(CF_API_BASE)
        .get(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .reply(403, 'Forbidden');

      await expect(
        client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}'),
      ).to.be.rejectedWith('Cloudflare API returned 403');
    });

    it('throws when existence check fetch itself fails', async () => {
      nock(CF_API_BASE)
        .get(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}`)
        .replyWithError('ECONNREFUSED');

      await expect(
        client.deployWorkerScript(ACCOUNT_ID, SCRIPT_NAME, 'export default {}'),
      ).to.be.rejectedWith('Cloudflare API request to /accounts');
    });
  });

  // ─── setWorkerSecret ─────────────────────────────────────────────────────

  describe('setWorkerSecret', () => {
    it('sets a secret successfully', async () => {
      const result = { name: 'MY_SECRET', type: 'secret_text' };
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/secrets`)
        .reply(200, { success: true, result });

      const res = await client.setWorkerSecret(ACCOUNT_ID, SCRIPT_NAME, 'MY_SECRET', 's3cr3t');
      expect(res).to.deep.equal(result);
      expect(log.debug).to.have.been.calledWith(
        `Setting secret 'MY_SECRET' on worker '${SCRIPT_NAME}'`,
      );
    });

    it('throws when accountId is missing', async () => {
      await expect(client.setWorkerSecret('', SCRIPT_NAME, 'KEY', 'val'))
        .to.be.rejectedWith('accountId is required');
    });

    it('throws when scriptName is missing', async () => {
      await expect(client.setWorkerSecret(ACCOUNT_ID, '', 'KEY', 'val'))
        .to.be.rejectedWith('scriptName is required');
    });

    it('throws when secretName is missing', async () => {
      await expect(client.setWorkerSecret(ACCOUNT_ID, SCRIPT_NAME, '', 'val'))
        .to.be.rejectedWith('secretName is required');
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .put(`/accounts/${ACCOUNT_ID}/workers/scripts/${SCRIPT_NAME}/secrets`)
        .reply(200, { success: false, errors: [{ message: 'Worker not found' }] });

      await expect(
        client.setWorkerSecret(ACCOUNT_ID, SCRIPT_NAME, 'KEY', 'val'),
      ).to.be.rejectedWith('Worker not found');
    });
  });

  // ─── listZones ───────────────────────────────────────────────────────────

  describe('listZones', () => {
    it('returns zones on success', async () => {
      const result = [{ id: ZONE_ID, name: 'example.com' }];
      nock(CF_API_BASE)
        .get('/zones?page=1&per_page=50&status=active')
        .reply(200, { success: true, result });

      const zones = await client.listZones();
      expect(zones).to.deep.equal(result);
      expect(log.info).to.have.been.calledWith('Listing Cloudflare zones');
    });

    it('passes through custom page and perPage', async () => {
      const result = [{ id: ZONE_ID, name: 'example.com' }];
      nock(CF_API_BASE)
        .get('/zones?page=2&per_page=25&status=active')
        .reply(200, { success: true, result });

      const zones = await client.listZones({ page: 2, perPage: 25 });
      expect(zones).to.deep.equal(result);
    });

    it('filters by accountId when provided', async () => {
      const result = [{ id: ZONE_ID, name: 'example.com' }];
      nock(CF_API_BASE)
        .get(`/zones?page=1&per_page=50&status=active&account.id=${ACCOUNT_ID}`)
        .reply(200, { success: true, result });

      const zones = await client.listZones({ accountId: ACCOUNT_ID });
      expect(zones).to.deep.equal(result);
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .get('/zones?page=1&per_page=50&status=active')
        .reply(200, { success: false, errors: [{ message: 'Forbidden' }] });

      await expect(client.listZones()).to.be.rejectedWith('Forbidden');
    });
  });

  // ─── listRoutes ──────────────────────────────────────────────────────────

  describe('listRoutes', () => {
    it('returns routes for a zone', async () => {
      const result = [{ id: ROUTE_ID, pattern: 'example.com/*', script: SCRIPT_NAME }];
      nock(CF_API_BASE)
        .get(`/zones/${ZONE_ID}/workers/routes`)
        .reply(200, { success: true, result });

      const routes = await client.listRoutes(ZONE_ID);
      expect(routes).to.deep.equal(result);
      expect(log.info).to.have.been.calledWith(`Listing routes for zone ${ZONE_ID}`);
    });

    it('throws when zoneId is missing', async () => {
      await expect(client.listRoutes('')).to.be.rejectedWith('zoneId is required');
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .get(`/zones/${ZONE_ID}/workers/routes`)
        .reply(200, { success: false, errors: [{ message: 'Zone not found' }] });

      await expect(client.listRoutes(ZONE_ID)).to.be.rejectedWith('Zone not found');
    });
  });

  // ─── addRoute ────────────────────────────────────────────────────────────

  describe('addRoute', () => {
    it('adds a route and returns the result', async () => {
      const result = { id: ROUTE_ID, pattern: 'example.com/*', script: SCRIPT_NAME };
      nock(CF_API_BASE)
        .post(`/zones/${ZONE_ID}/workers/routes`, { pattern: 'example.com/*', script: SCRIPT_NAME })
        .reply(200, { success: true, result });

      const res = await client.addRoute(ZONE_ID, 'example.com/*', SCRIPT_NAME);
      expect(res).to.deep.equal(result);
      expect(log.info).to.have.been.calledWith(
        `Adding route 'example.com/*' → '${SCRIPT_NAME}' on zone ${ZONE_ID}`,
      );
    });

    it('throws when zoneId is missing', async () => {
      await expect(client.addRoute('', 'example.com/*', SCRIPT_NAME))
        .to.be.rejectedWith('zoneId is required');
    });

    it('throws when pattern is missing', async () => {
      await expect(client.addRoute(ZONE_ID, '', SCRIPT_NAME))
        .to.be.rejectedWith('pattern is required');
    });

    it('throws when scriptName is missing', async () => {
      await expect(client.addRoute(ZONE_ID, 'example.com/*', ''))
        .to.be.rejectedWith('scriptName is required');
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .post(`/zones/${ZONE_ID}/workers/routes`)
        .reply(200, { success: false, errors: [{ message: 'Duplicate route' }] });

      await expect(client.addRoute(ZONE_ID, 'example.com/*', SCRIPT_NAME))
        .to.be.rejectedWith('Duplicate route');
    });
  });

  // ─── deleteRoute ─────────────────────────────────────────────────────────

  describe('deleteRoute', () => {
    it('deletes a route and returns the result', async () => {
      const result = { id: ROUTE_ID };
      nock(CF_API_BASE)
        .delete(`/zones/${ZONE_ID}/workers/routes/${ROUTE_ID}`)
        .reply(200, { success: true, result });

      const res = await client.deleteRoute(ZONE_ID, ROUTE_ID);
      expect(res).to.deep.equal(result);
      expect(log.info).to.have.been.calledWith(
        `Deleting route ${ROUTE_ID} from zone ${ZONE_ID}`,
      );
    });

    it('throws when zoneId is missing', async () => {
      await expect(client.deleteRoute('', ROUTE_ID)).to.be.rejectedWith('zoneId is required');
    });

    it('throws when routeId is missing', async () => {
      await expect(client.deleteRoute(ZONE_ID, '')).to.be.rejectedWith('routeId is required');
    });

    it('throws when the API returns an error', async () => {
      nock(CF_API_BASE)
        .delete(`/zones/${ZONE_ID}/workers/routes/${ROUTE_ID}`)
        .reply(200, { success: false, errors: [{ message: 'Route not found' }] });

      await expect(client.deleteRoute(ZONE_ID, ROUTE_ID)).to.be.rejectedWith('Route not found');
    });
  });
});
