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
  existsSync, rmSync, writeFileSync, unlinkSync,
} from 'fs';
import { hasText, tracingFetch as fetch } from '@adobe/spacecat-shared-utils';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import archiver from 'archiver';

const GIT_BIN = '/opt/bin/git';
const CLONE_PATH_PREFIX = '/tmp/cm-repo-';
const IMS_TOKEN_ENDPOINT = '/ims/token/v4';
const ASO_CM_REPO_SERVICE_IMS_CLIENT_ID = 'aso-cm-repo-service';

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
  const match = s3Path.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid S3 path: ${s3Path}. Expected format: s3://bucket/key`);
  }
  return { bucket: match[1], key: match[2] };
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

    return new CloudManagerClient({
      imsHost,
      clientId,
      clientSecret,
      clientCode,
      cmRepoUrl,
      gitUsername,
      gitUserEmail,
    }, context.s3?.s3Client, log);
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
   * Builds the git -c http.extraheader arguments for CM repo auth.
   * @param {string} imsOrgId - IMS Organization ID
   * @returns {Promise<string[]>} Array of git config args
   */
  async #getGitConfigArgs(imsOrgId) {
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
      // Sanitize token from error output
      /* c8 ignore next 2 */
      const sanitized = (error.stderr || error.message || '').replace(/Bearer [^\s"]+/g, 'Bearer [REDACTED]');
      this.log.error(`Git command failed: ${sanitized}`);
      throw new Error(`Git command failed: ${sanitized}`);
    }
  }

  /**
   * Clones a Cloud Manager repository to /tmp.
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {string} imsOrgId - IMS Organization ID
   * @returns {Promise<string>} The local clone path
   */
  async clone(programId, repositoryId, imsOrgId) {
    const clonePath = `${CLONE_PATH_PREFIX}${programId}-${repositoryId}`;

    // Clean up if path exists from a previous invocation
    if (existsSync(clonePath)) {
      this.log.debug(`Removing existing clone at ${clonePath}`);
      rmSync(clonePath, { recursive: true, force: true });
    }

    const configArgs = await this.#getGitConfigArgs(imsOrgId);
    const repoUrl = this.#getRepoUrl(programId, repositoryId);

    this.log.info(`Cloning CM repository: program=${programId}, repo=${repositoryId}`);
    const fullArgs = [...configArgs, 'clone', repoUrl, clonePath];
    this.#execGit(fullArgs);
    this.log.info(`Repository cloned to ${clonePath}`);

    return clonePath;
  }

  /**
   * Zips the entire cloned repository including .git history.
   * Downstream services that read the ZIP from S3 need the full git history.
   * @param {string} clonePath - Path to the cloned repository
   * @returns {Promise<Buffer>} ZIP file as a Buffer
   */
  async zipRepository(clonePath) {
    /* c8 ignore start */
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
    /* c8 ignore end */
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
    const patchFile = `/tmp/cm-patch-${Date.now()}.patch`;
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
      // Clean up temp patch file
      if (existsSync(patchFile)) {
        unlinkSync(patchFile);
      }
    }
  }

  /**
   * Pushes the current branch to the remote CM repository.
   * Commits are expected to already exist (e.g. via git am in applyPatch).
   * @param {string} clonePath - Path to the cloned repository
   * @param {string} programId - CM Program ID
   * @param {string} repositoryId - CM Repository ID
   * @param {string} imsOrgId - IMS Organization ID
   */
  async push(clonePath, programId, repositoryId, imsOrgId) {
    const configArgs = await this.#getGitConfigArgs(imsOrgId);
    const repoUrl = this.#getRepoUrl(programId, repositoryId);
    this.#execGit([...configArgs, 'push', repoUrl], { cwd: clonePath });

    this.log.info('Changes pushed successfully');
  }

  /**
   * Removes a cloned repository from /tmp.
   * @param {string} clonePath - Path to remove
   */
  async cleanup(clonePath) {
    if (!clonePath || !clonePath.startsWith(CLONE_PATH_PREFIX)) {
      throw new Error(`Invalid clone path for cleanup: ${clonePath}. Must start with ${CLONE_PATH_PREFIX}`);
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
   * @param {string} imsOrgId - IMS Organization ID
   * @param {Object} options - PR options
   * @param {string} options.destinationBranch - Branch to merge into (base)
   * @param {string} options.sourceBranch - Branch that contains the changes (head)
   * @param {string} options.title - PR title
   * @param {string} options.description - PR description
   * @returns {Promise<Object>}
   */
  async createPullRequest(programId, repositoryId, imsOrgId, {
    destinationBranch, sourceBranch, title, description,
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
