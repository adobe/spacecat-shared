/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import OAuthCredentialManager from './oauth-credential-manager.js';

/**
 * Maps provider identifiers to their CredentialManager implementation.
 * To add a new auth model (e.g. PatCredentialManager for jira_corp):
 *   1. Implement the manager class
 *   2. Add one entry here — no other changes needed in this factory
 */
const CREDENTIAL_MAP = {
  jira_cloud: OAuthCredentialManager,
};

/**
 * Factory that instantiates the correct CredentialManager for a given provider.
 * v1: OAuth only (jira_cloud).
 * v2: add PatCredentialManager for jira_corp.
 */
export default class CredentialManagerFactory {
  static create(provider, smClient, secretPath, httpClient, log) {
    const ManagerClass = CREDENTIAL_MAP[provider];

    if (!ManagerClass) {
      throw new Error(`Unsupported provider for CredentialManagerFactory: ${provider}`);
    }

    return new ManagerClass(smClient, secretPath, httpClient, log);
  }
}
