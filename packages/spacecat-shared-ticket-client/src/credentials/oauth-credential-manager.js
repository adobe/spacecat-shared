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

/**
 * Manages OAuth 2.0 access tokens stored in AWS Secrets Manager.
 *
 * ## Method responsibilities
 *
 * Each public method is self-contained — public methods do not call each other.
 * Private methods (#readSecret, #isExpired, #fetchNewTokens, #writeTokens,
 * #writeReauthFlag, #recoverFromAtlassian401) are shared utilities only.
 *
 * Internal — not exposed via the public API.
 *
 * ## Concurrent refresh design
 *
 * Atlassian uses rotating refresh tokens (single-use). If two concurrent callers
 * both see an expired token, the second caller's refresh token is already consumed
 * by the first → Atlassian returns 401 → without mitigation this would mark a
 * working connection as requires_reauth.
 *
 * Mitigation: refreshAuthHeaders and forceRefreshAuthHeaders re-read SM immediately
 * before calling Atlassian. This collapses the race window from the full 10-minute
 * expiry buffer down to one SM round-trip (~200ms). If the concurrent winner already
 * wrote, the loser exits early without calling Atlassian.
 *
 * Residual risk: two callers completing their pre-reads within ~200ms of each other
 * can still both reach Atlassian. On the resulting 401, #recoverFromAtlassian401
 * re-reads SM (immediate + 200ms wait) to catch the winner's write.
 *
 * ## App-level OAuth credentials
 *
 * client_id and client_secret are static per-provider secrets stored in HashiCorp
 * Vault and injected as Lambda env vars at deploy time. They are resolved lazily
 * inside #fetchNewTokens — callers that only read tokens do not need them set.
 */
export default class OAuthCredentialManager {
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
  async getAuthHeaders() {
    const secret = await this.#readSecret();

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
   * Race-safe pre-read: if another Lambda already refreshed in the narrow
   * concurrent window, their token is returned without calling Atlassian.
   *
   * Requires GET + PUT SM permission.
   *
   * @returns {Promise<{Authorization: string}>}
   */
  async refreshAuthHeaders() {
    const current = await this.#readSecret();

    // Pre-read exit: concurrent caller already refreshed — use their token.
    if (!this.#isExpired(current) && !current.requiresReauth) {
      return { Authorization: `Bearer ${current.accessToken}` };
    }

    let refreshed;
    try {
      refreshed = await this.#fetchNewTokens(current.refreshToken);
    } catch (err) {
      if (err.status === 401) {
        return this.#recoverFromAtlassian401();
      }
      throw err;
    }

    await this.#writeTokens(refreshed);
    return { Authorization: `Bearer ${refreshed.access_token}` };
  }

  /**
   * Reactive refresh triggered by a 401 from the provider API.
   *
   * When usedAuthHeader is supplied: checks SM first. If SM already holds a
   * different, valid token (a concurrent Lambda refreshed while this one was
   * in-flight), that token is returned immediately — no Atlassian call, no
   * refresh token consumed. Falls through to Atlassian only if SM still holds
   * the same rejected token (admin revoke, or concurrent winner not yet written).
   *
   * When called without usedAuthHeader: proceeds straight to Atlassian — covers
   * the case where the caller does not know which token was rejected.
   *
   * Requires GET + PUT SM permission.
   *
   * @param {string} [usedAuthHeader] - The Authorization header that the provider
   *   rejected (e.g. 'Bearer <old-token>'). Supplied when the caller knows
   *   which token was used; omitted when the rejected token is unknown.
   * @returns {Promise<{Authorization: string}>}
   */
  async forceRefreshAuthHeaders(usedAuthHeader = null) {
    // RFC 6750 §2.1: the Bearer scheme name is case-insensitive.
    // Trim + null-coalesce: "Bearer " (space-only) must not produce an empty usedToken
    // that would always differ from current.accessToken and trigger a false early-exit.
    const usedToken = usedAuthHeader
      ? (usedAuthHeader.replace(/^bearer\s+/i, '').trim() || null)
      : null;
    const current = await this.#readSecret();

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
      if (err.status === 401) {
        return this.#recoverFromAtlassian401();
      }
      throw err;
    }

    await this.#writeTokens(refreshed);
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

  async #readSecret() {
    const result = await this.smClient.getSecretValue({ SecretId: this.secretPath });
    try {
      return JSON.parse(result.SecretString);
    } catch (err) {
      throw new Error(`Malformed SM secret at ${this.secretPath}: ${err.message}`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  #isExpired(secret) {
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
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw Object.assign(
        new Error(`Atlassian token refresh failed: ${response.status}`),
        { status: response.status },
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
    const reread = await this.#readSecret();
    if (!this.#isExpired(reread)) {
      return;
    }

    this.log.error('Token refresh failed: SM write exhausted and re-read expired', {
      error: lastErr?.message,
    });
    await this.#writeReauthFlag();
    throw new Error('OAuth token refresh failed — connection requires re-authorization');
  }

  /**
   * Recovery path when Atlassian returns 401 on a refresh call.
   * A concurrent caller may have already consumed the refresh token and written new
   * tokens to SM. Re-reads SM twice (immediate + 200ms wait) to catch their write.
   * If SM is still expired after both checks, marks the connection as requires_reauth.
   */
  async #recoverFromAtlassian401() {
    const raceCheck = await this.#readSecret();
    if (!this.#isExpired(raceCheck) && !raceCheck.requiresReauth) {
      this.log.debug('Atlassian 401 — concurrent caller already refreshed, using their token');
      return { Authorization: `Bearer ${raceCheck.accessToken}` };
    }

    // eslint-disable-next-line no-promise-executor-return
    await new Promise((resolve) => setTimeout(resolve, CONCURRENT_REFRESH_WAIT_MS));
    const finalCheck = await this.#readSecret();
    if (!this.#isExpired(finalCheck) && !finalCheck.requiresReauth) {
      this.log.debug('Concurrent refresh completed during wait — using their token');
      return { Authorization: `Bearer ${finalCheck.accessToken}` };
    }

    this.log.error('Atlassian token refresh returned 401 — refresh token revoked');
    await this.#writeReauthFlag();
    throw new Error('OAuth token refresh failed — connection requires re-authorization');
  }

  /**
   * Writes requiresReauth: true to SM with up to SM_WRITE_ATTEMPTS retries and
   * exponential backoff. Used internally by #writeTokens, #recoverFromAtlassian401,
   * and setRequiresReauth. Reauth writes are naturally idempotent (always writing true)
   * so no ClientRequestToken is needed.
   */
  async #writeReauthFlag() {
    const secret = await this.#readSecret();
    const payload = {
      SecretId: this.secretPath,
      SecretString: JSON.stringify({ ...secret, requiresReauth: true }),
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
