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

import { Response } from '@adobe/fetch';

import VaultClient from './vault-client.js';
import { loadBootstrapConfig } from './bootstrap.js';

const DEFAULT_EXPIRATION = 60 * 60 * 1000; // 1 hour
const DEFAULT_CHECK_DELAY = 60 * 1000; // 1 minute
const ALIAS_PATTERN = /^[a-z0-9][a-z0-9_-]{0,30}$/i;
const CI_PATTERN = /^ci\d+$/i;

function isDevAliasDeployment(ctx, env) {
  if (env !== 'dev') {
    return false;
  }
  const { version } = ctx.func || {};
  if (!version) {
    return false;
  }
  if (version === 'latest' || version === '$LATEST') {
    return false;
  }
  if (CI_PATTERN.test(version)) {
    return false;
  }
  if (!ALIAS_PATTERN.test(version)) {
    return false;
  }
  return true;
}

function resolveBootstrapPath(ctx, opts) {
  if (opts.bootstrapPath) {
    return opts.bootstrapPath;
  }
  return `/mysticat/bootstrap/${ctx.func.name}`;
}

let cache = {
  loaded: 0, checked: 0, lastChanged: 0, data: null,
};
let overrideCache = { loaded: 0, data: null };
let vaultClient = null;
let bootstrapConfig = null;
let bootstrapEnvironment = null;
let clientLock = null;

export function reset() {
  cache = {
    loaded: 0, checked: 0, lastChanged: 0, data: null,
  };
  overrideCache = { loaded: 0, data: null };
  vaultClient = null;
  bootstrapConfig = null;
  bootstrapEnvironment = null;
  clientLock = null;
}

async function ensureClient(ctx, opts) {
  if (clientLock) {
    // One-shot lock: concurrent callers wait here while the first caller
    // initializes the client. The lock is cleared in the finally block.
    await clientLock;
    if (!vaultClient || !vaultClient.isAuthenticated()) {
      throw new Error('Vault client initialization failed');
    }
    return;
  }

  let resolve;
  clientLock = new Promise((r) => {
    resolve = r;
  });

  try {
    if (!vaultClient) {
      const bootstrapPath = resolveBootstrapPath(ctx, opts);
      bootstrapConfig = await loadBootstrapConfig({ bootstrapPath });

      vaultClient = new VaultClient({
        vaultAddr: bootstrapConfig.vault_addr,
        mountPoint: bootstrapConfig.mount_point,
      });
      bootstrapEnvironment = bootstrapConfig.environment;

      await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
    } else if (!vaultClient.isAuthenticated()) {
      try {
        await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
      } catch {
        // secret_id may have been rotated - re-fetch bootstrap from SM
        const bootstrapPath = resolveBootstrapPath(ctx, opts);
        bootstrapConfig = await loadBootstrapConfig({ bootstrapPath });
        await vaultClient.authenticate(bootstrapConfig.role_id, bootstrapConfig.secret_id);
      }
    } else if (vaultClient.isTokenExpiringSoon()) {
      await vaultClient.renewToken();
    }

    if (ctx.log) {
      ctx.log.debug('Vault client ready');
    }
  } finally {
    clientLock = null;
    resolve();
  }
}

function resolveDefaultPath(ctx) {
  return `${bootstrapEnvironment}/${ctx.func.name}`;
}

function resolvePath(opts, ctx, log) {
  if (typeof opts.name === 'function') {
    try {
      return opts.name(ctx);
    } catch (e) {
      if (log) {
        log.warn(`Custom name function failed, using convention: ${e.message}`);
      }
      return resolveDefaultPath(ctx);
    }
  }
  if (typeof opts.name === 'string') {
    return opts.name;
  }
  return resolveDefaultPath(ctx);
}

export async function loadSecrets(ctx, opts = {}) {
  if (process.env.VAULT_SECRETS_DISABLED === 'true') {
    return {};
  }

  if (ctx.runtime && ctx.runtime.name === 'simulate') {
    return {};
  }

  if (!ctx.func) {
    return {};
  }

  const expiration = opts.expiration ?? DEFAULT_EXPIRATION;
  const checkDelay = opts.checkDelay ?? DEFAULT_CHECK_DELAY;
  const now = Date.now();

  await ensureClient(ctx, opts);

  const secretPath = resolvePath(opts, ctx, ctx.log);

  // Check if cache is expired
  const isExpired = cache.data && (now - cache.loaded) >= expiration;

  // Check metadata if past check delay and not expired
  let metadataChanged = false;
  let newLastChanged = 0;
  if (cache.data && !isExpired && (now - cache.checked) >= checkDelay) {
    newLastChanged = await vaultClient.getLastChangedDate(secretPath);
    cache.checked = now;
    if (cache.lastChanged === 0) {
      // First metadata check - establish baseline without re-fetching
      cache.lastChanged = newLastChanged;
    } else if (newLastChanged > cache.lastChanged) {
      metadataChanged = true;
    }
  }

  // Re-fetch if expired, no cache, or metadata changed
  const baseFetched = !cache.data || isExpired || metadataChanged;
  if (baseFetched) {
    cache.data = await vaultClient.readSecret(secretPath);
    cache.loaded = now;
    cache.checked = now;
    if (metadataChanged) {
      cache.lastChanged = newLastChanged;
    } else if (isExpired) {
      cache.lastChanged = 0;
    }
  }

  // Dev alias overrides: fetch alongside base, store separately, merge at return
  if (isDevAliasDeployment(ctx, bootstrapEnvironment)) {
    const alias = ctx.func.version;
    const overridePath = `${bootstrapEnvironment}/development/${ctx.func.name}/${alias}`;

    if (baseFetched || overrideCache.loaded === 0) {
      try {
        overrideCache.data = await vaultClient.tryReadSecret(overridePath);
        overrideCache.loaded = now;
        if (overrideCache.data && ctx.log) {
          ctx.log.info(`Loaded dev overrides from ${overridePath}`);
        }
      } catch (e) {
        overrideCache.data = null;
        if (ctx.log) {
          ctx.log.warn(`Failed to load dev overrides from ${overridePath}: ${e.message}`);
        }
      }
    }

    if (overrideCache.data) {
      return { ...cache.data, ...overrideCache.data };
    }
  }

  return cache.data;
}

export default function vaultSecrets(func, opts = {}) {
  return async (request, context) => {
    try {
      const secrets = await loadSecrets(context, opts);
      Object.assign(context.env, secrets);
      Object.assign(process.env, secrets);
    } catch (e) {
      if (context.log) {
        context.log.error(`Failed to load secrets: ${e.message}`);
      }
      return new Response('', {
        status: 502,
        headers: { 'x-error': 'error fetching secrets.' },
      });
    }
    return func(request, context);
  };
}
