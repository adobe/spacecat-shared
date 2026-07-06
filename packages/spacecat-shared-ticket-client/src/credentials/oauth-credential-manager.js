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

import { createHash } from 'node:crypto';

const TOKEN_EXPIRY_BUFFER_MS = 10 * 60 * 1000; // refresh 10 minutes before expiry
const SM_WRITE_ATTEMPTS = 3;
const SM_WRITE_BASE_DELAY_MS = 100;
const CONCURRENT_REFRESH_WAIT_MS = 200;
const SECRET_CACHE_TTL_MS = 30_000; // cache SM reads for 30 seconds

/**
 * Manages OAuth 2.0 access tokens stored in AWS Secrets Manager.
 *
 * ## Method responsibilities
 *
 * Each public method is self-contained — public methods do not call each other.
 * Private methods (#readSecret, #isExpired, #fetchNewTokens, #writeTokens,
 * #writeReauthFlag, #recoverFromRevokedGrant) are shared utilities only.
 *
 * Internal — not exposed via the public API.
 *
 * ## Rotating refresh tokens & concurrent refresh design
 *
 * Atlassian uses rotating refresh tokens with a 10-minute reuse window (leeway).
 * Within that window, the same refresh token can be exchanged multiple times —
 * each call returns a valid access token + a NEW refresh token. After the
 * 10-minute window, the original refresh token is invalidated and only the
 * latest refresh token remains valid (for 90 days of inactivity).
 * (Ref: https://developer.atlassian.com/cloud/jira/software/oauth-2-3lo-apps/#faq-rrt-config)
 *
 * Verified empirically: the same refresh token was exchanged 5 times within
 * 10 minutes — all calls returned 200. After 10 minutes, re-using the ORIGINAL
 * refresh token returns HTTP 403 {"error":"unauthorized_client"} — the same
 * response received when a user revokes the app. Derived tokens (obtained
 * within the window) retain their own independent 90-day TTL; in normal
 * operation SM holds the most recent derived token, not the original.
 *
 * ## Concurrent Lambda behaviour
 *
 * When two Lambdas refresh concurrently using the same token from SM:
 *
 *   Lambda A: refresh(RT) → 200 → { AT_A, RT_A } → writes RT_A to SM
 *   Lambda B: refresh(RT) → 200 → { AT_B, RT_B } → writes RT_B to SM (overwrites RT_A)
 *
 * Both succeed (10-minute reuse). Last writer wins in SM — RT_A is lost but
 * this is harmless: AT_A is in Lambda A's memory (valid 1 hour), and RT_B in
 * SM is valid for 90 days. No token is "consumed and lost" — both calls succeed.
 *
 * ## Grant failure scenarios
 *
 * Atlassian returns HTTP 403 for all refresh token failures. Two error codes observed:
 *
 *   Code               | Source          | Triggers GRANT_REVOKED?
 *   -------------------|-----------------|------------------------
 *   invalid_grant      | Official docs   | Yes — documented for expired/revoked tokens
 *   unauthorized_client| Empirical tests | Yes — observed for: token reused past 10-min window,
 *                      |                 |   app revoked by user/admin, malformed/truncated token,
 *                      |                 |   random string / empty token
 *
 * Official docs (developer.atlassian.com/cloud/oauth/getting-started/refresh-tokens/):
 *   403 {"error":"invalid_grant","error_description":"Unknown or invalid refresh token."}
 *   Returned when: password changed, token expired (90-day inactivity), token not rotated.
 *
 * Empirical tests returned 403 {"error":"unauthorized_client"} for:
 *   - Token reused past 10-minute window
 *   - App revoked by user/admin
 *   - Malformed / truncated token
 *   - Random string / empty token
 *
 * Both codes handled identically: GRANT_REVOKED → #recoverFromRevokedGrant → requiresReauth.
 *
 * ## Defensive guards (defense-in-depth, not correctness-critical)
 *
 * 1. In-process Promise locks (#refreshLock, #forceRefreshLock) — serialise
 *    concurrent same-Lambda calls so only one Atlassian request fires per
 *    Lambda invocation. Reduces redundant network calls and SM writes.
 * 2. Pre-read SM before calling Atlassian — if a concurrent Lambda already
 *    wrote new tokens, the caller exits early without calling Atlassian.
 * 3. #recoverFromRevokedGrant — re-reads SM (immediate + 200ms wait) on
 *    GRANT_REVOKED. Handles the rotation-race where Lambda A wins the
 *    Atlassian call and writes RT_new to SM; Lambda B gets GRANT_REVOKED
 *    (old token rotated), waits 200ms, finds Lambda A's fresh tokens in SM.
 *
 * ## App-level OAuth credentials
 *
 * client_id and client_secret are static per-provider secrets stored in HashiCorp
 * Vault and injected as Lambda env vars at deploy time. They are resolved lazily
 * inside #fetchNewTokens — callers that only read tokens do not need them set.
 */
export default class OAuthCredentialManager {
  // ── In-memory TTL cache for SM reads (default/read path only) ─────────────
  #secretCache = null;

  #cacheExpiresAt = 0;

  // ── In-process concurrency locks ──────────────────────────────────────────
  // Serialise concurrent same-Lambda calls so only one Atlassian request fires.
  // The Promise is stored while a refresh is in flight; cleared when it settles.
  #refreshLock = null;

  #forceRefreshLock = null;

  /**
   * @param {object} smClient - AWS Secrets Manager client
   * @param {string} secretPath - SM path for this connection's tokens
   * @param {object} httpClient - Fetch-compatible HTTP client (used for token refresh)
   * @param {object} log - Logger
   * @param {object} [options]
   * @param {string} [options.clientIdEnvVar='JIRA_OAUTH_CLIENT_ID']
   * @param {string} [options.clientSecretEnvVar='JIRA_OAUTH_CLIENT_SECRET']
   */
  constructor(smClient, secretPath, httpClient, log, {
    clientIdEnvVar = 'JIRA_OAUTH_CLIENT_ID',
    clientSecretEnvVar = 'JIRA_OAUTH_CLIENT_SECRET',
  } = {}) {
    this.smClient = smClient;
    this.secretPath = secretPath;
    this.httpClient = httpClient;
    this.log = log;
    this.clientIdEnvVar = clientIdEnvVar;
    this.clientSecretEnvVar = clientSecretEnvVar;
  }

  // ── Public methods ────────────────────────────────────────────────────────

  /**
   * Returns a valid Bearer header from the current SM state.
   * Pure read — no SM writes, no Atlassian calls.
   *
   * Throws with code TOKEN_REFRESH_REQUIRED when the token is expired so the
   * caller can return a 401 to the UI, which then triggers a refresh
   * before retrying.
   *
   * Throws with code REQUIRES_REAUTH when the connection is flagged for
   * re-authorization (refresh token revoked — user must reconnect).
   *
   * @returns {Promise<{Authorization: string}>}
   */
  async getAuthHeaders(bypassCache = false) {
    const secret = await this.#readSecret(bypassCache);

    if (secret.requiresReauth) {
      throw Object.assign(
        new Error('OAuth connection requires re-authorization'),
        { code: 'REQUIRES_REAUTH' },
      );
    }

    if (this.#isExpired(secret)) {
      throw Object.assign(
        new Error('OAuth token expired — caller should trigger a refresh'),
        { code: 'TOKEN_REFRESH_REQUIRED' },
      );
    }

    return { Authorization: `Bearer ${secret.accessToken}` };
  }

  /**
   * Proactively refreshes the token regardless of current expiry state.
   * Reads SM, calls Atlassian, writes new tokens back with retry.
   *
   * Pre-read optimisation: if another Lambda already refreshed and wrote new
   * tokens to SM, returns those without calling Atlassian. With the 10-minute
   * reuse window both calls would succeed anyway, but avoiding the redundant
   * Atlassian call reduces network overhead and SM write contention.
   *
   * In-process lock: concurrent same-Lambda callers (e.g. parallel createTicket
   * calls) share this Promise so only one Atlassian request is fired.
   *
   * Requires GET + PUT SM permission.
   *
   * @returns {Promise<{Authorization: string}>}
   */
  async refreshAuthHeaders() {
    if (this.#refreshLock) {
      return this.#refreshLock;
    }
    this.#refreshLock = this.#doRefreshAuthHeaders()
      .finally(() => { this.#refreshLock = null; });
    return this.#refreshLock;
  }

  async #doRefreshAuthHeaders() {
    const current = await this.#readSecret(true);

    // Pre-read exit: concurrent caller already refreshed — use their token.
    if (!this.#isExpired(current) && !current.requiresReauth) {
      return { Authorization: `Bearer ${current.accessToken}` };
    }

    let refreshed;
    try {
      refreshed = await this.#fetchNewTokens(current.refreshToken);
    } catch (err) {
      if (err.code === 'GRANT_REVOKED') {
        return this.#recoverFromRevokedGrant();
      }
      throw err;
    }

    try {
      await this.#writeTokens(refreshed);
    } catch (writeErr) {
      if (writeErr.code === 'SM_WRITE_FAILED') {
        // SM temporarily unavailable but Atlassian token is valid — return it.
        // Next request will need to re-refresh since SM still holds stale state.
        this.log.warn('Returning Atlassian token despite SM write failure — will re-refresh on next call');
        return { Authorization: `Bearer ${refreshed.access_token}` };
      }
      throw writeErr;
    }
    return { Authorization: `Bearer ${refreshed.access_token}` };
  }

  /**
   * Reactive refresh triggered by a 401 from the provider API.
   *
   * When usedAuthHeader is supplied: checks SM first. If SM already holds a
   * different, valid token (a concurrent Lambda refreshed while this one was
   * in-flight), that token is returned immediately — avoids a redundant
   * Atlassian call. Falls through to Atlassian only if SM still holds the
   * same rejected token.
   *
   * With the 10-minute reuse window, the Atlassian call will succeed even if
   * a concurrent Lambda already used the same refresh token — both get valid
   * tokens. The SM pre-read is an optimisation, not a correctness requirement.
   *
   * When called without usedAuthHeader: proceeds straight to Atlassian — covers
   * the case where the caller does not know which token was rejected.
   *
   * Requires GET + PUT SM permission.
   *
   * Concurrency note: concurrent callers share the in-flight Promise from the
   * first caller. The second caller's usedAuthHeader is not re-examined — all
   * callers receive the first caller's result. In practice this is correct:
   * concurrent batch-401 callers all hold the same rejected token.
   *
   * @param {string} [usedAuthHeader] - The Authorization header that the provider
   *   rejected (e.g. 'Bearer <old-token>'). Supplied when the caller knows
   *   which token was used; omitted when the rejected token is unknown.
   * @returns {Promise<{Authorization: string}>}
   */
  async forceRefreshAuthHeaders(usedAuthHeader = null) {
    // In-process lock: concurrent same-Lambda callers (e.g. parallel createTicket
    // calls all getting 401) share this Promise so only one Atlassian request fires.
    if (this.#forceRefreshLock) {
      return this.#forceRefreshLock;
    }
    this.#forceRefreshLock = this.#doForceRefreshAuthHeaders(usedAuthHeader)
      .finally(() => { this.#forceRefreshLock = null; });
    return this.#forceRefreshLock;
  }

  async #doForceRefreshAuthHeaders(usedAuthHeader) {
    // RFC 6750 §2.1: the Bearer scheme name is case-insensitive.
    // Trim + null-coalesce: "Bearer " (space-only) must not produce an empty usedToken
    // that would always differ from current.accessToken and trigger a false early-exit.
    const usedToken = usedAuthHeader
      ? (usedAuthHeader.replace(/^bearer\s+/i, '').trim() || null)
      : null;
    const current = await this.#readSecret(true);

    if (usedToken
      && current.accessToken !== usedToken
      && !this.#isExpired(current)
      && !current.requiresReauth) {
      this.log.debug('SM has a newer token — concurrent refresh already completed');
      return { Authorization: `Bearer ${current.accessToken}` };
    }

    let refreshed;
    try {
      refreshed = await this.#fetchNewTokens(current.refreshToken);
    } catch (err) {
      if (err.code === 'GRANT_REVOKED') {
        return this.#recoverFromRevokedGrant();
      }
      throw err;
    }

    try {
      await this.#writeTokens(refreshed);
    } catch (writeErr) {
      if (writeErr.code === 'SM_WRITE_FAILED') {
        // SM temporarily unavailable but Atlassian token is valid — return it.
        // Next request will need to re-refresh since SM still holds stale state.
        this.log.warn('Returning Atlassian token despite SM write failure — will re-refresh on next call');
        return { Authorization: `Bearer ${refreshed.access_token}` };
      }
      throw writeErr;
    }
    return { Authorization: `Bearer ${refreshed.access_token}` };
  }

  /**
   * Marks the connection as requiring re-authorization.
   * Writes requiresReauth: true to SM at this connection's secret path.
   *
   * Callers must also update the connection status to 'requires_reauth' in
   * PostgreSQL so the SM flag and DB status stay in sync.
   *
   * Requires GET + PUT SM permission.
   */
  async setRequiresReauth() {
    await this.#writeReauthFlag();
  }

  // ── Private utilities ──────────────────────────────────────────────────────

  async #readSecret(bypassCache = false) {
    if (!bypassCache && this.#secretCache !== null && Date.now() < this.#cacheExpiresAt) {
      return this.#secretCache;
    }
    const result = await this.smClient.getSecretValue({ SecretId: this.secretPath });
    let parsed;
    try {
      parsed = JSON.parse(result.SecretString);
    } catch (err) {
      throw new Error(`Malformed SM secret at ${this.secretPath}: ${err.message}`);
    }
    // Validate minimum structure — a corrupt or partially-written secret would
    // otherwise produce confusing errors downstream (e.g. 'Bearer undefined').
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`SM secret at ${this.secretPath} is not a JSON object`);
    }
    // Allow secrets flagged requiresReauth without a valid accessToken — admin tools
    // or provisioning flows may write { requiresReauth: true } as a minimal payload.
    // getAuthHeaders() checks requiresReauth before using accessToken, so this is safe.
    if (!parsed.requiresReauth
      && (typeof parsed.accessToken !== 'string' || !parsed.accessToken)) {
      throw new Error(`SM secret at ${this.secretPath} is missing a valid accessToken`);
    }
    this.#secretCache = parsed;
    this.#cacheExpiresAt = Date.now() + SECRET_CACHE_TTL_MS;
    return parsed;
  }

  #invalidateSecretCache() {
    this.#secretCache = null;
    this.#cacheExpiresAt = 0;
  }

  // eslint-disable-next-line class-methods-use-this
  #isExpired(secret) {
    // Treat non-finite expiresAt (undefined, null, NaN) as expired so callers
    // trigger a refresh rather than serving a token with unknown expiry.
    if (!Number.isFinite(secret.expiresAt)) {
      return true;
    }
    return Date.now() >= (secret.expiresAt - TOKEN_EXPIRY_BUFFER_MS);
  }

  /**
   * Calls the Atlassian token endpoint to exchange a refresh token for new tokens.
   * Resolves client credentials lazily from env vars — fails fast if missing so the
   * error surfaces at the point of use rather than at construction.
   */
  async #fetchNewTokens(refreshToken) {
    const clientId = process.env[this.clientIdEnvVar];
    const clientSecret = process.env[this.clientSecretEnvVar];

    if (!clientId || !clientSecret) {
      throw new Error(
        `${this.clientIdEnvVar} and ${this.clientSecretEnvVar} env vars are required for token refresh`,
      );
    }

    const response = await this.httpClient.fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'error',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      // Inspect error body to detect grant-level failures (revoked/expired refresh token).
      // Atlassian returns HTTP 403 for all grant failures. Two error codes are known:
      //   - "invalid_grant"      — documented in official Atlassian 3LO OAuth docs
      //                            (expired token, 90-day inactivity, token not rotated)
      //   - "unauthorized_client" — observed empirically in manual tests
      //                            (reused past 10-min window, revoked app, malformed token)
      // Both are treated as GRANT_REVOKED so callers check a semantic code, not raw HTTP status.
      let errorCode;
      try {
        const errorBody = await response.json();
        errorCode = errorBody?.error;
      /* c8 ignore next 3 */
      } catch {
        // ignore parse errors — error code remains undefined
      }
      const isGrantRevoked = errorCode === 'invalid_grant' || errorCode === 'unauthorized_client';
      throw Object.assign(
        new Error(`Atlassian token refresh failed: ${response.status}${errorCode ? ` (${errorCode})` : ''}`),
        { status: response.status, ...(isGrantRevoked && { code: 'GRANT_REVOKED' }) },
      );
    }

    const data = await response.json();

    // Validate required fields — a malformed 200 would silently corrupt SM.
    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Atlassian token response missing access_token');
    }
    if (!data.refresh_token || typeof data.refresh_token !== 'string') {
      throw new Error('Atlassian token response missing refresh_token');
    }
    if (typeof data.expires_in !== 'number' || data.expires_in <= 0) {
      throw new Error(`Atlassian token response has invalid expires_in: ${data.expires_in}`);
    }

    return data;
  }

  /**
   * Writes refreshed tokens to SM with up to SM_WRITE_ATTEMPTS retries and
   * exponential backoff. ClientRequestToken (SHA-256 of access_token) deduplicates
   * SM retries with the same payload — if attempt N actually wrote but the response
   * was lost, attempt N+1 returns success without a second write.
   *
   * On exhaustion: re-reads SM in case a concurrent caller wrote a valid token. If
   * SM is still expired, writes requiresReauth: true and throws.
   */
  async #writeTokens(refreshed) {
    this.#invalidateSecretCache();
    const idempotencyToken = createHash('sha256')
      .update(refreshed.access_token)
      .digest('hex')
      .slice(0, 64);

    const payload = {
      SecretId: this.secretPath,
      ClientRequestToken: idempotencyToken,
      SecretString: JSON.stringify({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
        tokenRefreshedAt: new Date().toISOString(),
        requiresReauth: false,
      }),
    };

    let lastErr;
    // eslint-disable-next-line no-plusplus
    for (let attempt = 0; attempt < SM_WRITE_ATTEMPTS; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.smClient.putSecretValue(payload);
        return;
      } catch (err) {
        lastErr = err;
        this.log.warn('SM putSecretValue failed', {
          attempt: attempt + 1,
          secretPath: this.secretPath,
        });
        if (attempt < SM_WRITE_ATTEMPTS - 1) {
          // eslint-disable-next-line no-promise-executor-return, no-await-in-loop
          await new Promise((resolve) => setTimeout(
            resolve,
            SM_WRITE_BASE_DELAY_MS * (2 ** attempt),
          ));
        }
      }
    }

    // All write attempts exhausted — check if a concurrent caller already wrote.
    this.log.debug('SM write exhausted, re-reading for concurrent writer', {
      secretPath: this.secretPath,
    });
    const reread = await this.#readSecret(true);
    if (!this.#isExpired(reread)) {
      return;
    }

    // SM writes failed but Atlassian successfully issued new tokens — the connection
    // is NOT broken. Escalating to requiresReauth here would be wrong: the failure is
    // transient SM infrastructure, not an invalid grant.
    this.log.error('Token refresh: SM write exhausted, token obtained but not persisted', {
      error: lastErr?.message,
      secretPath: this.secretPath,
    });
    throw Object.assign(
      new Error('OAuth SM write failed — token obtained but not persisted'),
      { code: 'SM_WRITE_FAILED' },
    );
  }

  /**
   * Recovery path when #fetchNewTokens throws with code GRANT_REVOKED.
   *
   * Handles two cases:
   *
   * 1. Rotation race (forceRefreshAuthHeaders): Lambda A wins the Atlassian call,
   *    rotates the refresh token, writes RT_new to SM. Lambda B called 50ms later
   *    with the same old token → GRANT_REVOKED (already rotated). The 200ms wait
   *    gives Lambda A time to write RT_new; Lambda B then finds it and uses it.
   *    Connection is healthy — no requiresReauth needed.
   *
   * 2. Genuinely dead grant (token >10 min / app revoked / expired / password change):
   *    Both SM re-reads return stale/expired → no recovery → requiresReauth written.
   *    Both scenarios return identical HTTP 403 unauthorized_client from Atlassian.
   */
  async #recoverFromRevokedGrant() {
    const raceCheck = await this.#readSecret(true);
    if (!this.#isExpired(raceCheck) && !raceCheck.requiresReauth) {
      this.log.debug('GRANT_REVOKED — concurrent caller already refreshed, using their token');
      return { Authorization: `Bearer ${raceCheck.accessToken}` };
    }

    // 200ms wait: gives a concurrent Lambda that won the rotation race time to write
    // its fresh tokens to SM before we conclude the grant is genuinely dead.
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, CONCURRENT_REFRESH_WAIT_MS));
    const finalCheck = await this.#readSecret(true);
    if (!this.#isExpired(finalCheck) && !finalCheck.requiresReauth) {
      this.log.debug('Concurrent refresh completed during wait — using their token');
      return { Authorization: `Bearer ${finalCheck.accessToken}` };
    }

    this.log.error('GRANT_REVOKED — refresh token expired or app revoked, marking requiresReauth');
    await this.#writeReauthFlag();
    throw new Error('OAuth token refresh failed — connection requires re-authorization');
  }

  /**
   * Writes requiresReauth: true to SM with up to SM_WRITE_ATTEMPTS retries and
   * exponential backoff. Used internally by #writeTokens, #recoverFromRevokedGrant,
   * and setRequiresReauth. Reauth writes are naturally idempotent (always writing true)
   * so no ClientRequestToken is needed.
   */
  async #writeReauthFlag() {
    this.#invalidateSecretCache();
    let lastErr;
    // eslint-disable-next-line no-plusplus
    for (let attempt = 0; attempt < SM_WRITE_ATTEMPTS; attempt++) {
      try {
        // Re-read on every attempt: a concurrent writer between retries could have written
        // new valid tokens — merging requiresReauth: true onto the freshest snapshot avoids
        // clobbering their tokens with a stale read-modify-write.
        // eslint-disable-next-line no-await-in-loop
        const secret = await this.#readSecret(true);
        // If a concurrent Lambda wrote valid tokens since our last check, do NOT
        // clobber them with requiresReauth: true — the connection is healthy.
        if (!this.#isExpired(secret) && !secret.requiresReauth) {
          this.log.debug('Concurrent refresh landed fresh tokens — skipping reauth flag write');
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        await this.smClient.putSecretValue({
          SecretId: this.secretPath,
          SecretString: JSON.stringify({ ...secret, requiresReauth: true }),
        });
        return;
      } catch (err) {
        lastErr = err;
        this.log.warn('SM putSecretValue (reauth flag) failed', {
          attempt: attempt + 1,
          secretPath: this.secretPath,
        });
        if (attempt < SM_WRITE_ATTEMPTS - 1) {
          // eslint-disable-next-line no-promise-executor-return, no-await-in-loop
          await new Promise((resolve) => setTimeout(
            resolve,
            SM_WRITE_BASE_DELAY_MS * (2 ** attempt),
          ));
        }
      }
    }

    throw Object.assign(
      new Error(`Failed to write requiresReauth flag to SM after ${SM_WRITE_ATTEMPTS} attempts`),
      { cause: lastErr },
    );
  }
}
