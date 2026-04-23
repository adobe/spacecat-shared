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
 * Returns true for any repo type that tunnels through the CM repo service
 * proxy (i.e. anything other than STANDARD). BYOG repos need extra handling
 * for submodules because the proxy URL uses numeric repository IDs, not
 * names — relative URLs in .gitmodules must be rewritten via a onboarding-
 * populated name→id map (`site.code.metadata.submodules.cmProgramRepos`).
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
      const credentials = this.#getStandardRepoCredentials(programId);
      const basicAuth = Buffer.from(credentials).toString('base64');
      const parsedUrl = new URL(repoUrl);
      const orgName = parsedUrl.pathname.split('/')[1];
      const repoOrgPrefix = `${parsedUrl.origin}/${orgName}/`;
      return [
        '-c', `http.${repoOrgPrefix}.extraheader=Authorization: Basic ${basicAuth}`,
        command, repoUrl,
      ];
    }

    const cmRepoServiceCredentials = await this.#getCMRepoServiceCredentials(imsOrgId);
    const byogRepoUrl = this.#getRepoUrl(programId, repositoryId);
    return [...cmRepoServiceCredentials, command, byogRepoUrl];
  }

  /**
   * Clones a Cloud Manager repository to /tmp.
   *
   * Both repo types authenticate via http.extraheader (no credentials in the URL):
   * - BYOG repos: Bearer token + API key + IMS org ID via CM Repo URL
   * - Standard repos: Basic auth header via the repo URL
   *
   * Submodule handling differs by repo type:
   * - STANDARD: `--recurse-submodules` at clone time. .gitmodules URLs resolve
   *   against the customer's real git host, which is what we want.
   * - BYOG: `--no-recurse-submodules` at clone time (auto-recursion would
   *   resolve .gitmodules relative URLs against the CM proxy URL, producing
   *   name-based URLs the proxy rejects). Submodules are populated in a
   *   second step that rewrites URLs to numeric-ID form via the
   *   `cmProgramRepos` map before running `submodule update`.
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
   * @param {Object<string,string>} [config.cmProgramRepos] - Optional. For BYOG
   *   repos only: name → numeric repo id map for every repo in the CM program.
   *   Populated at onboarding from `GET /api/program/{pid}/repositories`.
   *   Used to rewrite relative submodule URLs into the numeric-id form the
   *   CM proxy can serve. Ignored for STANDARD repos.
   * @returns {Promise<string>} The local clone path
   */
  async clone(programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref, cmProgramRepos,
  } = {}) {
    const clonePath = mkdtempSync(path.join(os.tmpdir(), CLONE_DIR_PREFIX));
    const byog = isBYOG(repoType);

    try {
      this.log.info(`Cloning CM repository: program=${programId}, repo=${repositoryId}, type=${repoType}`);

      const args = await this.#buildAuthGitArgs('clone', programId, repositoryId, { imsOrgId, repoType, repoUrl });
      // BYOG: skip auto-recursion so the initial clone doesn't try (and fail)
      // to fetch submodules via name-based proxy URLs. We populate them in a
      // second pass below once .git/config has been rewritten to numeric IDs.
      const recurseFlag = byog ? '--no-recurse-submodules' : '--recurse-submodules';
      this.#execGit([...args, recurseFlag, clonePath]);
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

      // Populate submodules for the current ref.
      // - STANDARD: only needed when we switched ref above. The initial
      //   --recurse-submodules clone handled the default branch already;
      //   sync+update picks up any new/changed submodules introduced by the
      //   ref switch.
      // - BYOG: always needed. The initial --no-recurse-submodules clone
      //   didn't populate any submodules on any branch.
      if (byog) {
        await this.#resolveByogSubmodules(clonePath, programId, cmProgramRepos, { imsOrgId });
      } else if (hasText(ref)) {
        this.#initStandardSubmodules(clonePath);
      }

      return clonePath;
    } catch (error) {
      rmSync(clonePath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * For STANDARD repos after a ref checkout: pick up any submodules the ref
   * declares but weren't initialized by the initial `--recurse-submodules`
   * clone. Uses `sync` to refresh any URL changes between branches and
   * `update --init --recursive` to actually fetch and check them out.
   *
   * Safe for standard repos because .gitmodules URLs resolve to the
   * customer's real git host — which is exactly what we want git to use.
   *
   * NOTE: do NOT call this on the BYOG path. BYOG .gitmodules URLs are
   * name-based and require rewriting first; `sync` would overwrite the
   * rewritten entries in .git/config.
   */
  #initStandardSubmodules(clonePath) {
    try {
      this.#execGit(['submodule', 'sync', '--recursive'], { cwd: clonePath });
      this.#execGit(['submodule', 'update', '--init', '--recursive'], { cwd: clonePath });
      this.log.info(`Initialized submodules for standard repo at ${clonePath}`);
    } catch (submoduleError) {
      this.log.warn(`Standard submodule init failed: ${submoduleError.message}. Continuing without submodule recursion.`);
    }
  }

  /**
   * For BYOG repos: initialize submodules by rewriting their name-based URLs
   * (from relative entries in .gitmodules) to the numeric-ID URLs the CM
   * proxy can serve.
   *
   * Flow:
   *   1. `git submodule init` — registers each submodule in .git/config with
   *      a URL git resolved by joining the parent proxy URL with the relative
   *      .gitmodules entry (e.g. `.../repository/<name>`). The proxy rejects
   *      these because it only serves numeric repository IDs.
   *   2. For every registered URL that matches the CM proxy prefix, look up
   *      the submodule's real name in `cmProgramRepos` and overwrite the
   *      .git/config URL with the numeric-id form
   *      (`.../repository/<id>.git`). `.gitmodules` stays untouched.
   *   3. `git submodule update --recursive` — fetches and checks out each
   *      submodule via the now-correct URL stored in .git/config. The same
   *      Bearer + x-api-key + x-gw-ims-org-id extraheader as the parent
   *      clone is re-applied since transient `-c` flags don't carry over.
   *
   * IMPORTANT: never call `git submodule sync` in this flow — sync copies
   * .gitmodules URLs back into .git/config, undoing step 2.
   *
   * Idempotent by design: `submodule init` leaves existing .git/config
   * entries alone, and the rewrite always produces the same numeric-ID URL
   * (since CM repo IDs are stable). This lets `pull()` call it unconditionally
   * after every pull to pick up submodules newly introduced by pulled commits.
   *
   * Graceful fallbacks:
   *   - No .gitmodules: nothing to do.
   *   - No `cmProgramRepos` map: can't rewrite relative URLs. Log a warning;
   *     the subsequent submodule update will fail naturally, but the parent
   *     clone/pull itself is still usable.
   *   - Submodule name not in map: leave its URL unchanged. Likely an
   *     absolute external URL (different host) or a submodule added after
   *     the map was populated.
   */
  async #resolveByogSubmodules(clonePath, programId, cmProgramRepos, { imsOrgId } = {}) {
    if (!existsSync(path.join(clonePath, '.gitmodules'))) {
      return;
    }

    try {
      // Step 1: register submodules in .git/config with name-based URLs
      this.#execGit(['submodule', 'init'], { cwd: clonePath });

      // Step 2: rewrite name-based URLs → numeric-id URLs using the onboarding map
      const hasMap = cmProgramRepos
        && typeof cmProgramRepos === 'object'
        && !Array.isArray(cmProgramRepos)
        && Object.keys(cmProgramRepos).length > 0;

      if (!hasMap) {
        this.log.warn(
          `BYOG program ${programId} has .gitmodules but no cmProgramRepos map — `
          + 'relative submodule URLs cannot be resolved through the CM proxy. '
          + 'Populate site.code.metadata.submodules.cmProgramRepos at onboarding.',
        );
      } else {
        let configOutput = '';
        try {
          configOutput = this.#execGit(
            ['config', '--local', '--get-regexp', '^submodule\\..+\\.url$'],
            { cwd: clonePath },
          );
        } catch {
          // git config --get-regexp exits non-zero when there are no matches.
          // .gitmodules exists but init registered nothing — nothing to rewrite.
          configOutput = '';
        }

        const prefix = `${this.config.cmRepoUrl}/api/program/${programId}/repository/`;
        const lines = configOutput.trim().split('\n').filter(Boolean);
        lines.forEach((line) => {
          const spaceIdx = line.indexOf(' ');
          if (spaceIdx < 0) {
            return;
          }
          const key = line.slice(0, spaceIdx);
          const currentUrl = line.slice(spaceIdx + 1);
          if (!currentUrl.startsWith(prefix)) {
            // Absolute external / SSH / git:// URL — leave alone.
            return;
          }
          const name = currentUrl.slice(prefix.length).replace(/\.git$/, '').replace(/\/$/, '');
          const id = cmProgramRepos[name];
          if (!id) {
            this.log.warn(`BYOG submodule '${name}' not found in cmProgramRepos map — leaving URL unchanged. Submodule fetch will likely fail.`);
            return;
          }
          const newUrl = `${prefix}${id}.git`;
          this.#execGit(['config', '--local', key, newUrl], { cwd: clonePath });
        });
      }

      // Step 3: fetch + check out submodules using the (now-rewritten) URLs.
      // Re-apply auth — transient `-c` flags from the parent clone don't carry
      // into subsequent invocations, and all BYOG submodules share the same
      // CM proxy host as the parent.
      const authArgs = await this.#getCMRepoServiceCredentials(imsOrgId);
      this.#execGit([...authArgs, 'submodule', 'update', '--recursive'], { cwd: clonePath });
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
   * Submodule handling differs by repo type:
   * - STANDARD: `pull --recurse-submodules` updates submodules in one step.
   * - BYOG: pull the parent only, then resolve submodules via the same
   *   name→id rewrite the clone path uses. This also picks up any new
   *   submodules the pull may have introduced.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Pull configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @param {string} [config.ref] - Optional. Git ref to checkout before pull (branch, tag, or SHA)
   * @param {Object<string,string>} [config.cmProgramRepos] - Optional. BYOG-only
   *   name → numeric repo id map for the program. See clone() for details.
   */
  async pull(clonePath, programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref, cmProgramRepos,
  } = {}) {
    const byog = isBYOG(repoType);

    if (hasText(ref)) {
      this.#execGit(['checkout', ref], { cwd: clonePath });
      this.log.info(`Checked out ref '${ref}' before pull`);
    }

    const pullArgs = await this.#buildAuthGitArgs('pull', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    // STANDARD: --recurse-submodules keeps submodules in sync during pull.
    // BYOG: pull the parent only; submodules are handled separately below
    // because relative .gitmodules URLs need rewriting through cmProgramRepos.
    if (byog) {
      this.#execGit(pullArgs, { cwd: clonePath });
    } else {
      this.#execGit([...pullArgs, '--recurse-submodules'], { cwd: clonePath });
    }
    this.log.info('Changes pulled successfully');
    this.#logTmpDiskUsage('pull');

    // For BYOG, re-apply the rewrite after the pull in case the pulled commits
    // changed .gitmodules (new submodules, renamed ones, etc). The helper is
    // idempotent — existing .git/config entries are left alone and only new
    // ones are rewritten.
    if (byog) {
      await this.#resolveByogSubmodules(clonePath, programId, cmProgramRepos, { imsOrgId });
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

    const response = await fetch(url, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pull request creation failed: ${response.status} - ${errorText}`);
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
