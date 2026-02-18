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

import VaultClient from './vault-client.js';
import { loadBootstrapConfig } from './bootstrap.js';

const DEFAULT_EXPIRATION = 60 * 60 * 1000; // 1 hour
const DEFAULT_CHECK_DELAY = 60 * 1000; // 1 minute
const DEFAULT_BOOTSTRAP_PATH = '/mysticat/vault-bootstrap';

let cache = {
  loaded: 0, checked: 0, lastChanged: 0, data: null,
};
let vaultClient = null;
let bootstrapEnvironment = null;

export function reset() {
  cache = {
    loaded: 0, checked: 0, lastChanged: 0, data: null,
  };
  vaultClient = null;
  bootstrapEnvironment = null;
}

async function ensureClient(opts, log) {
  if (!vaultClient) {
    const bootstrapPath = opts.bootstrapPath || DEFAULT_BOOTSTRAP_PATH;
    const config = await loadBootstrapConfig({ bootstrapPath });

    vaultClient = new VaultClient({
      vaultAddr: config.vault_addr,
      mountPoint: config.mount_point,
    });
    bootstrapEnvironment = config.environment;

    await vaultClient.authenticate(config.role_id, config.secret_id);
  } else if (!vaultClient.isAuthenticated()) {
    const bootstrapPath = opts.bootstrapPath || DEFAULT_BOOTSTRAP_PATH;
    const config = await loadBootstrapConfig({ bootstrapPath });
    await vaultClient.authenticate(config.role_id, config.secret_id);
  } else if (vaultClient.isTokenExpiringSoon()) {
    await vaultClient.renewToken();
  }

  if (log) {
    log.info('Vault client ready');
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
  if (ctx.runtime && ctx.runtime.name === 'simulate') {
    return {};
  }

  if (!ctx.func) {
    return {};
  }

  const expiration = opts.expiration ?? DEFAULT_EXPIRATION;
  const checkDelay = opts.checkDelay ?? DEFAULT_CHECK_DELAY;
  const now = Date.now();

  await ensureClient(opts, ctx.log);

  const secretPath = resolvePath(opts, ctx, ctx.log);

  // Check if cache is expired
  const isExpired = cache.data && (now - cache.loaded) >= expiration;

  // Check metadata if past check delay and not expired
  let metadataChanged = false;
  if (cache.data && !isExpired && (now - cache.checked) >= checkDelay) {
    const lastChanged = await vaultClient.getLastChangedDate(secretPath);
    cache.checked = now;
    if (lastChanged > cache.lastChanged) {
      metadataChanged = true;
    }
  }

  // Re-fetch if expired, no cache, or metadata changed
  if (!cache.data || isExpired || metadataChanged) {
    cache.data = await vaultClient.readSecret(secretPath);
    cache.loaded = now;
    cache.checked = now;
    cache.lastChanged = await vaultClient.getLastChangedDate(secretPath);
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
        headers: { 'x-error': 'failed to load secrets' },
      });
    }
    return func(request, context);
  };
}
