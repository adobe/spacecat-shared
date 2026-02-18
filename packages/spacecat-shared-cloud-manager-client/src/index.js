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
  existsSync, mkdtempSync, rmSync, writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';

const GIT_BIN = '/opt/bin/git';
const CLONE_DIR_PREFIX = 'cm-repo-';
const PATCH_FILE_PREFIX = 'cm-patch-';
const IMS_TOKEN_ENDPOINT = '/ims/token/v4';
const ASO_CM_REPO_SERVICE_IMS_CLIENT_ID = 'aso-cm-repo-service';
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

    return new CloudManagerClient({
      imsHost,
      clientId,
      clientSecret,
      clientCode,
      cmRepoUrl,
      standardRepoCredentials,
      gitUsername,
      gitUserEmail,
    }, s3Client, log);
  }

  constructor(config, s3Client, log = console) {
    this.config = config;
    this.s3Client = s3Client;
    this.log = log;
    this.accessToken = null;
  }

  // --- Private helpers ---

  /**
   * Obtains an IMS access token, caching it for the session.
   * @returns {Promise<string>} The access token string
   */
  async #getAccessToken() {
    if (hasText(this.accessToken)) {
      return this.accessToken;
    }

    const {
      imsHost, clientId, clientSecret, clientCode,
    } = this.config;

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: clientCode,
      grant_type: 'authorization_code',
    });

    const response = await fetch(`https://${imsHost}${IMS_TOKEN_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`IMS token request failed with status: ${response.status}`);
    }

    const { access_token: accessToken } = await response.json();
    this.accessToken = accessToken;
    this.log.debug('Successfully obtained IMS access token for Cloud Manager');

    return this.accessToken;
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
    const token = await this.#getAccessToken();
    const { cmRepoUrl } = this.config;

    return [
      '-c', `http.${cmRepoUrl}.extraheader=Authorization: Bearer ${token}`,
      '-c', `http.${cmRepoUrl}.extraheader=x-api-key: ${ASO_CM_REPO_SERVICE_IMS_CLIENT_ID}`,
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
      return execFileSync(GIT_BIN, args, { encoding: 'utf-8', env: GIT_ENV, ...options });
    } catch (error) {
      // Sanitize tokens and credentials from error output
      const sanitized = (error.stderr || error.message)
        ?.replace(/Bearer [^\s"]+/g, 'Bearer [REDACTED]')
        ?.replace(/:\/\/[^@]+@/g, '://***@');
      this.log.error(`Git command failed: ${sanitized}`);
      throw new Error(`Git command failed: ${sanitized}`);
    }
  }

  /**
   * Builds authenticated git arguments for a remote command (clone or push).
   *
   * For standard repos: returns [command, basicAuthUrl]
   * For BYOG repos: returns [...configArgs, command, byogRepoUrl]
   *
   * @param {string} command - The git command ('clone' or 'push')
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Repository auth configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL (required for standard repos)
   * @returns {Promise<string[]>} Array of git arguments
   */
  async #buildAuthGitArgs(command, programId, repositoryId, { imsOrgId, repoType, repoUrl } = {}) {
    if (repoType === CM_REPO_TYPE.STANDARD) {
      const credentials = this.#getStandardRepoCredentials(programId);
      const urlWithoutProtocol = repoUrl.replace(/^https?:\/\//, '');
      const authUrl = `https://${credentials}@${urlWithoutProtocol}`;
      return [command, authUrl];
    }

    const cmRepoServiceCredentials = await this.#getCMRepoServiceCredentials(imsOrgId);
    const byogRepoUrl = this.#getRepoUrl(programId, repositoryId);
    return [...cmRepoServiceCredentials, command, byogRepoUrl];
  }

  /**
   * Clones a Cloud Manager repository to /tmp.
   *
   * For BYOG repos: uses Bearer token extraheaders via CM_REPO_URL.
   * For standard repos: uses basic-auth credentials embedded in the URL.
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
   * @param {string} config.repoUrl - Repository URL (required for standard repos)
   * @param {string} [config.ref] - Optional. Git ref to checkout after clone (branch, tag, or SHA)
   * @returns {Promise<string>} The local clone path
   */
  async clone(programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref,
  } = {}) {
    const clonePath = mkdtempSync(path.join(os.tmpdir(), CLONE_DIR_PREFIX));

    this.log.info(`Cloning CM repository: program=${programId}, repo=${repositoryId}, type=${repoType}`);

    const args = await this.#buildAuthGitArgs('clone', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    this.#execGit([...args, clonePath]);
    this.log.info(`Repository cloned to ${clonePath}`);

    // For standard repos the clone URL contains basic-auth credentials
    // (https://user:token@host/...). Strip them from the stored remote
    // so that `git remote -v` never exposes secrets.
    if (repoType === CM_REPO_TYPE.STANDARD && hasText(repoUrl)) {
      this.#execGit(['remote', 'set-url', 'origin', repoUrl], { cwd: clonePath });
      this.log.debug('Replaced origin URL with credential-free repoUrl');
    }

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

    this.log.info(`Zipping repository at ${clonePath}`);
    return new Promise((resolve, reject) => {
      const chunks = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', (err) => reject(err));

      archive.glob('**/*', {
        cwd: clonePath,
        dot: true,
      });

      archive.finalize();
    });
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
   * Downloads a patch from S3 and applies it to the given branch using git am.
   * The patch is expected to contain commit metadata (author, date, message),
   * so git am will create the commit automatically.
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} branch - Branch to apply the patch on
   * @param {string} s3PatchPath - S3 URI of the patch file (s3://bucket/key)
   */
  async applyPatch(clonePath, branch, s3PatchPath) {
    const { bucket, key } = parseS3Path(s3PatchPath);
    const patchDir = mkdtempSync(path.join(os.tmpdir(), PATCH_FILE_PREFIX));
    const patchFile = path.join(patchDir, 'applied.patch');
    const { gitUsername, gitUserEmail } = this.config;

    try {
      // Download patch from S3
      this.log.info(`Downloading patch from s3://${bucket}/${key}`);
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await this.s3Client.send(command);
      const patchContent = await response.Body.transformToString();
      writeFileSync(patchFile, patchContent);

      // Configure committer identity for git am
      this.#execGit(['config', 'user.name', gitUsername], { cwd: clonePath });
      this.#execGit(['config', 'user.email', gitUserEmail], { cwd: clonePath });

      // Checkout branch and apply patch with commit
      this.#execGit(['checkout', branch], { cwd: clonePath });
      this.#execGit(['am', patchFile], { cwd: clonePath });
      this.log.info(`Patch applied and committed on branch ${branch}`);
    } finally {
      // Clean up temp patch directory and file
      if (existsSync(patchDir)) {
        rmSync(patchDir, { recursive: true, force: true });
      }
    }
  }

  /**
   * Pushes the current branch to the remote CM repository.
   * Commits are expected to already exist (e.g. via git am in applyPatch).
   *
   * For BYOG repos: uses Bearer token extraheaders.
   * For standard repos: uses basic-auth credentials embedded in the URL.
   *
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - Push configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.repoType - Repository type ('standard' or VCS type)
   * @param {string} config.repoUrl - Repository URL (required for standard repos)
   * @param {string} config.ref - Git ref (branch) to push
   */
  async push(clonePath, programId, repositoryId, {
    imsOrgId, repoType, repoUrl, ref,
  } = {}) {
    const pushArgs = await this.#buildAuthGitArgs('push', programId, repositoryId, { imsOrgId, repoType, repoUrl });
    pushArgs.push(ref);
    this.#execGit(pushArgs, { cwd: clonePath });
    this.log.info('Changes pushed successfully');
  }

  /**
   * Pulls the latest changes from the remote CM repository into an existing clone.
   *
   * For BYOG repos: uses Bearer token extraheaders.
   * For standard repos: uses basic-auth credentials embedded in the URL.
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
   * @param {string} config.repoUrl - Repository URL (required for standard repos)
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
    const zipFile = path.join(extractPath, 'repository.zip');

    try {
      writeFileSync(zipFile, zipBuffer);
      execFileSync('unzip', ['-o', '-q', zipFile, '-d', extractPath], { encoding: 'utf-8' });
      rmSync(zipFile);
      this.log.info(`Repository extracted to ${extractPath}`);
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
   * Creates a pull request in a CM repository via the CM Repo REST API.
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {Object} config - PR configuration
   * @param {string} config.imsOrgId - IMS Organization ID
   * @param {string} config.destinationBranch - Branch to merge into (base)
   * @param {string} config.sourceBranch - Branch that contains the changes (head)
   * @param {string} config.title - PR title
   * @param {string} config.description - PR description
   * @returns {Promise<Object>}
   */
  async createPullRequest(programId, repositoryId, {
    imsOrgId, destinationBranch, sourceBranch, title, description,
  }) {
    const token = await this.#getAccessToken();
    const url = `${this.config.cmRepoUrl}/api/program/${programId}/repository/${repositoryId}/pullRequests`;

    this.log.info(`Creating PR for program=${programId}, repo=${repositoryId}: ${title}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-api-key': ASO_CM_REPO_SERVICE_IMS_CLIENT_ID,
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

    return response.json();
  }
}
