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

import { UniversalContext } from '@adobe/helix-universal';

export declare const CM_REPO_TYPE: Readonly<{
  GITHUB: 'github';
  BITBUCKET: 'bitbucket';
  GITLAB: 'gitlab';
  AZURE_DEVOPS: 'azure_devops';
  STANDARD: 'standard';
}>;

export interface CloneConfig {
  imsOrgId: string;
  repoType: string;
  repoUrl: string;
  ref?: string;
}

export interface PushConfig {
  imsOrgId: string;
  repoType: string;
  repoUrl: string;
  ref: string;
}

export interface PullConfig {
  imsOrgId: string;
  repoType: string;
  repoUrl: string;
  ref?: string;
}

export interface PullRequestConfig {
  imsOrgId: string;
  destinationBranch: string;
  sourceBranch: string;
  title: string;
  description: string;
}

export default class CloudManagerClient {
  static createFrom(context: UniversalContext): CloudManagerClient;

  clone(programId: string, repositoryId: string, config: CloneConfig): Promise<string>;
  push(clonePath: string, programId: string, repositoryId: string, config: PushConfig): Promise<void>;
  pull(clonePath: string, programId: string, repositoryId: string, config: PullConfig): Promise<void>;
  checkout(clonePath: string, ref: string): Promise<void>;
  unzipRepository(zipBuffer: Buffer): Promise<string>;
  zipRepository(clonePath: string): Promise<Buffer>;
  createBranch(clonePath: string, baseBranch: string, newBranch: string): Promise<void>;
  applyPatch(
    clonePath: string,
    branch: string,
    s3PatchPath: string,
    options?: { commitMessage?: string },
  ): Promise<void>;
  applyPatchContent(
    clonePath: string,
    branch: string,
    patchContent: string,
    commitMessage: string,
  ): Promise<void>;
  applyFiles(
    clonePath: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
  ): Promise<void>;
  cleanup(clonePath: string): Promise<void>;
  createPullRequest(
    programId: string,
    repositoryId: string,
    config: PullRequestConfig,
  ): Promise<object>;
}
