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
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync,
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
const ZIP_DIR_PREFIX = 'cm-zip-';
const GIT_OPERATION_TIMEOUT_MS = 120_000; // 120s — fail fast before Lambda timeout

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
   * - Standard repos: Basic auth header via extraheader on the repo origin (scheme + host + '/'),
   *   so the header is applied to all paths on that host, including submodule URLs
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
      const repoOrigin = `${new URL(repoUrl).origin}/`;
      return [
        '-c', `http.${repoOrigin}.extraheader=Authorization: Basic ${basicAuth}`,
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
   * @returns {Promise<string>} The local clone path
   */
  async clone(programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref,
  } = {}) {
    const clonePath = mkdtempSync(path.join(os.tmpdir(), CLONE_DIR_PREFIX));

    try {
      this.log.info(`Cloning CM repository: program=${programId}, repo=${repositoryId}, type=${repoType}`);

      const args = await this.#buildAuthGitArgs('clone', programId, repositoryId, { imsOrgId, repoType, repoUrl });
      this.#execGit([...args, '--recurse-submodules', clonePath]);
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

      return clonePath;
    } catch (error) {
      rmSync(clonePath, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Recursively validates that all symlinks under rootDir point to targets
   * within rootDir. Throws if any symlink escapes the root boundary.
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

    // zip-lib is path-based (not buffer-based like adm-zip), so we write to
    // a temp file and read the result back into a Buffer for the caller.
    const zipDir = mkdtempSync(path.join(os.tmpdir(), ZIP_DIR_PREFIX));
    const zipFile = path.join(zipDir, 'repo.zip');

    try {
      this.log.info(`Zipping repository at ${clonePath}`);
      this.#validateSymlinks(clonePath, clonePath);
      await archiveFolder(clonePath, zipFile, { followSymlinks: false });
      this.#logTmpDiskUsage('zip');
      return readFileSync(zipFile);
    } catch (error) {
      throw new Error(`Failed to zip repository: ${error.message}`);
    } finally /* c8 ignore next */ {
      rmSync(zipDir, { recursive: true, force: true });
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
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Pull configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL
   * @param {string} [config.ref] - Optional. Git ref to checkout before pull (branch, tag, or SHA)
   */
  async pull(clonePath, programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref,
  } = {}) {
    if (hasText(ref)) {
      this.#execGit(['checkout', ref], { cwd: clonePath });
      this.log.info(`Checked out ref '${ref}' before pull`);
    }
    const pullArgs = await this.#buildAuthGitArgs('pull', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    this.#execGit(pullArgs, { cwd: clonePath });
    this.log.info('Changes pulled successfully');
    this.#logTmpDiskUsage('pull');
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
    // zip-lib is path-based, so we write the buffer to a temp file for extraction.
    // zipDir is created inside the try block to avoid leaking extractPath if it fails.
    let zipDir;
    try {
      zipDir = mkdtempSync(path.join(os.tmpdir(), ZIP_DIR_PREFIX));
      const zipFile = path.join(zipDir, 'repo.zip');
      writeFileSync(zipFile, zipBuffer);
      await extract(zipFile, extractPath);
      this.#validateSymlinks(extractPath, extractPath);
      this.log.info(`Repository extracted to ${extractPath}`);
      this.#logTmpDiskUsage('unzip');
      return extractPath;
    } catch (error) {
      rmSync(extractPath, { recursive: true, force: true });
      throw new Error(`Failed to unzip repository: ${error.message}`);
    } finally /* c8 ignore next */ {
      if (zipDir) {
        rmSync(zipDir, { recursive: true, force: true });
      }
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
