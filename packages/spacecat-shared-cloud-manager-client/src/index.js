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

import { execFileSync } from 'child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync,
  readlinkSync, rmSync, statfsSync, writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import { ImsClient } from '@adobe/spacecat-shared-ims-client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { archiveFolder, extract } from 'zip-lib';

const GIT_BIN = process.env.GIT_BIN_PATH || '/opt/bin/git';
const CLONE_DIR_PREFIX = 'cm-repo-';
const PATCH_FILE_PREFIX = 'cm-patch-';

// Per-operation timeout for git commands (clone, push, pull, commit, etc.).
// Override via GIT_OPERATION_TIMEOUT_MS env var. Defaults to 10 min so large
// repositories can finish cloning within the Lambda's 15-min envelope.
const GIT_OPERATION_TIMEOUT_MS = parseInt(process.env.GIT_OPERATION_TIMEOUT_MS, 10) || 600_000;

/**
 * Repository type constants for Cloud Manager integrations.
 * Standard repos use basic auth; all others (BYOG) use Bearer token extraheaders.
 */
export const CM_REPO_TYPE = Object.freeze({
  GITHUB: 'github',
  BITBUCKET: 'bitbucket',
  GITLAB: 'gitlab',
  AZURE_DEVOPS: 'azure_devops',
  STANDARD: 'standard',
});

/**
 * Host that serves Cloud Manager `standard`-type repositories. Used at
 * submodule rewrite time to recognise standard URLs in submodule entries
 * and attach the corresponding Basic-auth extraheader scope.
 */
export const GIT_CLOUD_MANAGER_HOST = 'git.cloudmanager.adobe.com';

/**
 * Transient-failure retry policy for CM Repo API pull-request creation.
 * A single retry after a short wait rides out brief 5xx/429/network blips
 * without masking permanent failures — 4xx responses other than 429 are
 * treated as permanent and are not retried.
 */
const CM_PR_MAX_ATTEMPTS = 2;
const CM_PR_RETRY_DELAY_MS = 1500;

/** true for HTTP statuses worth retrying (server errors + rate limiting). */
const isTransientStatus = (status) => status >= 500 || status === 429;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Returns true for any repo type that tunnels through the CM repo service
 * proxy (i.e. anything other than STANDARD). BYOG repos need extra handling
 * for submodules because the proxy URL uses numeric repository IDs, not
 * names — relative and SSH URLs in `.gitmodules` must be rewritten using
 * the onboarding-populated `resolvedUrl` from each entry in
 * `site.code.metadata.submodules`.
 *
 * @param {string} repoType
 * @returns {boolean}
 */
export function isBYOG(repoType) {
  return repoType !== CM_REPO_TYPE.STANDARD;
}

// Lambda layer environment: git and its helpers (git-remote-https) live under /opt.
// Without these, the dynamic linker can't find shared libraries (libcurl, libexpat, …)
// and git can't locate its sub-commands (git-remote-https for HTTPS transport).
const GIT_ENV = {
  ...process.env,
  PATH: '/opt/bin:/usr/local/bin:/usr/bin:/bin',
  GIT_EXEC_PATH: '/opt/libexec/git-core',
  LD_LIBRARY_PATH: '/opt/lib:/lib64:/usr/lib64',
  GIT_TERMINAL_PROMPT: '0',
  GIT_ASKPASS: '',
};

/**
 * Parses an S3 URI (s3://bucket/key) into bucket and key.
 * @param {string} s3Path - S3 URI
 * @returns {{ bucket: string, key: string }}
 */
function parseS3Path(s3Path) {
  let parsed;
  try {
    parsed = new URL(s3Path);
  } catch {
    throw new Error(`Invalid S3 path: ${s3Path}. Expected format: s3://bucket/key`);
  }
  if (parsed.protocol !== 's3:' || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error(`Invalid S3 path: ${s3Path}. Expected format: s3://bucket/key`);
  }
  return { bucket: parsed.hostname, key: parsed.pathname.slice(1) };
}

export default class CloudManagerClient {
  /**
   * Creates a CloudManagerClient from a Universal context.
   * @param {Object} context - Universal function context
   * @returns {CloudManagerClient}
   */
  static createFrom(context) {
    const { log = console } = context;
    const {
      IMS_HOST: imsHost,
      ASO_CM_REPO_SERVICE_IMS_CLIENT_ID: clientId,
      ASO_CM_REPO_SERVICE_IMS_CLIENT_SECRET: clientSecret,
      ASO_CM_REPO_SERVICE_IMS_CLIENT_CODE: clientCode,
      CM_REPO_URL: cmRepoUrl,
      CM_STANDARD_REPO_CREDENTIALS: standardRepoCredentialsRaw,
      ASO_CODE_AUTOFIX_USERNAME: gitUsername,
      ASO_CODE_AUTOFIX_EMAIL: gitUserEmail,
    } = context.env;

    const s3Client = context.s3?.s3Client;
    if (!s3Client) {
      throw new Error('CloudManagerClient requires S3 client. Ensure s3Wrapper is configured.');
    }

    if (!hasText(imsHost) || !hasText(clientId) || !hasText(clientSecret) || !hasText(clientCode)) {
      throw new Error('CloudManagerClient requires IMS_HOST, ASO_CM_REPO_SERVICE_IMS_CLIENT_ID,'
        + ' ASO_CM_REPO_SERVICE_IMS_CLIENT_SECRET, and ASO_CM_REPO_SERVICE_IMS_CLIENT_CODE.');
    }

    if (!hasText(cmRepoUrl)) {
      throw new Error('CloudManagerClient requires CM_REPO_URL.');
    }

    if (!hasText(gitUsername) || !hasText(gitUserEmail)) {
      throw new Error('CloudManagerClient requires ASO_CODE_AUTOFIX_USERNAME and ASO_CODE_AUTOFIX_EMAIL.');
    }

    // Optional: credentials for standard (non-BYOG) CM repos.
    // JSON object mapping programId to "username:accessToken".
    let standardRepoCredentials = {};
    if (hasText(standardRepoCredentialsRaw)) {
      try {
        standardRepoCredentials = JSON.parse(standardRepoCredentialsRaw);
      } catch (e) {
        throw new Error('CM_STANDARD_REPO_CREDENTIALS must be valid JSON.');
      }
    }

    // Create ImsClient for token management (handles caching internally)
    const imsClient = ImsClient.createFrom({
      env: {
        IMS_HOST: imsHost,
        IMS_CLIENT_ID: clientId,
        IMS_CLIENT_CODE: clientCode,
        IMS_CLIENT_SECRET: clientSecret,
      },
      log,
    });

    return new CloudManagerClient({
      clientId,
      cmRepoUrl,
      standardRepoCredentials,
      gitUsername,
      gitUserEmail,
    }, imsClient, s3Client, log);
  }

  constructor(config, imsClient, s3Client, log = console) {
    this.config = config;
    this.imsClient = imsClient;
    this.s3Client = s3Client;
    this.log = log;
  }

  // --- Private helpers ---

  /**
   * Logs /tmp disk usage (total, used, free) for capacity monitoring.
   * Uses statfsSync — a single syscall with negligible cost.
   * @param {string} operation - The operation that just completed (e.g. 'clone', 'pull')
   */
  #logTmpDiskUsage(operation) {
    const { bsize, blocks, bfree } = statfsSync(os.tmpdir());
    const totalMB = Math.round((bsize * blocks) / (1024 * 1024));
    const freeMB = Math.round((bsize * bfree) / (1024 * 1024));
    const usedMB = totalMB - freeMB;
    this.log.info(`[${operation}] /tmp disk usage: ${usedMB} MB used, ${freeMB} MB free, ${totalMB} MB total`);
  }

  /**
   * Looks up basic-auth credentials for a standard (non-BYOG) CM repository.
   * @param {string} programId - CM Program ID
   * @returns {string} "username:accessToken"
   */
  #getStandardRepoCredentials(programId) {
    const credentials = this.config.standardRepoCredentials[programId];
    if (!credentials) {
      throw new Error(`No standard repo credentials found for programId: ${programId}. Check CM_STANDARD_REPO_CREDENTIALS.`);
    }
    return credentials;
  }

  /**
   * Builds the git -c http.extraheader arguments for CM repo auth.
   * @param {string} imsOrgId - IMS Organization ID
   * @returns {Promise<string[]>} Array of git config args
   */
  async #getCMRepoServiceCredentials(imsOrgId) {
    const { access_token: token } = await this.imsClient.getServiceAccessToken();
    const { cmRepoUrl, clientId } = this.config;

    return [
      '-c', `http.${cmRepoUrl}.extraheader=Authorization: Bearer ${token}`,
      '-c', `http.${cmRepoUrl}.extraheader=x-api-key: ${clientId}`,
      '-c', `http.${cmRepoUrl}.extraheader=x-gw-ims-org-id: ${imsOrgId}`,
    ];
  }

  /**
   * Constructs the git repository URL for a CM repo.
   * @param {string} programId
   * @param {string} repositoryId
   * @returns {string}
   */
  #getRepoUrl(programId, repositoryId) {
    return `${this.config.cmRepoUrl}/api/program/${programId}/repository/${repositoryId}.git`;
  }

  /**
   * Executes a git command.
   * @param {string[]} args - Arguments to pass to git
   * @param {Object} [options] - execFileSync options
   * @returns {string} stdout
   */
  #execGit(args, options = {}) {
    try {
      return execFileSync(GIT_BIN, args, {
        encoding: 'utf-8', env: GIT_ENV, timeout: GIT_OPERATION_TIMEOUT_MS, ...options,
      });
    } catch (error) {
      if (error.killed) {
        this.log.error(`Git command timed out after ${GIT_OPERATION_TIMEOUT_MS / 1000}s`);
        throw new Error(`Git command timed out after ${GIT_OPERATION_TIMEOUT_MS / 1000}s`);
      }
      // Sanitize tokens and credentials from all error output sources
      const rawMessage = [error.stderr, error.stdout, error.message]
        .filter(Boolean)
        .join('\n');
      const sanitized = rawMessage
        .replace(/Bearer [^\s"]+/g, 'Bearer [REDACTED]')
        .replace(/:\/\/[^@]+@/g, '://***@')
        .replace(/x-api-key: [^\s"]+/g, 'x-api-key: [REDACTED]')
        .replace(/x-gw-ims-org-id: [^\s"]+/g, 'x-gw-ims-org-id: [REDACTED]')
        .replace(/Authorization: Basic [^\s"]+/g, 'Authorization: Basic [REDACTED]');
      this.log.error(`Git command failed: ${sanitized}`);
      throw new Error(`Git command failed: ${sanitized}`);
    }
  }

  /**
   * Common orchestration for applying changes to a cloned repository.
   * Configures git identity, checks out the branch, runs the caller-provided
   * apply function, and optionally stages + commits.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} branch - Branch to checkout
   * @param {Function} applyFn - Async callback that applies changes to the working tree.
   *   Receives `clonePath` as its only argument.
   * @param {string|null} commitMessage - If provided, runs `git add -A` + `git commit`
   *   after applyFn completes. Pass null when the apply step already commits
   *   (e.g. `git am` for mail-message patches).
   */
  async #applyChanges(clonePath, branch, applyFn, commitMessage) {
    const { gitUsername, gitUserEmail } = this.config;
    this.#execGit(['config', 'user.name', gitUsername], { cwd: clonePath });
    this.#execGit(['config', 'user.email', gitUserEmail], { cwd: clonePath });
    this.#execGit(['checkout', branch], { cwd: clonePath });

    await applyFn(clonePath);

    if (commitMessage) {
      this.#execGit(['add', '-A'], { cwd: clonePath });
      this.#execGit(['commit', '-m', commitMessage], { cwd: clonePath });
    }
  }

  /**
   * Builds authenticated git arguments for a remote command (clone, push, or pull).
   *
   * Both repo types use http.extraheader for authentication:
   * - Standard repos: Basic auth header via extraheader scoped to the org prefix
   *   (scheme + host + '/' + orgName + '/'), so the header covers all repos and submodules
   *   belonging to that customer org without granting access to other orgs on the same host
   * - BYOG repos: Bearer token + API key + IMS org ID via extraheader on the CM Repo URL
   *
   * @param {string} command - The git command ('clone', 'push', or 'pull')
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Repository auth configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @returns {Promise<string[]>} Array of git arguments
   */
  async #buildAuthGitArgs(command, programId, repositoryId, { imsOrgId, repoType, repoUrl } = {}) {
    if (repoType === CM_REPO_TYPE.STANDARD) {
      const authArgs = this.#buildStandardAuthArgs(programId, repoUrl);
      return [...authArgs, command, repoUrl];
    }

    const cmRepoServiceCredentials = await this.#getCMRepoServiceCredentials(imsOrgId);
    const byogRepoUrl = this.#getRepoUrl(programId, repositoryId);
    return [...cmRepoServiceCredentials, command, byogRepoUrl];
  }

  /**
   * Builds the credentials-only `-c http.<orgPrefix>.extraheader=...` args
   * for a STANDARD repo, scoped to the org-prefix of the parent repo URL.
   *
   * The same args feed both the parent git command (clone/pull/push) and
   * any subsequent submodule git commands run inside the clone. Submodules
   * in the same `git.cloudmanager.adobe.com/{org}/` org reuse this scope
   * transparently — one credential covers every repo in that customer org.
   *
   * Credentials are never written to `.git/config`; they only ever travel
   * as process-scoped `-c` flags on a single git invocation, so an
   * inspector who opens the cloned repo's `.git/config` finds nothing.
   *
   * @param {string} programId - CM Program ID
   * @param {string} repoUrl - Parent repository URL (used to derive the
   *   org-scoped extraheader prefix)
   * @returns {string[]} `-c` args ready to prepend to a git invocation
   */
  #buildStandardAuthArgs(programId, repoUrl) {
    const credentials = this.#getStandardRepoCredentials(programId);
    const basicAuth = Buffer.from(credentials).toString('base64');
    const parsedUrl = new URL(repoUrl);
    const orgName = parsedUrl.pathname.split('/')[1];
    const repoOrgPrefix = `${parsedUrl.origin}/${orgName}/`;
    return ['-c', `http.${repoOrgPrefix}.extraheader=Authorization: Basic ${basicAuth}`];
  }

  /**
   * Clones a Cloud Manager repository to /tmp.
   *
   * Both repo types authenticate via http.extraheader (no credentials in the URL):
   * - BYOG repos: Bearer token + API key + IMS org ID via CM Repo URL
   * - Standard repos: Basic auth header via the repo URL
   *
   * Submodule handling is decoupled from the parent clone so a submodule
   * failure can never take down the parent: both repo types clone with
   * `--no-recurse-submodules` and populate submodules in a second pass
   * whose errors are caught and logged.
   * - STANDARD: post-clone `submodule sync --recursive` + `submodule update
   *   --init --recursive`. `.gitmodules` URLs resolve against the customer's
   *   real git host (the same host the parent was cloned from), so the
   *   existing org-scoped Basic-auth extraheader covers every submodule
   *   transparently. See `#initStandardSubmodules`.
   * - BYOG: post-clone rewrite driven by the onboarding-populated
   *   `submodules` array — relative or SSH `.gitmodules` URLs resolve
   *   against the CM proxy URL otherwise, producing name-based URLs the
   *   proxy rejects. See `#resolveByogSubmodules`.
   *
   * If a ref is provided, the clone will be checked out to that ref after cloning.
   * Checkout failures are logged but do not cause the clone to fail, so the caller
   * always gets a usable working copy (on the default branch if checkout fails).
   *
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Clone configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @param {string} [config.ref] - Optional. Git ref to checkout after clone (branch, tag, or SHA)
   * @param {Array<{sectionName: string, gitmodulesUrl: string, external: boolean,
   *                resolvedUrl?: string}>} [config.submodules] - Optional.
   *   BYOG-only. Per-submodule entries from `site.code.metadata.submodules`.
   *   For each entry that carries a `resolvedUrl`, the cm-client writes that
   *   URL into `.git/config submodule.<sectionName>.url` instead of letting
   *   git resolve the address from `.gitmodules`. `resolvedUrl` is either a
   *   CM proxy URL (BYOG-typed submodule) or a
   *   `https://git.cloudmanager.adobe.com/{org}/...` URL (standard-typed
   *   submodule). Entries without `resolvedUrl` are skipped — git will try
   *   the original `.gitmodules` URL for those. Ignored for STANDARD parent repos.
   * @returns {Promise<string>} The local clone path
   */
  async clone(programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref, submodules,
  } = {}) {
    const clonePath = mkdtempSync(path.join(os.tmpdir(), CLONE_DIR_PREFIX));
    const byog = isBYOG(repoType);

    try {
      this.log.info(`Cloning CM repository: program=${programId}, repo=${repositoryId}, type=${repoType}`);

      const args = await this.#buildAuthGitArgs('clone', programId, repositoryId, { imsOrgId, repoType, repoUrl });
      // Always --no-recurse-submodules so a submodule failure can't take
      // down the parent clone. Submodules are populated below in a path
      // whose errors are caught and logged (parent stands either way).
      this.#execGit([...args, '--no-recurse-submodules', clonePath]);
      this.log.info(`Repository cloned to ${clonePath}`);
      this.#logTmpDiskUsage('clone');

      // Checkout the requested ref if provided
      if (hasText(ref)) {
        try {
          this.#execGit(['checkout', ref], { cwd: clonePath });
          this.log.info(`Checked out ref '${ref}' in ${clonePath}`);
        } catch (error) {
          this.log.error(`Failed to checkout ref '${ref}': ${error.message}. Continuing with default branch.`);
        }
      }

      // Populate submodules. Both paths swallow errors internally — a
      // broken submodule never aborts the parent import.
      if (byog) {
        await this.#resolveByogSubmodules(clonePath, programId, submodules, { imsOrgId });
      } else {
        // Re-derive the same `-c http.<orgPrefix>.extraheader=Basic ...` args
        // we used for the parent clone, so the submodule fetches authenticate
        // against the same org without persisting any credentials to disk.
        const standardAuthArgs = this.#buildStandardAuthArgs(programId, repoUrl);
        this.#initStandardSubmodules(clonePath, standardAuthArgs);
      }

      return clonePath;
    } catch (error) {
      rmSync(clonePath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * For STANDARD repos: populate submodules in a separate pass after the
   * parent clone/pull so a submodule failure can't fail the whole git
   * command. `submodule sync --recursive` refreshes any URL changes the
   * current ref introduces; `submodule update --init --recursive` fetches
   * and checks them out.
   *
   * Safe for standard repos because `.gitmodules` URLs resolve to the
   * customer's real git host — which is exactly what we want git to use.
   * The caller passes the parent's org-scoped Basic-auth `-c` extraheader
   * args; they're forwarded to every submodule git command so authenticated
   * fetches against `git.cloudmanager.adobe.com/{org}/...` succeed without
   * ever persisting credentials to `.git/config`. (Git's `-c key=value`
   * is process-scoped — it never writes to disk.)
   *
   * Errors are caught and logged at `warn`. The parent clone/pull stands;
   * the submodule working trees may be empty until the underlying issue is
   * fixed at the customer / onboarding side.
   *
   * NOTE: do NOT call this on the BYOG path. BYOG `.gitmodules` URLs are
   * name-based and require rewriting first; `sync` would overwrite the
   * rewritten entries in `.git/config`.
   *
   * @param {string} clonePath - Local clone of the STANDARD parent
   * @param {string[]} [authArgs] - Optional `-c http.<orgPrefix>.extraheader=...`
   *   args to prepend to every submodule git command. Omit only when the
   *   caller has already established credentials another way (tests do this).
   */
  #initStandardSubmodules(clonePath, authArgs = []) {
    if (!existsSync(path.join(clonePath, '.gitmodules'))) {
      return;
    }
    try {
      this.#execGit([...authArgs, 'submodule', 'sync', '--recursive'], { cwd: clonePath });
      this.#execGit([...authArgs, 'submodule', 'update', '--init', '--recursive'], { cwd: clonePath });
      this.log.info(`Initialized submodules for standard repo at ${clonePath}`);
    } catch (submoduleError) {
      this.log.warn(`Standard submodule init failed: ${submoduleError.message}. Continuing without submodule recursion.`);
    }
  }

  /**
   * Builds the dual-scope extraheader args needed to authenticate every
   * outgoing submodule fetch. Walks the resolved entries once, collects
   * the unique URL hosts, and emits one `-c http.<scope>.extraheader=...`
   * per scope:
   *
   *   - URLs on the CM repo service host get the BYOG triple (Bearer +
   *     x-api-key + x-gw-ims-org-id), scoped to the proxy URL prefix.
   *   - URLs on `git.cloudmanager.adobe.com/{orgName}/` get a Basic-auth
   *     header sourced from `CM_STANDARD_REPO_CREDENTIALS[programId]`,
   *     scoped to the org prefix so it covers every standard repo in the
   *     same customer org without leaking to other orgs on the same host.
   *
   * Git applies each scope's headers only when the outgoing request URL
   * starts with that scope's prefix — so the BYOG Bearer never leaks into
   * standard fetches and vice versa. Both scopes coexist safely on a single
   * `git submodule update` invocation.
   *
   * @param {Array<{resolvedUrl?: string}>} resolvedEntries - entries from
   *   `submodules` that carry a `resolvedUrl`. Other fields are unused here.
   * @param {string} programId - CM Program ID, used to look up standard creds
   * @param {string} imsOrgId - Customer's IMS Organization ID, for BYOG headers
   * @returns {Promise<string[]>} `-c` args ready to prepend to a git invocation
   */
  async #buildSubmoduleAuthArgs(resolvedEntries, programId, imsOrgId) {
    const args = [];
    const hosts = new Set(resolvedEntries.map((e) => {
      try {
        return new URL(e.resolvedUrl).host;
      } catch {
        return null;
      }
    }).filter(Boolean));

    const cmRepoHost = new URL(this.config.cmRepoUrl).host;

    // BYOG scope — only added if at least one entry targets the CM proxy
    if (hosts.has(cmRepoHost)) {
      const byogArgs = await this.#getCMRepoServiceCredentials(imsOrgId);
      args.push(...byogArgs);
    }

    // Standard scope — one per (orgName) seen under git.cloudmanager.adobe.com
    if (hosts.has(GIT_CLOUD_MANAGER_HOST)) {
      const orgs = new Set();
      for (const entry of resolvedEntries) {
        try {
          const u = new URL(entry.resolvedUrl);
          if (u.host === GIT_CLOUD_MANAGER_HOST) {
            const orgName = u.pathname.split('/').filter(Boolean)[0];
            if (orgName) {
              orgs.add(orgName);
            }
          }
        } catch { /* skip unparseable */ }
      }

      // All standard repos in a CM program live under the same customer org
      // (`git.cloudmanager.adobe.com/{orgName}/`). One Basic credential
      // covers every repo in that org — validated empirically.
      if (orgs.size > 0) {
        const credentials = this.#getStandardRepoCredentials(programId);
        const basicAuth = Buffer.from(credentials).toString('base64');
        for (const org of orgs) {
          const scope = `https://${GIT_CLOUD_MANAGER_HOST}/${org}/`;
          args.push('-c', `http.${scope}.extraheader=Authorization: Basic ${basicAuth}`);
        }
      }
    }

    return args;
  }

  /**
   * For BYOG parents: populate submodules using the onboarding-precomputed
   * `submodules` array. Each entry's `resolvedUrl` is the runtime-ready URL
   * — proxy URL for BYOG-typed submodules,
   * `git.cloudmanager.adobe.com/{org}/{name}/` for standard-typed submodules
   * of the same parent. All name disambiguation, URL classification, and
   * collision handling is done at onboarding; runtime is purely mechanical.
   *
   * Flow:
   *   1. `git submodule init` — registers default `.git/config` entries
   *      from `.gitmodules`. The initial URLs are wrong (proxy doesn't
   *      route by name) but we overwrite them in the next step.
   *   2. For each entry that carries a `resolvedUrl`, write that URL into
   *      `.git/config submodule.<sectionName>.url`. `.gitmodules` itself
   *      stays untouched — the working tree remains clean.
   *   3. `git submodule update --force --recursive` with all relevant
   *      auth scopes. `--force` is essential: when the parent's pinned
   *      gitlink SHA is unreachable in the submodule (common when a
   *      customer migrates a submodule between BYOG and standard, leaving
   *      the parent's pin behind), `--force` resets to whatever HEAD
   *      points at after fetch (typically branch tip) instead of failing
   *      silently with an empty working tree.
   *
   * IMPORTANT: never run `git submodule sync` in this flow — `sync` copies
   * `.gitmodules` URLs back into `.git/config`, undoing step 2.
   *
   * Idempotent: re-running this against an existing clone is a no-op for
   * already-correct entries and re-applies the rewrite for any new
   * submodules pulled in. `pull()` calls it unconditionally after each
   * pull for that reason.
   *
   * Graceful fallbacks:
   *   - No `.gitmodules`: nothing to do.
   *   - Empty/missing `submodules`: log a warning and run `submodule
   *     update --force` without rewrites — git will try the original
   *     `.gitmodules` URLs (most will fail through the CM proxy), but
   *     the parent clone itself is preserved.
   *   - Entries without `resolvedUrl`: their `.git/config` URL is left
   *     as-is; `submodule update` will likely fail for those entries
   *     only, and the rest still complete.
   *
   * @param {string} clonePath - Local clone of the BYOG parent
   * @param {string} programId - CM Program ID (for standard-cred lookup)
   * @param {Array<{sectionName: string, gitmodulesUrl: string, external: boolean,
   *                resolvedUrl?: string}>} [submodules]
   * @param {{imsOrgId: string}} param3
   */
  async #resolveByogSubmodules(clonePath, programId, submodules, { imsOrgId } = {}) {
    if (!existsSync(path.join(clonePath, '.gitmodules'))) {
      return;
    }

    try {
      // Step 1: register submodules in .git/config (URLs will be wrong; we overwrite next)
      this.#execGit(['submodule', 'init'], { cwd: clonePath });

      // Step 2: rewrite each submodule.<sectionName>.url from onboarding-resolved entries.
      // Entries without `resolvedUrl` are passed through to git as-is (which will
      // try the original `.gitmodules` URL and most likely fail) — log a warning
      // per such entry so onboarding gaps are visible in import-worker logs.
      const allEntries = Array.isArray(submodules) ? submodules : [];
      const resolved = [];
      for (const entry of allEntries) {
        if (entry && hasText(entry.sectionName)) {
          if (hasText(entry.resolvedUrl)) {
            resolved.push(entry);
          } else {
            this.log.warn(
              `BYOG program ${programId} submodule "${entry.sectionName}" has no resolvedUrl — `
              + 'fetch via the CM proxy will likely fail for this entry. '
              + `Populate site.code.metadata.submodules entry "${entry.sectionName}".resolvedUrl at onboarding.`,
            );
          }
        }
      }
      if (resolved.length === 0) {
        this.log.warn(
          `BYOG program ${programId} has .gitmodules but no resolved submodule entries — `
          + 'submodule URLs cannot be resolved through the CM proxy. '
          + 'Populate site.code.metadata.submodules[].resolvedUrl at onboarding.',
        );
      } else {
        for (const entry of resolved) {
          this.#execGit(
            ['config', '--local', `submodule.${entry.sectionName}.url`, entry.resolvedUrl],
            { cwd: clonePath },
          );
        }
      }

      // Step 3: fetch + check out submodules using the rewritten URLs.
      // Build dual-scope auth (BYOG + standard) from the resolved URLs,
      // and use --force to handle stale parent gitlinks.
      const authArgs = resolved.length > 0
        ? await this.#buildSubmoduleAuthArgs(resolved, programId, imsOrgId)
        : await this.#getCMRepoServiceCredentials(imsOrgId);
      this.#execGit(
        [...authArgs, 'submodule', 'update', '--force', '--recursive'],
        { cwd: clonePath },
      );
      this.log.info(`BYOG submodules initialized at ${clonePath}`);
    } catch (submoduleError) {
      this.log.warn(`BYOG submodule init failed: ${submoduleError.message}. Continuing without submodule recursion.`);
    }
  }

  /**
   * Recursively validates that all symlinks under rootDir point to targets
   * within rootDir. Throws if any symlink escapes the root boundary.
   * Logs a warning for broken symlinks (target does not exist).
   * @param {string} dir - Directory to scan
   * @param {string} rootDir - The root boundary all symlink targets must stay within
   */
  #validateSymlinks(dir, rootDir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const target = readlinkSync(fullPath);
        const resolved = path.resolve(path.dirname(fullPath), target);
        const relative = path.relative(rootDir, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          throw new Error(
            `Symlink escapes repository root: ${path.relative(rootDir, fullPath)} -> ${target}`,
          );
        }
        if (!existsSync(resolved)) {
          this.log.warn(`Broken symlink: ${path.relative(rootDir, fullPath)} -> ${target} (target does not exist)`);
        }
      } else if (entry.isDirectory()) {
        this.#validateSymlinks(fullPath, rootDir);
      }
    }
  }

  /**
   * Zips the entire cloned repository including .git history.
   * Downstream services that read the ZIP from S3 need the full git history.
   * @param {string} clonePath - Path to the cloned repository
   * @returns {Promise<Buffer>} ZIP file as a Buffer
   */
  async zipRepository(clonePath) {
    if (!existsSync(clonePath)) {
      throw new Error(`Clone path does not exist: ${clonePath}`);
    }

    try {
      this.log.info(`Zipping repository at ${clonePath}`);
      this.#validateSymlinks(clonePath, clonePath);
      this.#logTmpDiskUsage('zip');
      return await archiveFolder(clonePath, { followSymlinks: false });
    } catch (error) {
      throw new Error(`Failed to zip repository: ${error.message}`);
    }
  }

  /**
   * Creates a new branch from a base branch.
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} baseBranch - Base branch name
   * @param {string} newBranch - New branch name
   */
  async createBranch(clonePath, baseBranch, newBranch) {
    this.log.info(`Creating branch ${newBranch} from ${baseBranch}`);
    this.#execGit(['checkout', baseBranch], { cwd: clonePath });
    this.#execGit(['checkout', '-b', newBranch], { cwd: clonePath });
  }

  /**
   * Checks whether the given patch content is in git mail-message format.
   * Mail-message patches (generated by `git format-patch`) start with "From "
   * and are applied via `git am`, which auto-commits using embedded metadata.
   * Plain diffs start with "diff " and require explicit `git apply` + commit.
   *
   * @param {string} patchContent - Raw patch content
   * @returns {boolean} true if mail-message format
   */
  // eslint-disable-next-line class-methods-use-this
  #isMailFormatPatch(patchContent) {
    return patchContent.startsWith('From ');
  }

  /**
   * Downloads a patch from S3 and applies it to the given branch.
   * Supports two patch formats, detected automatically from the content:
   * - Mail-message format (starts with "From "): applied via git am, which
   *   creates the commit using embedded metadata (author, date, message).
   * - Plain diff format (starts with "diff "): applied via git apply, then
   *   staged and committed. A commitMessage option is required for this flow.
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} branch - Branch to apply the patch on
   * @param {string} s3PatchPath - S3 URI of the patch file (s3://bucket/key)
   * @param {object} [options] - Optional settings
   * @param {string} [options.commitMessage] - Commit message for plain diff patches. Required
   *   when the patch is a plain diff. Ignored for mail-message patches (git am uses the
   *   embedded commit message); a warning is logged if provided with a mail-message patch.
   */
  async applyPatch(clonePath, branch, s3PatchPath, options = {}) {
    const { bucket, key } = parseS3Path(s3PatchPath);
    const patchDir = mkdtempSync(path.join(os.tmpdir(), PATCH_FILE_PREFIX));
    const patchFile = path.join(patchDir, 'applied.patch');

    try {
      // Download patch from S3
      this.log.info(`Downloading patch from s3://${bucket}/${key}`);
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);
      const patchContent = await response.Body.transformToString();
      writeFileSync(patchFile, patchContent);

      const { commitMessage } = options;
      const isMailFormat = this.#isMailFormatPatch(patchContent);

      if (!isMailFormat && !commitMessage) {
        throw new Error('commitMessage is required when applying a plain diff patch');
      }
      if (isMailFormat && commitMessage) {
        this.log.warn('commitMessage is ignored for mail-message patches; git am uses the embedded commit message');
      }

      await this.#applyChanges(clonePath, branch, () => {
        this.#execGit([isMailFormat ? 'am' : 'apply', patchFile], { cwd: clonePath });
      }, isMailFormat ? null : commitMessage);
      this.log.info(`Patch applied and committed on branch ${branch}`);
    } finally {
      if (existsSync(patchDir)) {
        rmSync(patchDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * Applies a patch from an in-memory string (not from S3).
   * Use this when the patch content is already available (e.g. from suggestion data)
   * instead of downloading from S3. Writes the content to a temp file, applies it,
   * then cleans up.
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} branch - Branch to apply the patch on
   * @param {string} patchContent - The patch/diff content as a string
   * @param {string} commitMessage - Commit message for the applied changes
   */
  async applyPatchContent(clonePath, branch, patchContent, commitMessage) {
    if (!commitMessage) {
      throw new Error('commitMessage is required for applyPatchContent');
    }

    const patchDir = mkdtempSync(path.join(os.tmpdir(), PATCH_FILE_PREFIX));
    const patchFile = path.join(patchDir, 'applied.patch');

    try {
      writeFileSync(patchFile, patchContent);

      const isMailFormat = this.#isMailFormatPatch(patchContent);
      await this.#applyChanges(clonePath, branch, () => {
        this.#execGit([isMailFormat ? 'am' : 'apply', patchFile], { cwd: clonePath });
      }, isMailFormat ? null : commitMessage);

      if (isMailFormat) {
        this.log.info(`Mail-message patch applied via git am on branch ${branch} (commitMessage ignored)`);
      } else {
        this.log.info(`Plain diff patch applied and committed on branch ${branch}`);
      }
    } finally {
      if (existsSync(patchDir)) {
        rmSync(patchDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * Writes files to the clone directory and commits the changes.
   * Use this for file-based updates (e.g. accessibility S3 assets) where the
   * content is provided as an array of {path, content} objects rather than a diff.
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} branch - Branch to apply the files on
   * @param {{path: string, content: string}[]} files - Files to write (relative paths)
   * @param {string} commitMessage - Commit message
   */
  async applyFiles(clonePath, branch, files, commitMessage) {
    if (!commitMessage) {
      throw new Error('commitMessage is required for applyFiles');
    }
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('files must be a non-empty array of {path, content} objects');
    }

    await this.#applyChanges(clonePath, branch, (cwd) => {
      for (const file of files) {
        const filePath = path.join(cwd, file.path);
        const dir = path.dirname(filePath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, file.content);
      }
    }, commitMessage);
    this.log.info(`${files.length} file(s) applied and committed on branch ${branch}`);
  }

  /**
   * Pushes the current branch to the remote CM repository.
   * Commits are expected to already exist (e.g. via applyPatch).
   *
   * For BYOG repos: uses Bearer token + API key + IMS org ID via extraheader.
   * For standard repos: uses Basic auth via extraheader.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Push configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @param {string} config.ref - Git ref (branch) to push
   */
  async push(clonePath, programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref,
  } = {}) {
    const pushArgs = await this.#buildAuthGitArgs('push', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    pushArgs.push(ref);
    this.#execGit(pushArgs, { cwd: clonePath });
    this.log.info('Changes pushed successfully');
    this.#logTmpDiskUsage('push');
  }

  /**
   * Pulls the latest changes from the remote CM repository into an existing clone.
   *
   * For BYOG repos: uses Bearer token + API key + IMS org ID via extraheader.
   * For standard repos: uses Basic auth via extraheader.
   *
   * If a ref is provided, the ref is checked out before pulling so that
   * the pull updates the correct branch.
   *
   * Submodule handling: parent pull never carries `--recurse-submodules`
   * so a submodule failure can't fail the parent pull. Submodules are
   * populated in a separate pass whose errors are caught and logged.
   * - STANDARD: post-pull `submodule sync --recursive` + `update --init
   *   --recursive`. See `#initStandardSubmodules`.
   * - BYOG: post-pull rewrite driven by `submodules[].resolvedUrl`. Also
   *   picks up any new submodules the pull may have introduced, since
   *   the new entries will already be present in the array (it's
   *   per-program, not per-clone) provided onboarding has refreshed it.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Pull configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @param {string} [config.ref] - Optional. Git ref to checkout before pull (branch, tag, or SHA)
   * @param {Array<{sectionName: string, gitmodulesUrl: string, external: boolean,
   *                resolvedUrl?: string}>} [config.submodules] - Optional.
   *   BYOG-only. Same shape as `clone()`. See `#resolveByogSubmodules` for
   *   details.
   */
  async pull(clonePath, programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref, submodules,
  } = {}) {
    const byog = isBYOG(repoType);

    if (hasText(ref)) {
      this.#execGit(['checkout', ref], { cwd: clonePath });
      this.log.info(`Checked out ref '${ref}' before pull`);
    }

    const pullArgs = await this.#buildAuthGitArgs('pull', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    // Explicitly pass the ref as the last argument so `git pull` fetches and
    // merges that branch. Without it, `git pull <url>` merges the remote's
    // default branch (its HEAD) into the checked-out branch, which can
    // conflict with — or silently diverge from — the branch we actually want.
    if (hasText(ref)) {
      pullArgs.push(ref);
    }
    // Always pull the parent only — never `--recurse-submodules` — so a
    // submodule failure can't take down the parent pull. Submodules are
    // populated below in a path whose errors are caught and logged.
    this.#execGit(pullArgs, { cwd: clonePath });
    this.log.info('Changes pulled successfully');
    this.#logTmpDiskUsage('pull');

    // Re-populate submodules after the pull in case the pulled commits
    // changed `.gitmodules` (new submodules, renamed ones, etc). Both
    // helpers are idempotent and swallow submodule errors internally.
    if (byog) {
      await this.#resolveByogSubmodules(clonePath, programId, submodules, { imsOrgId });
    } else {
      // Same org-scoped extraheader as the parent pull — passed via `-c`,
      // never persisted to `.git/config`.
      const standardAuthArgs = this.#buildStandardAuthArgs(programId, repoUrl);
      this.#initStandardSubmodules(clonePath, standardAuthArgs);
    }
  }

  /**
   * Checks out a specific git ref (branch, tag, or SHA) in an existing repository.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} ref - Git ref to checkout (branch, tag, or SHA)
   */
  async checkout(clonePath, ref) {
    this.log.info(`Checking out ref '${ref}' in ${clonePath}`);
    this.#execGit(['checkout', ref], { cwd: clonePath });
  }

  /**
   * Extracts a ZIP buffer into a new unique temp directory.
   * Used to restore a previously-zipped repository from S3
   * for incremental updates (checkout + pull) instead of a full clone.
   *
   * @param {Buffer} zipBuffer - ZIP file content as a Buffer
   * @returns {Promise<string>} Path to the extracted repository
   */
  async unzipRepository(zipBuffer) {
    const extractPath = mkdtempSync(path.join(os.tmpdir(), CLONE_DIR_PREFIX));
    try {
      await extract(zipBuffer, extractPath, { safeSymlinksOnly: true });
      this.log.info(`Repository extracted to ${extractPath}`);
      this.#logTmpDiskUsage('unzip');
      return extractPath;
    } catch (error) {
      rmSync(extractPath, { recursive: true, force: true });
      throw new Error(`Failed to unzip repository: ${error.message}`);
    }
  }

  /**
   * Removes a cloned repository from the temp directory.
   * @param {string} clonePath - Path to remove
   */
  async cleanup(clonePath) {
    const expectedPrefix = path.join(os.tmpdir(), CLONE_DIR_PREFIX);
    if (!clonePath || !clonePath.startsWith(expectedPrefix)) {
      throw new Error(`Invalid clone path for cleanup: ${clonePath}. Must be a cm-repo temp directory.`);
    }

    if (existsSync(clonePath)) {
      rmSync(clonePath, { recursive: true, force: true });
      this.log.info(`Cleaned up ${clonePath}`);
    }
  }

  /**
   * PR/MR path patterns per git provider.
   * Maps CM_REPO_TYPE to the URL path template used for pull/merge requests.
   */
  #PR_PATH_BY_PROVIDER = Object.freeze({
    [CM_REPO_TYPE.GITHUB]: (n) => `/pull/${n}`,
    [CM_REPO_TYPE.GITLAB]: (n) => `/-/merge_requests/${n}`,
    [CM_REPO_TYPE.AZURE_DEVOPS]: (n) => `/pullrequest/${n}`,
    [CM_REPO_TYPE.BITBUCKET]: (n) => `/pull-requests/${n}`,
  });

  /**
   * Builds the pull request URL from the external repo URL and PR number.
   * Detects the git provider from the repo URL to use the correct path format.
   * Returns null if the provider is not recognized.
   *
   * @param {string} repoUrl - External repository URL (e.g. https://github.com/owner/repo.git)
   * @param {string} externalNumber - PR/MR number from the CM API response
   * @returns {string|null} Full pull request URL, or null if provider is unsupported
   */
  #buildPullRequestUrl(repoUrl, externalNumber) {
    let provider = null;
    if (repoUrl.includes('github.com') || repoUrl.includes('github.')) {
      provider = CM_REPO_TYPE.GITHUB;
    } else if (repoUrl.includes('gitlab.com') || repoUrl.includes('gitlab.')) {
      provider = CM_REPO_TYPE.GITLAB;
    } else if (repoUrl.includes('dev.azure.com') || repoUrl.includes('visualstudio.com')) {
      provider = CM_REPO_TYPE.AZURE_DEVOPS;
    } else if (repoUrl.includes('bitbucket.org')) {
      provider = CM_REPO_TYPE.BITBUCKET;
    }

    const pathBuilder = provider && this.#PR_PATH_BY_PROVIDER[provider];
    if (!pathBuilder) {
      return null;
    }

    const baseUrl = repoUrl.replace(/\.git$/, '');
    return `${baseUrl}${pathBuilder(externalNumber)}`;
  }

  /**
   * Creates a pull request in a CM repository via the CM Repo REST API.
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - PR configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.destinationBranch - Branch to merge into (base)
   * @param {string} config.sourceBranch - Branch that contains the changes (head)
   * @param {string} config.title - PR title
   * @param {string} config.description - PR description
   * @param {string} [config.repoUrl] - External repository URL (e.g. https://github.com/owner/repo.git)
   *   Used to construct the pullRequestUrl from the CM API response's externalNumber.
   * @returns {Promise<Object>} CM API response augmented with pullRequestUrl
   */
  async createPullRequest(programId, repositoryId, {
    imsOrgId, destinationBranch, sourceBranch, title, description, repoUrl,
  }) {
    const { access_token: token } = await this.imsClient.getServiceAccessToken();
    const url = `${this.config.cmRepoUrl}/api/program/${programId}/repository/${repositoryId}/pullRequests`;

    this.log.info(`Creating PR for program=${programId}, repo=${repositoryId}: ${title}`);

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': this.config.clientId,
        'x-gw-ims-org-id': imsOrgId,
      },
      body: JSON.stringify({
        title,
        sourceBranch,
        destinationBranch,
        description,
      }),
    };

    // Attempt the create, retrying ONCE on a transient failure (5xx / 429 /
    // network error) after a short wait. Permanent failures (4xx other than
    // 429) throw immediately without a retry.
    let response;
    for (let attempt = 1; attempt <= CM_PR_MAX_ATTEMPTS; attempt += 1) {
      response = undefined;
      let transient = false;
      let failureDetail;
      try {
        // eslint-disable-next-line no-await-in-loop
        response = await fetch(url, fetchOptions);
        if (response.ok) {
          break;
        }
        // eslint-disable-next-line no-await-in-loop
        const errorText = await response.text();
        failureDetail = `HTTP ${response.status} - ${errorText}`;
        transient = isTransientStatus(response.status);
        if (!transient) {
          throw new Error(`Pull request creation failed: ${failureDetail}`);
        }
      } catch (err) {
        // Re-throw permanent HTTP failures immediately; a thrown fetch (network
        // /timeout) has no response and is treated as transient.
        if (response && !transient) {
          throw err;
        }
        transient = true;
        failureDetail = err.message;
      }

      if (attempt >= CM_PR_MAX_ATTEMPTS) {
        throw new Error(
          `Pull request creation failed after ${CM_PR_MAX_ATTEMPTS} attempts: ${failureDetail}`,
        );
      }
      this.log.warn(
        `Transient failure creating PR (attempt ${attempt}/${CM_PR_MAX_ATTEMPTS}): ${failureDetail}. `
        + `Retrying in ${CM_PR_RETRY_DELAY_MS}ms.`,
      );
      // eslint-disable-next-line no-await-in-loop
      await sleep(CM_PR_RETRY_DELAY_MS);
    }

    const result = await response.json();

    // Construct pullRequestUrl from external repo URL and PR number
    if (result.externalNumber && hasText(repoUrl)) {
      const prUrl = this.#buildPullRequestUrl(repoUrl, result.externalNumber);
      if (prUrl) {
        result.pullRequestUrl = prUrl;
      }
    }

    return result;
  }
}
