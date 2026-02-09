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

export interface PullRequestOptions {
  base: string;
  head: string;
  title: string;
  description: string;
}

export default class CloudManagerClient {
  static createFrom(context: UniversalContext): CloudManagerClient;

  clone(programId: string, repositoryId: string, imsOrgId: string): Promise<string>;
  zipRepository(clonePath: string): Promise<Buffer>;
  createBranch(clonePath: string, baseBranch: string, newBranch: string): Promise<void>;
  applyPatch(clonePath: string, branch: string, s3PatchPath: string): Promise<void>;
  commitAndPush(
    clonePath: string,
    message: string,
    programId: string,
    repositoryId: string,
    imsOrgId: string,
  ): Promise<void>;
  cleanup(clonePath: string): Promise<void>;

  getRepositories(programId: string, imsOrgId: string): Promise<object>;
  getTenants(imsOrgId: string): Promise<object>;
  createPullRequest(
    programId: string,
    repositoryId: string,
    imsOrgId: string,
    options: PullRequestOptions,
  ): Promise<object>;
}
