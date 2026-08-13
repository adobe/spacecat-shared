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

import { expect } from 'chai';
import {
  TicketClientFactory,
  JiraCloudClient,
  BaseTicketClient,
  OAuthCredentialManager,
  CredentialManagerFactory,
  RateLimitAwareHttpClient,
} from '../src/index.js';

describe('index exports', () => {
  it('exports all public symbols', () => {
    expect(TicketClientFactory).to.be.a('function');
    expect(JiraCloudClient).to.be.a('function');
    expect(BaseTicketClient).to.be.a('function');
    expect(OAuthCredentialManager).to.be.a('function');
    expect(CredentialManagerFactory).to.be.a('function');
    expect(RateLimitAwareHttpClient).to.be.a('function');
  });
});
