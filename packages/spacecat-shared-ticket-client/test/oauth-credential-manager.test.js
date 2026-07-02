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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import OAuthCredentialManager from '../src/credentials/oauth-credential-manager.js';

use(chaiAsPromised);

// App-level OAuth credentials injected from HashiCorp Vault as env vars
const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';

function setAppCredentials() {
  process.env.JIRA_OAUTH_CLIENT_ID = TEST_CLIENT_ID;
  process.env.JIRA_OAUTH_CLIENT_SECRET = TEST_CLIENT_SECRET;
}

function clearAppCredentials() {
  delete process.env.JIRA_OAUTH_CLIENT_ID;
  delete process.env.JIRA_OAUTH_CLIENT_SECRET;
}

const VALID_SECRET = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
  expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  requiresReauth: false,
};

const EXPIRED_SECRET = {
  ...VALID_SECRET,
  expiresAt: Date.now() - 1000, // already expired
};

function makeSmClient(secret = VALID_SECRET) {
  return {
    getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(secret) }),
    putSecretValue: sinon.stub().resolves({}),
  };
}

function makeHttpClient(responseBody, status = 200) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: sinon.stub().resolves(responseBody),
  };
  return { fetch: sinon.stub().resolves(response) };
}

function makeLog() {
  return {
    info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
  };
}

describe('OAuthCredentialManager', () => {
  afterEach(() => clearAppCredentials());

  describe('constructor', () => {
    it('constructs without throwing even when env vars are missing (lazy resolution)', () => {
      clearAppCredentials();
      expect(() => new OAuthCredentialManager(
        makeSmClient(),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      )).not.to.throw();
    });

    it('accepts custom env var names via options', () => {
      clearAppCredentials();
      expect(() => new OAuthCredentialManager(
        makeSmClient(),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
        { clientIdEnvVar: 'CUSTOM_CLIENT_ID', clientSecretEnvVar: 'CUSTOM_CLIENT_SECRET' },
      )).not.to.throw();
    });
  });

  describe('getAuthHeaders', () => {
    beforeEach(() => setAppCredentials());

    it('returns Bearer header when token is valid', async () => {
      const manager = new OAuthCredentialManager(
        makeSmClient(VALID_SECRET),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      );
      const headers = await manager.getAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer access-token-abc' });
    });

    it('throws REQUIRES_REAUTH when requiresReauth flag is set — no Atlassian call', async () => {
      const reauthSecret = { ...VALID_SECRET, requiresReauth: true };
      const httpClient = makeHttpClient({});
      const manager = new OAuthCredentialManager(
        makeSmClient(reauthSecret),
        '/test/secret',
        httpClient,
        makeLog(),
      );
      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('REQUIRES_REAUTH');
      expect(err.message).to.equal('OAuth connection requires re-authorization');
      expect(httpClient.fetch.called).to.be.false;
    });

    it('throws REQUIRES_REAUTH for secret with requiresReauth but no accessToken', async () => {
      // Admin/provisioning tool writes { requiresReauth: true } without accessToken
      const minimalReauth = { requiresReauth: true };
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(minimalReauth) }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('REQUIRES_REAUTH');
    });

    it('throws TOKEN_REFRESH_REQUIRED when token is expired — no Atlassian call', async () => {
      const httpClient = makeHttpClient({});
      const manager = new OAuthCredentialManager(
        makeSmClient(EXPIRED_SECRET),
        '/test/secret',
        httpClient,
        makeLog(),
      );
      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('TOKEN_REFRESH_REQUIRED');
      expect(err.message).to.include('OAuth token expired');
      expect(httpClient.fetch.called).to.be.false;
    });

    it('throws with context when SM secret is malformed JSON', async () => {
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: 'not-valid-json{{{' }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await expect(manager.getAuthHeaders()).to.be.rejectedWith(
        'Malformed SM secret at /test/secret',
      );
    });

    it('throws when SM secret is missing accessToken', async () => {
      const noTokenSecret = { refreshToken: 'rt', expiresAt: Date.now() + 3600_000 };
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(noTokenSecret) }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await expect(manager.getAuthHeaders()).to.be.rejectedWith(
        'SM secret at /test/secret is missing a valid accessToken',
      );
    });

    it('throws when SM secret is not a JSON object', async () => {
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: '"just-a-string"' }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await expect(manager.getAuthHeaders()).to.be.rejectedWith(
        'SM secret at /test/secret is not a JSON object',
      );
    });

    it('treats missing expiresAt as expired — throws TOKEN_REFRESH_REQUIRED', async () => {
      const noExpirySecret = { ...VALID_SECRET, expiresAt: undefined };
      const manager = new OAuthCredentialManager(
        makeSmClient(noExpirySecret),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      );
      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('TOKEN_REFRESH_REQUIRED');
    });

    it('treats NaN expiresAt as expired — throws TOKEN_REFRESH_REQUIRED', async () => {
      const nanExpirySecret = { ...VALID_SECRET, expiresAt: NaN };
      const manager = new OAuthCredentialManager(
        makeSmClient(nanExpirySecret),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      );
      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('TOKEN_REFRESH_REQUIRED');
    });

    it('treats null expiresAt as expired — throws TOKEN_REFRESH_REQUIRED', async () => {
      const nullExpirySecret = { ...VALID_SECRET, expiresAt: null };
      const manager = new OAuthCredentialManager(
        makeSmClient(nullExpirySecret),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      );
      const err = await manager.getAuthHeaders().catch((e) => e);
      expect(err.code).to.equal('TOKEN_REFRESH_REQUIRED');
    });

    it('reads SM only once across 3 sequential getAuthHeaders calls (cache hit)', async () => {
      const smClient = makeSmClient(VALID_SECRET);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await manager.getAuthHeaders();
      await manager.getAuthHeaders();
      await manager.getAuthHeaders();

      expect(smClient.getSecretValue.callCount).to.equal(1);
    });

    it('bypasses TTL cache when bypassCache=true — reads SM even within the cache window', async () => {
      const smClient = makeSmClient(VALID_SECRET);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      // First call — populates cache
      await manager.getAuthHeaders();
      expect(smClient.getSecretValue.callCount).to.equal(1);

      // Second call within TTL — normally served from cache (no SM call)
      await manager.getAuthHeaders();
      expect(smClient.getSecretValue.callCount).to.equal(1);

      // Third call with bypassCache=true — forces SM re-read despite live cache
      await manager.getAuthHeaders(true);
      expect(smClient.getSecretValue.callCount).to.equal(2);
    });

    it('re-reads SM after a write path (refreshAuthHeaders) invalidates the cache', async () => {
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall()
          .resolves({ SecretString: JSON.stringify(VALID_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(VALID_SECRET) }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({
        access_token: 'refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      // First getAuthHeaders — populates cache (SM call #1)
      await manager.getAuthHeaders();
      expect(smClient.getSecretValue.callCount).to.equal(1);

      // refreshAuthHeaders — write path, must bypass and then invalidate cache (SM call #2)
      await manager.refreshAuthHeaders();

      // Second getAuthHeaders after cache invalidation — must re-read SM (SM call #3)
      await manager.getAuthHeaders();
      expect(smClient.getSecretValue.callCount).to.equal(3);
    });
  });

  describe('refreshAuthHeaders', () => {
    let clock;
    beforeEach(() => setAppCredentials());
    afterEach(() => {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });

    it('exits early when SM already has a fresh valid token (concurrent Lambda beat us to it)', async () => {
      const smClient = makeSmClient(VALID_SECRET);
      const httpClient = makeHttpClient({});
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer access-token-abc' });
      expect(httpClient.fetch.called).to.be.false;
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('calls Atlassian when token is expired and returns new Bearer header', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer new-access-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
      expect(smClient.putSecretValue.calledOnce).to.be.true;
    });

    it('calls Atlassian even when requiresReauth is set (auth-service clearing revoked state)', async () => {
      const reauthSecret = { ...VALID_SECRET, requiresReauth: true };
      const smClient = makeSmClient(reauthSecret);
      const httpClient = makeHttpClient({
        access_token: 'reauthed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer reauthed-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.false;
    });

    it('sends client_id, client_secret, grant_type, and refresh_token in Atlassian request', async () => {
      const httpClient = makeHttpClient({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(
        makeSmClient(EXPIRED_SECRET),
        '/test/secret',
        httpClient,
        makeLog(),
      );

      await manager.refreshAuthHeaders();

      const [, fetchOptions] = httpClient.fetch.firstCall.args;
      const body = JSON.parse(fetchOptions.body);
      expect(body.client_id).to.equal(TEST_CLIENT_ID);
      expect(body.client_secret).to.equal(TEST_CLIENT_SECRET);
      expect(body.grant_type).to.equal('refresh_token');
      expect(body.refresh_token).to.equal(EXPIRED_SECRET.refreshToken);
    });

    it('throws at refresh time (not construction) when env vars are missing', async () => {
      clearAppCredentials();
      const manager = new OAuthCredentialManager(
        makeSmClient(EXPIRED_SECRET),
        '/test/secret',
        makeHttpClient({}),
        makeLog(),
      );
      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'JIRA_OAUTH_CLIENT_ID and JIRA_OAUTH_CLIENT_SECRET env vars are required',
      );
    });

    it('SM ClientRequestToken is a 64-char lowercase hex SHA-256 of the access_token', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await manager.refreshAuthHeaders();

      const { ClientRequestToken } = smClient.putSecretValue.firstCall.args[0];
      expect(ClientRequestToken).to.match(/^[0-9a-f]{64}$/);
    });

    it('SM write succeeds on 2nd attempt — returns new token, no requiresReauth', async () => {
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }),
        putSecretValue: sinon.stub()
          .onFirstCall().rejects(new Error('SM throttle'))
          .onSecondCall()
          .resolves({}),
      };
      const httpClient = makeHttpClient({
        access_token: 'retry-success-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer retry-success-token' });
      expect(smClient.putSecretValue.callCount).to.equal(2);
    });

    it('SM write succeeds on 3rd attempt — returns new token', async () => {
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }),
        putSecretValue: sinon.stub()
          .onFirstCall().rejects(new Error('SM error 1'))
          .onSecondCall()
          .rejects(new Error('SM error 2'))
          .onCall(2)
          .resolves({}),
      };
      const httpClient = makeHttpClient({
        access_token: 'third-try-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer third-try-token' });
      expect(smClient.putSecretValue.callCount).to.equal(3);
    });

    it('SM write all 3 attempts fail — re-read shows valid (concurrent writer) — returns Atlassian token', async () => {
      const freshSecret = { ...VALID_SECRET, accessToken: 'concurrent-token' };
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(freshSecret) }),
        putSecretValue: sinon.stub().rejects(new Error('SM write error')),
      };
      const httpClient = makeHttpClient({
        access_token: 'our-atlassian-token',
        refresh_token: 'our-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      // Returns our Atlassian-fetched token (both are valid; we already have it)
      expect(headers).to.deep.equal({ Authorization: 'Bearer our-atlassian-token' });
      expect(smClient.putSecretValue.callCount).to.equal(3);
      // No requiresReauth written — concurrent writer saved us
      const putCalls = smClient.putSecretValue.args.map((args) => JSON.parse(args[0].SecretString));
      expect(putCalls.every((p) => !p.requiresReauth)).to.be.true;
    });

    it('re-throws non-SM_WRITE_FAILED errors from writeTokens — SM read failure during exhaustion re-read', async () => {
      // Scenario: all 3 writes fail, then the re-read inside #writeTokens throws unexpectedly.
      // That non-SM_WRITE_FAILED error must propagate out of refreshAuthHeaders unchanged.
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .rejects(new Error('SM read error during re-read')),
        putSecretValue: sinon.stub().rejects(new Error('SM write error')),
      };
      const httpClient = makeHttpClient({
        access_token: 'valid-atlassian-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith('SM read error during re-read');
    });

    it('SM write all 3 fail and re-read still expired — returns Atlassian token without writing requiresReauth (token is valid)', async () => {
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }), // re-read after exhaustion
        putSecretValue: sinon.stub().rejects(new Error('SM write error')),
      };
      const httpClient = makeHttpClient({
        access_token: 'valid-atlassian-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      // Should NOT throw — should return the valid Atlassian token
      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer valid-atlassian-token' });
      // Must NOT write requiresReauth — SM failure ≠ Atlassian failure
      const putCalls = smClient.putSecretValue.args.map((args) => JSON.parse(args[0].SecretString));
      expect(putCalls.every((p) => !p.requiresReauth)).to.be.true;
    });

    it('Atlassian 403 unauthorized_client — immediate race-check re-read is fresh — returns concurrent token', async () => {
      const freshSecret = { ...VALID_SECRET, accessToken: 'concurrent-winner-token' };
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(freshSecret) }), // race-check
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({ error: 'unauthorized_client' }, 403);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer concurrent-winner-token' });
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('Atlassian 403 unauthorized_client — race-check expired, 200ms re-read fresh — returns delayed winner token', async () => {
      // Only fake setTimeout — preserve Date.now() so #isExpired() still works correctly.
      clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
      const freshSecret = { ...VALID_SECRET, accessToken: 'delayed-winner-token' };
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // race-check miss
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(freshSecret) }), // 200ms re-read hit
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({ error: 'unauthorized_client' }, 403);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const promise = manager.refreshAuthHeaders();
      await clock.tickAsync(200);
      const headers = await promise;
      expect(headers).to.deep.equal({ Authorization: 'Bearer delayed-winner-token' });
      expect(smClient.putSecretValue.called).to.be.false;
      expect(smClient.getSecretValue.callCount).to.equal(3);
    });

    it('Atlassian 403 unauthorized_client — both race-check and final-check expired — writes requiresReauth and throws', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // race-check
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // final-check
          .onCall(3)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }), // #writeReauthFlag read
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({ error: 'unauthorized_client' }, 403);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const promise = manager.refreshAuthHeaders();
      await clock.tickAsync(200);
      await expect(promise).to.be.rejectedWith(
        'OAuth token refresh failed — connection requires re-authorization',
      );
      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('Atlassian 403 unauthorized_client — race-check shows requiresReauth flag — writes reauth and throws', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
      const reauthSecret = { ...EXPIRED_SECRET, requiresReauth: true };
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(reauthSecret) }) // race-check
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(reauthSecret) }) // final-check
          .onCall(3)
          .resolves({ SecretString: JSON.stringify(reauthSecret) }), // #writeReauthFlag read
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({ error: 'unauthorized_client' }, 403);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const promise = manager.refreshAuthHeaders();
      await clock.tickAsync(200);
      await expect(promise).to.be.rejectedWith(
        'OAuth token refresh failed — connection requires re-authorization',
      );
      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('Atlassian 400 invalid_grant — treated as revoked refresh token — triggers reauth recovery', async () => {
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // race-check
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // final-check
          .onCall(3)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }), // #writeReauthFlag read
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = {
        fetch: sinon.stub().resolves({
          ok: false,
          status: 400,
          json: sinon.stub()
            .resolves({ error: 'invalid_grant', error_description: 'refresh token revoked' }),
        }),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'OAuth token refresh failed — connection requires re-authorization',
      );
      // requiresReauth must be written
      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('Atlassian 403 unauthorized_client — expired reuse window or revoked app — triggers reauth recovery', async () => {
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // race-check
          .onCall(2)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }) // final-check
          .onCall(3)
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }), // #writeReauthFlag read
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = {
        fetch: sinon.stub().resolves({
          ok: false,
          status: 403,
          json: sinon.stub()
            .resolves({ error: 'unauthorized_client', error_description: 'refresh_token is invalid' }),
        }),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'OAuth token refresh failed — connection requires re-authorization',
      );
      // requiresReauth must be written to SM
      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('Atlassian 400 invalid_client — propagates as non-reauth error', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = {
        fetch: sinon.stub().resolves({
          ok: false,
          status: 400,
          json: sinon.stub().resolves({ error: 'invalid_client' }),
        }),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith('Atlassian token refresh failed: 400');
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('propagates non-401 Atlassian errors without writing requiresReauth', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({}, 503);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token refresh failed: 503',
      );
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('throws when Atlassian response is missing access_token', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({ refresh_token: 'r', expires_in: 3600 });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token response missing access_token',
      );
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('throws when Atlassian response is missing refresh_token', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({ access_token: 'a', expires_in: 3600 });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token response missing refresh_token',
      );
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('throws when Atlassian response has expires_in of 0 (would cause immediate expiry loop)', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({ access_token: 'a', refresh_token: 'r', expires_in: 0 });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token response has invalid expires_in: 0',
      );
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('throws when Atlassian response has negative expires_in', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({ access_token: 'a', refresh_token: 'r', expires_in: -1 });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token response has invalid expires_in: -1',
      );
    });

    it('deduplicates concurrent calls — only one Atlassian request fires', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'new-concurrent-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      // Start both before either resolves — JS single-thread ensures lock acquired by p1
      const p1 = manager.refreshAuthHeaders();
      const p2 = manager.refreshAuthHeaders();

      const [h1, h2] = await Promise.all([p1, p2]);

      expect(h1).to.deep.equal({ Authorization: 'Bearer new-concurrent-token' });
      expect(h2).to.deep.equal({ Authorization: 'Bearer new-concurrent-token' });
      // Single-use refresh token must not be double-consumed
      expect(httpClient.fetch.callCount).to.equal(1);
    });

    it('releases the lock after rejection so the next call fires a fresh request', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      // First Atlassian call → 503 (transient error); second call → success
      const fetchStub = sinon.stub();
      fetchStub.onFirstCall().resolves({
        ok: false,
        status: 503,
        json: sinon.stub().resolves({}),
      });
      fetchStub.onSecondCall().resolves({
        ok: true,
        status: 200,
        json: sinon.stub().resolves({
          access_token: 'recovered-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', { fetch: fetchStub }, makeLog());

      // First call fails — lock must be cleared by .finally()
      await expect(manager.refreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token refresh failed: 503',
      );

      // Second call after rejection — lock cleared, fires a fresh Atlassian request
      const headers = await manager.refreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer recovered-token' });
      expect(fetchStub.callCount).to.equal(2);
    });
  });

  describe('forceRefreshAuthHeaders', () => {
    beforeEach(() => setAppCredentials());

    it('calls Atlassian when no usedAuthHeader provided — even if SM token is valid', async () => {
      // No usedAuthHeader → usedToken is null → guard condition always false → calls Atlassian.
      // Preserves mid-window revocation behaviour for callers that don't have the old header.
      const smClient = makeSmClient(VALID_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'force-refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer force-refreshed-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
      expect(httpClient.fetch.firstCall.args[0]).to.equal('https://auth.atlassian.com/oauth/token');
    });

    it('calls Atlassian when no usedAuthHeader provided and token is expired', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'force-refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer force-refreshed-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
    });

    it('treats "Bearer " (space-only, no token) as null usedToken — proceeds to Atlassian', async () => {
      // Edge case: malformed header "Bearer " yields empty string after strip.
      // Must NOT trigger the early-exit "SM has a newer token" path.
      const smClient = makeSmClient(VALID_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders('Bearer ');
      expect(headers).to.deep.equal({ Authorization: 'Bearer refreshed-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
    });

    it('uses SM token without calling Atlassian when SM has a different valid token (concurrent refresh won)', async () => {
      // Lambda A held token_v1, Lambda B refreshed → SM now has token_v2.
      // Lambda A gets Jira 401 and calls forceRefreshAuthHeaders('Bearer access-token-abc').
      // SM token differs from rejected token and is valid → use it, no Atlassian call.
      const freshSecret = { ...VALID_SECRET, accessToken: 'concurrent-refresh-token' };
      const smClient = makeSmClient(freshSecret);
      const httpClient = makeHttpClient({
        access_token: 'unnecessary-token',
        refresh_token: 'unnecessary-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders('Bearer access-token-abc');
      expect(headers).to.deep.equal({ Authorization: 'Bearer concurrent-refresh-token' });
      expect(httpClient.fetch.called).to.be.false;
    });

    it('calls Atlassian when SM has the same token that was rejected (admin revoke or no concurrent refresh)', async () => {
      // SM still holds the same non-expired token that Jira rejected — must call Atlassian.
      const smClient = makeSmClient(VALID_SECRET); // VALID_SECRET.accessToken = 'access-token-abc'
      const httpClient = makeHttpClient({
        access_token: 'revocation-recovered-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders(`Bearer ${VALID_SECRET.accessToken}`);
      expect(headers).to.deep.equal({ Authorization: 'Bearer revocation-recovered-token' });
      expect(httpClient.fetch.calledOnce).to.be.true;
    });

    it('calls Atlassian when SM token matches rejected token and is expired', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'new-token-after-expiry',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders(`Bearer ${EXPIRED_SECRET.accessToken}`);
      expect(headers).to.deep.equal({ Authorization: 'Bearer new-token-after-expiry' });
      expect(httpClient.fetch.calledOnce).to.be.true;
    });

    it('Atlassian 403 unauthorized_client — race-check finds fresh token — returns it without requiresReauth', async () => {
      const freshSecret = { ...VALID_SECRET, accessToken: 'race-won-token' };
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(freshSecret) }), // race-check
        putSecretValue: sinon.stub().resolves({}),
      };
      const httpClient = makeHttpClient({ error: 'unauthorized_client' }, 403);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer race-won-token' });
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('propagates non-401 Atlassian errors without writing requiresReauth', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({}, 503);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.forceRefreshAuthHeaders()).to.be.rejectedWith(
        'Atlassian token refresh failed: 503',
      );
      expect(smClient.putSecretValue.called).to.be.false;
    });

    it('treats lowercase "bearer " prefix as identical token (RFC 6750 case-insensitive)', async () => {
      // Header "bearer access-token-abc" should match VALID_SECRET.accessToken —
      // if replace() was case-sensitive, "bearer" != "Bearer" → strip fails →
      // usedToken = "bearer access-token-abc" ≠ "access-token-abc" → guard passes → no Atlassian
      const freshSecret = { ...VALID_SECRET, accessToken: 'concurrent-refresh-token' };
      const smClient = makeSmClient(freshSecret);
      const httpClient = makeHttpClient({
        access_token: 'unnecessary-token',
        refresh_token: 'r',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      // freshSecret.accessToken differs from the passed 'access-token-abc' — concurrent refresh.
      const headers = await manager.forceRefreshAuthHeaders('bearer access-token-abc');
      expect(headers).to.deep.equal({ Authorization: 'Bearer concurrent-refresh-token' });
      expect(httpClient.fetch.called).to.be.false;
    });

    it('re-throws non-SM_WRITE_FAILED errors from writeTokens — SM read failure during exhaustion re-read', async () => {
      // Scenario: all 3 writes fail, then the re-read inside #writeTokens throws unexpectedly.
      // That non-SM_WRITE_FAILED error must propagate out of forceRefreshAuthHeaders unchanged.
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .rejects(new Error('SM read error during re-read')),
        putSecretValue: sinon.stub().rejects(new Error('SM write error')),
      };
      const httpClient = makeHttpClient({
        access_token: 'force-refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      await expect(manager.forceRefreshAuthHeaders()).to.be.rejectedWith('SM read error during re-read');
    });

    it('SM write all 3 fail and re-read still expired — forceRefresh returns Atlassian token without reauth', async () => {
      const smClient = {
        getSecretValue: sinon.stub()
          .onFirstCall().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) })
          .onSecondCall()
          .resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }),
        putSecretValue: sinon.stub().rejects(new Error('SM write error')),
      };
      const httpClient = makeHttpClient({
        access_token: 'force-refreshed-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      const headers = await manager.forceRefreshAuthHeaders();
      expect(headers).to.deep.equal({ Authorization: 'Bearer force-refreshed-token' });
      const putCalls = smClient.putSecretValue.args.map((args) => JSON.parse(args[0].SecretString));
      expect(putCalls.every((p) => !p.requiresReauth)).to.be.true;
    });

    it('deduplicates concurrent calls — only one Atlassian request fires', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const httpClient = makeHttpClient({
        access_token: 'force-concurrent-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });
      const manager = new OAuthCredentialManager(smClient, '/test/secret', httpClient, makeLog());

      // Both callers use the same rejected token — typical batch-401 scenario
      const p1 = manager.forceRefreshAuthHeaders('Bearer stale-token');
      const p2 = manager.forceRefreshAuthHeaders('Bearer stale-token');

      const [h1, h2] = await Promise.all([p1, p2]);

      expect(h1).to.deep.equal({ Authorization: 'Bearer force-concurrent-token' });
      expect(h2).to.deep.equal({ Authorization: 'Bearer force-concurrent-token' });
      // Single-use refresh token must not be double-consumed
      expect(httpClient.fetch.callCount).to.equal(1);
    });
  });

  describe('setRequiresReauth', () => {
    let clock;
    beforeEach(() => setAppCredentials());
    afterEach(() => {
      if (clock) {
        clock.restore();
        clock = null;
      }
    });

    it('writes requiresReauth: true to SM when token is expired', async () => {
      const smClient = makeSmClient(EXPIRED_SECRET);
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await manager.setRequiresReauth();

      const written = JSON.parse(smClient.putSecretValue.firstCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('retries SM write on transient failure and succeeds on second attempt', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }),
        putSecretValue: sinon.stub()
          .onFirstCall().rejects(new Error('transient SM error'))
          .onSecondCall()
          .resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      const promise = manager.setRequiresReauth();
      await clock.tickAsync(200);
      await promise;

      expect(smClient.putSecretValue.callCount).to.equal(2);
      const written = JSON.parse(smClient.putSecretValue.secondCall.args[0].SecretString);
      expect(written.requiresReauth).to.be.true;
    });

    it('skips reauth flag write when concurrent Lambda wrote fresh tokens', async () => {
      // SM returns fresh (non-expired) tokens on re-read inside #writeReauthFlag —
      // a concurrent Lambda refreshed successfully. Do NOT clobber with requiresReauth.
      const freshSecret = { ...VALID_SECRET, expiresAt: Date.now() + 3600_000 };
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(freshSecret) }),
        putSecretValue: sinon.stub().resolves({}),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      await manager.setRequiresReauth();

      // putSecretValue must NOT be called — fresh tokens detected, write skipped
      expect(smClient.putSecretValue.callCount).to.equal(0);
    });

    it('throws after exhausting all SM write attempts', async () => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout'] });
      const smClient = {
        getSecretValue: sinon.stub().resolves({ SecretString: JSON.stringify(EXPIRED_SECRET) }),
        putSecretValue: sinon.stub().rejects(new Error('persistent SM error')),
      };
      const manager = new OAuthCredentialManager(smClient, '/test/secret', makeHttpClient({}), makeLog());

      const promise = manager.setRequiresReauth();
      // Total backoff: SM_WRITE_BASE_DELAY_MS * (2^0 + 2^1) = 100 + 200 = 300ms
      await clock.tickAsync(300);
      await expect(promise).to.be.rejectedWith('Failed to write requiresReauth flag to SM after 3 attempts');
      expect(smClient.putSecretValue.callCount).to.equal(3);
    });
  });
});
