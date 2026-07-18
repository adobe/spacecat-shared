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

import AkamaiClient, {
  normalizeDomain,
  defaultRuleHasCaching,
  getDefaultOriginSsl,
} from '../src/index.js';

use(chaiAsPromised);
use(sinonChai);

const HOST = 'akab-xxxxx.luna.akamaiapis.net';
const API_BASE = `https://${HOST}`;
const CREDS = {
  host: HOST,
  clientToken: 'test-client-token',
  clientSecret: 'test-client-secret',
  accessToken: 'test-access-token',
  notifyEmails: ['a@example.com'],
};
const CONTRACT_ID = 'ctr_1';
const GROUP_ID = 'grp_1';
const PROPERTY_ID = 'prp_123';

const sandbox = sinon.createSandbox();

function makeLog() {
  return {
    info: sandbox.stub(),
    debug: sandbox.stub(),
    warn: sandbox.stub(),
    error: sandbox.stub(),
  };
}

// Any request through AkamaiClient carries a valid EdgeGrid Authorization
// header — this matcher just asserts its presence/shape without re-deriving
// the exact signature (that's edgegrid-auth.test.js's job). nock's
// matchHeader() calls this with the raw header value, not a headers object.
function hasEdgeGridAuth(value) {
  return /^EG1-HMAC-SHA256 client_token=.*signature=.+$/.test(value || '');
}

describe('AkamaiClient', () => {
  let client;
  let log;

  beforeEach(() => {
    log = makeLog();
    client = new AkamaiClient(CREDS, log);
    nock.disableNetConnect();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
    nock.enableNetConnect();
  });

  // ─── createFrom ────────────────────────────────────────────────────────

  describe('createFrom', () => {
    it('creates a client from context.env, parsing comma-separated notify emails', () => {
      const c = AkamaiClient.createFrom({
        env: {
          AKAMAI_HOST: HOST,
          AKAMAI_CLIENT_TOKEN: 'ct',
          AKAMAI_CLIENT_SECRET: 'cs',
          AKAMAI_ACCESS_TOKEN: 'at',
          AKAMAI_ACCOUNT_SWITCH_KEY: 'ask',
          AKAMAI_NOTIFY_EMAILS: 'a@example.com, b@example.com',
        },
        log,
      });
      expect(c).to.be.instanceOf(AkamaiClient);
      expect(c.accountSwitchKey).to.equal('ask');
      expect(c.notifyEmails).to.deep.equal(['a@example.com', 'b@example.com']);
    });

    it('uses console as the default log and leaves notifyEmails undefined when not set', () => {
      const c = AkamaiClient.createFrom({
        env: {
          AKAMAI_HOST: HOST,
          AKAMAI_CLIENT_TOKEN: 'ct',
          AKAMAI_CLIENT_SECRET: 'cs',
          AKAMAI_ACCESS_TOKEN: 'at',
        },
      });
      expect(c).to.be.instanceOf(AkamaiClient);
      expect(c.notifyEmails).to.be.undefined;
    });

    it('throws when a required env var is missing', () => {
      expect(() => AkamaiClient.createFrom({ env: { AKAMAI_HOST: HOST }, log }))
        .to.throw('AkamaiClient requires clientToken');
    });
  });

  // ─── constructor ───────────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when host is missing', () => {
      expect(() => new AkamaiClient({ ...CREDS, host: '' }))
        .to.throw('AkamaiClient requires host');
    });

    it('throws when clientSecret is missing', () => {
      expect(() => new AkamaiClient({ ...CREDS, clientSecret: undefined }))
        .to.throw('AkamaiClient requires clientSecret');
    });

    it('strips a scheme and trailing slashes from the host', () => {
      const c = new AkamaiClient({ ...CREDS, host: 'https://akab-xxxxx.luna.akamaiapis.net/' }, log);
      expect(c.host).to.equal(HOST);
    });

    it('defaults to console when no log is given', () => {
      const c = new AkamaiClient(CREDS);
      expect(c).to.be.instanceOf(AkamaiClient);
    });
  });

  // ─── low-level request behavior (via getLatestVersion) ────────────────

  describe('request handling', () => {
    it('signs requests with a valid EdgeGrid Authorization header', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .matchHeader('Authorization', hasEdgeGridAuth)
        .reply(200, { versions: { items: [{ propertyVersion: 7 }] } });

      const version = await client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID);
      expect(version).to.equal(7);
    });

    it('appends accountSwitchKey to the query string when configured', async () => {
      const c = new AkamaiClient({ ...CREDS, accountSwitchKey: 'ask123' }, log);
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID, accountSwitchKey: 'ask123' })
        .reply(200, { versions: { items: [{ propertyVersion: 1 }] } });

      const version = await c.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID);
      expect(version).to.equal(1);
    });

    it('throws a contextual error when the underlying fetch fails', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query(true)
        .replyWithError('socket hang up');

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/request failed/);
    });

    it('throws a contextual error on a non-OK response', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query(true)
        .reply(403, 'forbidden');

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/-> 403: forbidden/);
    });

    it('returns an empty object for an empty response body', async () => {
      nock(API_BASE)
        .post(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, '');

      const link = await client.activate(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID, 'STAGING');
      expect(link).to.equal('');
    });

    it('throws a contextual error on a non-JSON 200 response', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query(true)
        .reply(200, '<html>not json</html>');

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/returned a non-JSON response/);
    });

    it('throws when a required argument is missing', async () => {
      await expect(client.getLatestVersion('', CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith('propertyId is required');
    });

    it('throws a contextual error when the property has no versions', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query(true)
        .reply(200, { versions: { items: [] } });

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/no versions/);
    });

    // PAPI 301-redirects /versions/latest to the concrete /versions/{N}. Because the EdgeGrid
    // signature is bound to the request URL, the client must follow the redirect manually and
    // re-sign for the new URL (a followed-and-not-re-signed request is rejected 401).
    it('follows a redirect and re-signs the request for the new URL', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .matchHeader('Authorization', hasEdgeGridAuth)
        .reply(301, '', {
          Location: `${API_BASE}/papi/v1/properties/${PROPERTY_ID}/versions/7`
            + `?contractId=${CONTRACT_ID}&groupId=${GROUP_ID}`,
        });
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/7`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .matchHeader('Authorization', hasEdgeGridAuth)
        .reply(200, { versions: { items: [{ propertyVersion: 7 }] } });

      const version = await client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID);
      expect(version).to.equal(7);
    });

    it('gives up after too many redirects', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .times(6)
        .reply(301, '', {
          Location: `/papi/v1/properties/${PROPERTY_ID}/versions/latest`
            + `?contractId=${CONTRACT_ID}&groupId=${GROUP_ID}`,
        });

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/too many redirects/);
    });

    // Re-signing re-attaches the Authorization header to the redirect target, so a cross-host
    // Location must be refused rather than leaking EdgeGrid credentials to another origin.
    it('refuses to follow a redirect to a different host', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/latest`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(301, '', { Location: 'https://evil.example.com/papi/v1/steal' });

      await expect(client.getLatestVersion(PROPERTY_ID, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/redirect to different host rejected: evil\.example\.com/);
    });

    // Following a redirect only makes sense for safe, body-less methods; replaying a POST/PUT
    // body to the redirect target would silently re-issue the mutation elsewhere.
    it('refuses to follow a redirect on a non-GET request', async () => {
      nock(API_BASE)
        .post(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(307, '', {
          Location: `${API_BASE}/papi/v1/properties/${PROPERTY_ID}/activations-elsewhere`,
        });

      await expect(client.activate(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID, 'STAGING'))
        .to.be.rejectedWith(/unexpected redirect \(307\)/);
    });
  });

  // ─── searchBy / findPropertiesByDomain ─────────────────────────────────

  describe('searchBy', () => {
    it('returns matching versions', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(200, { versions: { items: [{ propertyId: PROPERTY_ID }] } });

      const items = await client.searchBy('hostname', 'example.com');
      expect(items).to.deep.equal([{ propertyId: PROPERTY_ID }]);
    });

    it('returns an empty array when versions are absent', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'nomatch.com' })
        .reply(200, {});

      const items = await client.searchBy('hostname', 'nomatch.com');
      expect(items).to.deep.equal([]);
    });

    it('rejects a key that is not on the allowlist', async () => {
      await expect(client.searchBy('__proto__', 'x'))
        .to.be.rejectedWith(/searchBy key must be one of/);
    });

    it('throws when value is missing', async () => {
      await expect(client.searchBy('hostname', ''))
        .to.be.rejectedWith('value is required');
    });
  });

  describe('findPropertiesByDomain', () => {
    it('matches by hostname and de-dupes across the www/apex variant', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(200, {
          versions: {
            items: [{
              propertyId: PROPERTY_ID,
              propertyName: 'my-property',
              contractId: CONTRACT_ID,
              groupId: GROUP_ID,
              propertyVersion: 3,
              productionStatus: 'ACTIVE',
              stagingStatus: 'ACTIVE',
            }],
          },
        })
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(200, { versions: { items: [{ propertyId: PROPERTY_ID }] } })
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('example.com');
      expect(matches).to.have.lengthOf(1);
      expect(matches[0]).to.include({ propertyId: PROPERTY_ID, propertyName: 'my-property' });
      expect(matches[0].matchedOn).to.deep.equal(['hostname']);
      expect(matches[0].matchedValues).to.deep.equal(['example.com', 'www.example.com']);
    });

    it('adds the bare apex when given a www. domain', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(200, { versions: { items: [{ propertyId: PROPERTY_ID }] } })
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('www.example.com');
      expect(matches).to.have.lengthOf(1);
    });

    it('ranks a hostname match ahead of a name-only match, and name-only matches alphabetically', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(200, {
          versions: { items: [{ propertyId: 'prp_by_hostname', propertyName: 'zzz-hostname' }] },
        })
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .reply(200, {
          versions: {
            items: [
              { propertyId: 'prp_by_name_2', propertyName: 'bbb-name' },
              { propertyId: 'prp_by_name_1', propertyName: 'aaa-name' },
            ],
          },
        })
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('example.com');
      expect(matches.map((m) => m.propertyId)).to.deep.equal([
        'prp_by_hostname', 'prp_by_name_1', 'prp_by_name_2',
      ]);
    });

    it('ignores entries with no propertyId', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(200, { versions: { items: [{ propertyName: 'no-id' }] } })
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('example.com');
      expect(matches).to.deep.equal([]);
    });

    it('swallows errors from individual lookups and still returns other matches', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .replyWithError('boom')
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(200, { versions: { items: [{ propertyId: PROPERTY_ID }] } })
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .replyWithError('boom')
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('example.com');
      expect(matches).to.have.lengthOf(1);
      expect(matches[0].propertyId).to.equal(PROPERTY_ID);
      // The whole point of catching each lookup is to keep partial failures
      // observable rather than silent — assert they were actually logged.
      expect(log.warn).to.have.been.called;
      expect(log.warn).to.have.been.calledWithMatch(/failed, continuing/);
    });

    it('tie-breaks two hostname matches without a propertyName without throwing', async () => {
      nock(API_BASE)
        .post('/papi/v1/search/find-by-value', { hostname: 'example.com' })
        .reply(200, {
          versions: {
            items: [
              { propertyId: 'prp_1' },
              { propertyId: 'prp_2' },
            ],
          },
        })
        .post('/papi/v1/search/find-by-value', { hostname: 'www.example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example.com' })
        .reply(404)
        .post('/papi/v1/search/find-by-value', { propertyName: 'example' })
        .reply(404);

      const matches = await client.findPropertiesByDomain('example.com');
      expect(matches.map((m) => m.propertyId).sort()).to.deep.equal(['prp_1', 'prp_2']);
      matches.forEach((m) => expect(m.matchedOn).to.deep.equal(['hostname']));
    });
  });

  // ─── version + rule-tree operations ─────────────────────────────────────

  describe('getRuleTree', () => {
    it('returns the rule tree, its ruleFormat, and the version etag', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/5/rules`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(200, { ruleFormat: 'v2024-01-01', etag: 'abc123', rules: { name: 'default' } });

      const result = await client.getRuleTree(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID);
      const { ruleTree, ruleFormat, etag } = result;
      expect(ruleFormat).to.equal('v2024-01-01');
      expect(etag).to.equal('abc123');
      expect(ruleTree.rules).to.deep.equal({ name: 'default' });
    });

    it('returns etag undefined when the PAPI response omits it', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/versions/5/rules`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(200, { ruleFormat: 'v2024-01-01', rules: { name: 'default' } });

      const { etag } = await client.getRuleTree(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID);
      expect(etag).to.equal(undefined);
    });

    it('throws when version is not an integer', async () => {
      await expect(client.getRuleTree(PROPERTY_ID, '5', CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith('version must be an integer');
    });
  });

  describe('createVersion', () => {
    it('returns the new version number parsed from versionLink', async () => {
      nock(API_BASE)
        .post(`/papi/v1/properties/${PROPERTY_ID}/versions`, { createFromVersion: 5 })
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(201, {
          versionLink: `/papi/v1/properties/${PROPERTY_ID}/versions/6?contractId=${CONTRACT_ID}`,
        });

      const version = await client.createVersion(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID);
      expect(version).to.equal(6);
    });

    it('throws when baseVersion is not an integer', async () => {
      await expect(client.createVersion(PROPERTY_ID, 'latest', CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith('baseVersion must be an integer');
    });

    it('throws a contextual error when versionLink is missing or unparseable', async () => {
      nock(API_BASE)
        .post(`/papi/v1/properties/${PROPERTY_ID}/versions`, { createFromVersion: 5 })
        .query(true)
        .reply(201, {});

      await expect(client.createVersion(PROPERTY_ID, 5, CONTRACT_ID, GROUP_ID))
        .to.be.rejectedWith(/parseable versionLink/);
    });
  });

  describe('updateRuleTree', () => {
    it('sends the rule-format content-type header when ruleFormat is given', async () => {
      nock(API_BASE)
        .matchHeader('content-type', 'application/vnd.akamai.papirules.v2024-01-01+json')
        .put(`/papi/v1/properties/${PROPERTY_ID}/versions/6/rules`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID, validateRules: 'true' })
        .reply(200, { errors: [], warnings: [] });

      const tree = { rules: {} };
      const result = await client.updateRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, tree, 'v2024-01-01');
      expect(result).to.deep.equal({ errors: [], warnings: [] });
    });

    it('omits the rule-format content-type header when ruleFormat is not given', async () => {
      nock(API_BASE)
        .matchHeader('content-type', 'application/json')
        .put(`/papi/v1/properties/${PROPERTY_ID}/versions/6/rules`)
        .query(true)
        .reply(200, { errors: [] });

      const tree = { rules: {} };
      const result = await client.updateRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, tree);
      expect(result).to.deep.equal({ errors: [] });
    });

    it('throws when version is not an integer', async () => {
      await expect(client.updateRuleTree(PROPERTY_ID, '6', CONTRACT_ID, GROUP_ID, { rules: {} }))
        .to.be.rejectedWith('version must be an integer');
    });

    it('throws when ruleTree is not an object', async () => {
      await expect(client.updateRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'not-an-object'))
        .to.be.rejectedWith('ruleTree must be an object');
    });

    it('throws when ruleTree is null', async () => {
      await expect(client.updateRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, null))
        .to.be.rejectedWith('ruleTree must be an object');
    });

    it('rejects a ruleFormat that would inject into the Content-Type header', async () => {
      const evil = 'v2024-01-01\r\nX-Evil: 1';
      const attempt = client.updateRuleTree(
        PROPERTY_ID,
        6,
        CONTRACT_ID,
        GROUP_ID,
        { rules: {} },
        evil,
      );
      await expect(attempt)
        .to.be.rejectedWith('ruleFormat must contain only letters, digits, and hyphens');
    });
  });

  describe('patchRuleTree', () => {
    const OPS = [{ op: 'add', path: '/rules/children/-', value: { name: 'X' } }];

    it('sends the json-patch content-type, If-Match etag, and validateRules; returns body', async () => {
      nock(API_BASE)
        .matchHeader('content-type', 'application/json-patch+json')
        .matchHeader('if-match', 'etag123')
        .patch(`/papi/v1/properties/${PROPERTY_ID}/versions/6/rules`, OPS)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID, validateRules: 'true' })
        .reply(200, { errors: [], warnings: [{ detail: 'w' }] });

      const result = await client.patchRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, OPS, 'etag123');
      expect(result).to.deep.equal({ errors: [], warnings: [{ detail: 'w' }] });
    });

    it('adds dryRun=true and omits If-Match when no etag is given', async () => {
      // badheaders: nock refuses to match if the request sends If-Match, proving it is omitted.
      nock(API_BASE, { badheaders: ['if-match'] })
        .matchHeader('content-type', 'application/json-patch+json')
        .patch(`/papi/v1/properties/${PROPERTY_ID}/versions/6/rules`, OPS)
        .query({
          contractId: CONTRACT_ID, groupId: GROUP_ID, validateRules: 'true', dryRun: 'true',
        })
        .reply(200, { errors: [{ detail: 'e' }], warnings: [] });

      const result = await client.patchRuleTree(
        PROPERTY_ID,
        6,
        CONTRACT_ID,
        GROUP_ID,
        OPS,
        undefined,
        { dryRun: true },
      );
      expect(result.errors).to.deep.equal([{ detail: 'e' }]);
    });

    it('throws when version is not an integer', async () => {
      await expect(client.patchRuleTree(PROPERTY_ID, '6', CONTRACT_ID, GROUP_ID, OPS))
        .to.be.rejectedWith('version must be an integer');
    });

    it('throws when ops is not an array', async () => {
      await expect(client.patchRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, { op: 'add' }))
        .to.be.rejectedWith('ops must be an array of JSON Patch operations');
    });

    it('rejects an etag that would inject into the If-Match header', async () => {
      await expect(
        client.patchRuleTree(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, OPS, 'etag\r\nX-Evil: 1'),
      ).to.be.rejectedWith('etag must not contain whitespace or control characters');
    });
  });

  // ─── activation ─────────────────────────────────────────────────────────

  describe('activate', () => {
    it('activates with a default note and returns the activation link', async () => {
      nock(API_BASE)
        .post(
          `/papi/v1/properties/${PROPERTY_ID}/activations`,
          (body) => body.note === 'Activated via spacecat-shared-akamai-client'
            && body.network === 'STAGING'
            && body.acknowledgeAllWarnings === true
            && JSON.stringify(body.notifyEmails) === JSON.stringify(CREDS.notifyEmails),
        )
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(201, { activationLink: '/papi/v1/properties/prp_123/activations/atv_1' });

      const link = await client.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'staging');
      expect(link).to.equal('/papi/v1/properties/prp_123/activations/atv_1');
    });

    it('accepts a custom note', async () => {
      nock(API_BASE)
        .post(
          `/papi/v1/properties/${PROPERTY_ID}/activations`,
          (body) => body.note === 'custom note',
        )
        .query(true)
        .reply(201, { activationLink: '/link' });

      const link = await client.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'PRODUCTION', 'custom note');
      expect(link).to.equal('/link');
    });

    it('throws when version is not an integer', async () => {
      await expect(client.activate(PROPERTY_ID, '6', CONTRACT_ID, GROUP_ID, 'STAGING'))
        .to.be.rejectedWith('version must be an integer');
    });

    it('throws when network is missing', async () => {
      await expect(client.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, ''))
        .to.be.rejectedWith('network is required');
    });

    it('throws when network is not STAGING or PRODUCTION', async () => {
      await expect(client.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'sandbox'))
        .to.be.rejectedWith('network must be one of STAGING, PRODUCTION, got: sandbox');
    });

    it('throws when the client was constructed without notifyEmails', async () => {
      const c = new AkamaiClient({ ...CREDS, notifyEmails: undefined }, log);
      await expect(c.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'STAGING'))
        .to.be.rejectedWith(/notifyEmails/);
    });

    it('throws when the client was constructed with an empty notifyEmails array', async () => {
      const c = new AkamaiClient({ ...CREDS, notifyEmails: [] }, log);
      await expect(c.activate(PROPERTY_ID, 6, CONTRACT_ID, GROUP_ID, 'STAGING'))
        .to.be.rejectedWith(/notifyEmails/);
    });
  });

  describe('AkamaiClient.activationIdFromLink', () => {
    it('extracts the id from a link with a query string and trailing slash', () => {
      expect(AkamaiClient.activationIdFromLink('/papi/v1/properties/prp_1/activations/atv_9/?contractId=ctr_1'))
        .to.equal('atv_9');
    });

    it('returns an empty string for a falsy link', () => {
      expect(AkamaiClient.activationIdFromLink(undefined)).to.equal('');
    });
  });

  describe('getActivation', () => {
    it('returns the first matching activation item', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations/atv_1`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(200, { activations: { items: [{ activationId: 'atv_1', status: 'ACTIVE' }] } });

      const activation = await client.getActivation(PROPERTY_ID, 'atv_1', CONTRACT_ID, GROUP_ID);
      expect(activation).to.deep.equal({ activationId: 'atv_1', status: 'ACTIVE' });
    });

    it('returns undefined when there is no matching activation', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations/atv_1`)
        .query(true)
        .reply(200, {});

      const activation = await client.getActivation(PROPERTY_ID, 'atv_1', CONTRACT_ID, GROUP_ID);
      expect(activation).to.be.undefined;
    });
  });

  describe('listActivations', () => {
    it('returns all activations for the property', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query({ contractId: CONTRACT_ID, groupId: GROUP_ID })
        .reply(200, { activations: { items: [{ activationId: 'atv_1' }, { activationId: 'atv_2' }] } });

      const activations = await client.listActivations(PROPERTY_ID, CONTRACT_ID, GROUP_ID);
      expect(activations).to.have.lengthOf(2);
    });

    it('returns an empty array when activations are absent', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, {});

      const activations = await client.listActivations(PROPERTY_ID, CONTRACT_ID, GROUP_ID);
      expect(activations).to.deep.equal([]);
    });
  });

  describe('latestActivation', () => {
    it('throws when network is not STAGING or PRODUCTION', async () => {
      await expect(client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'sandbox'))
        .to.be.rejectedWith('network must be one of STAGING, PRODUCTION, got: sandbox');
    });

    it('returns undefined when the property was never activated on that network', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, { activations: { items: [{ network: 'STAGING', updateDate: '2026-01-01' }] } });

      const activation = await client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'PRODUCTION');
      expect(activation).to.be.undefined;
    });

    it('returns the most recently updated activation for the network (case-insensitive)', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, {
          activations: {
            items: [
              {
                network: 'STAGING', activationId: 'atv_old', updateDate: '2026-01-01T00:00:00Z',
              },
              {
                network: 'staging', activationId: 'atv_new', updateDate: '2026-02-01T00:00:00Z',
              },
              { network: 'PRODUCTION', activationId: 'atv_prod', updateDate: '2026-03-01T00:00:00Z' },
            ],
          },
        });

      const activation = await client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'STAGING');
      expect(activation.activationId).to.equal('atv_new');
    });

    it('falls back to submitDate when updateDate is absent', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, {
          activations: {
            items: [
              { network: 'STAGING', activationId: 'atv_a', submitDate: '2026-01-01T00:00:00Z' },
              { network: 'STAGING', activationId: 'atv_b', submitDate: '2026-05-01T00:00:00Z' },
            ],
          },
        });

      const activation = await client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'STAGING');
      expect(activation.activationId).to.equal('atv_b');
    });

    it('treats an activation with neither updateDate nor submitDate as sorting first', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, {
          activations: {
            items: [
              { network: 'STAGING', activationId: 'atv_undated' },
              { network: 'STAGING', activationId: 'atv_dated', updateDate: '2026-01-01T00:00:00Z' },
            ],
          },
        });

      const activation = await client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'STAGING');
      expect(activation.activationId).to.equal('atv_dated');
    });

    it('ignores activation entries with no network field', async () => {
      nock(API_BASE)
        .get(`/papi/v1/properties/${PROPERTY_ID}/activations`)
        .query(true)
        .reply(200, {
          activations: {
            items: [
              { activationId: 'atv_no_network', updateDate: '2026-01-01T00:00:00Z' },
              { network: 'STAGING', activationId: 'atv_staging', updateDate: '2026-02-01T00:00:00Z' },
            ],
          },
        });

      const activation = await client.latestActivation(PROPERTY_ID, CONTRACT_ID, GROUP_ID, 'STAGING');
      expect(activation.activationId).to.equal('atv_staging');
    });
  });

  // ─── normalizeDomain ────────────────────────────────────────────────────

  describe('normalizeDomain', () => {
    it('strips scheme, path, port, and a trailing dot', () => {
      expect(normalizeDomain('HTTPS://Example.com:8080/some/path.')).to.equal('example.com');
    });

    it('passes through an already-bare hostname', () => {
      expect(normalizeDomain('example.com')).to.equal('example.com');
    });

    it('strips a bare FQDN trailing dot with no scheme, port, or path', () => {
      expect(normalizeDomain('example.com.')).to.equal('example.com');
    });

    it('returns an empty string for a falsy input', () => {
      expect(normalizeDomain(undefined)).to.equal('');
    });
  });

  // ─── defaultRuleHasCaching ──────────────────────────────────────────────

  describe('defaultRuleHasCaching', () => {
    it('is true when the default rule has a caching behavior', () => {
      const tree = { rules: { behaviors: [{ name: 'origin' }, { name: 'caching' }] } };
      expect(defaultRuleHasCaching(tree)).to.be.true;
    });

    it('is false when the default rule has no caching behavior', () => {
      const tree = { rules: { behaviors: [{ name: 'origin' }] } };
      expect(defaultRuleHasCaching(tree)).to.be.false;
    });

    it('is false for a malformed or empty tree', () => {
      expect(defaultRuleHasCaching(null)).to.be.false;
      expect(defaultRuleHasCaching({})).to.be.false;
      expect(defaultRuleHasCaching({ rules: {} })).to.be.false;
    });
  });

  // ─── getDefaultOriginSsl ────────────────────────────────────────────────

  describe('getDefaultOriginSsl', () => {
    it('returns the default origin SSL verification settings', () => {
      const tree = {
        rules: {
          behaviors: [{
            name: 'origin',
            options: {
              verificationMode: 'CUSTOM',
              originCertsToHonor: 'STANDARD_CERTIFICATE_AUTHORITIES',
              standardCertificateAuthorities: ['akamai-permissive', 'THIRD_PARTY_AMAZON'],
            },
          }],
        },
      };
      expect(getDefaultOriginSsl(tree)).to.deep.equal({
        verificationMode: 'CUSTOM',
        originCertsToHonor: 'STANDARD_CERTIFICATE_AUTHORITIES',
        standardCertificateAuthorities: ['akamai-permissive', 'THIRD_PARTY_AMAZON'],
      });
    });

    it('returns null when there is no origin behavior or the tree is malformed', () => {
      expect(getDefaultOriginSsl({ rules: { behaviors: [{ name: 'caching' }] } })).to.be.null;
      expect(getDefaultOriginSsl(null)).to.be.null;
    });
  });
});
