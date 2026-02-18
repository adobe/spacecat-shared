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

export interface VaultSecretsOptions {
  /** AWS Secrets Manager path for Vault bootstrap config. Default: '/mysticat/vault-bootstrap' */
  bootstrapPath?: string;
  /** Custom name resolver: receives the context object, returns a secret path. Or a static path string. */
  name?: string | ((ctx: Record<string, unknown>) => string);
  /** Cache hard expiration in ms. Default: 3600000 (1 hour) */
  expiration?: number;
  /** Metadata check interval in ms. Default: 60000 (1 minute) */
  checkDelay?: number;
}

type UniversalFunction = (request: Request, context: Record<string, unknown>) => Promise<Response>;

/** Middleware wrapper for loading secrets from HashiCorp Vault. Drop-in replacement for @adobe/helix-shared-secrets. */
export default function vaultSecrets(fn: UniversalFunction, opts?: VaultSecretsOptions): UniversalFunction;

/** Load secrets directly (without the wrapper). Useful for testing or non-middleware usage. */
export function loadSecrets(ctx: Record<string, unknown>, opts?: VaultSecretsOptions): Promise<Record<string, string>>;

/** Reset the internal cache. For testing only. */
export function reset(): void;
