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
import sinon from 'sinon';
import TicketClientFactory from '../src/ticket-client-factory.js';
import JiraCloudClient from '../src/clients/jira-cloud-client.js';
import CredentialManagerFactory from '../src/credentials/credential-manager-factory.js';

function makeSmClient() {
  return { getSecretValue: sinon.stub(), putSecretValue: sinon.stub() };
}
function makeHttpClient() {
  return { fetch: sinon.stub() };
}
function makeLog() {
  return {
    info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
  };
}

// instanceUrl is a top-level DB column (instance_url); siteUrl lives there, not in metadata JSONB.
// metadata JSONB only holds provider-specific fields (cloudId, scopes for jira_cloud).
const VALID_CONNECTION = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  organizationId: 'ffffffff-0000-1111-2222-333333333333',
  provider: 'jira_cloud',
  instanceUrl: 'https://example.atlassian.net',
  metadata: {
    cloudId: '11111111-2222-3333-4444-555555555555',
  },
};

describe('TicketClientFactory', () => {
  beforeEach(() => {
    process.env.JIRA_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.JIRA_OAUTH_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    delete process.env.JIRA_OAUTH_CLIENT_ID;
    delete process.env.JIRA_OAUTH_CLIENT_SECRET;
  });

  it('creates a JiraCloudClient for jira_cloud provider', () => {
    const client = TicketClientFactory.create(
      VALID_CONNECTION,
      makeSmClient(),
      makeHttpClient(),
      makeLog(),
    );
    expect(client).to.be.instanceOf(JiraCloudClient);
  });

  it('throws for unsupported provider', () => {
    expect(() => TicketClientFactory.create(
      { ...VALID_CONNECTION, provider: 'asana' },
      makeSmClient(),
      makeHttpClient(),
      makeLog(),
    )).to.throw('Unsupported ticket provider: asana');
  });

  it('throws when organizationId is not a UUID (path traversal guard)', () => {
    expect(() => TicketClientFactory.create(
      { ...VALID_CONNECTION, organizationId: '../etc/passwd' },
      makeSmClient(),
      makeHttpClient(),
      makeLog(),
    )).to.throw('Invalid path segment: organizationId and connectionId must be UUIDs');
  });

  it('throws when connectionId is not a UUID (path traversal guard)', () => {
    expect(() => TicketClientFactory.create(
      { ...VALID_CONNECTION, id: 'conn-uuid-not-valid' },
      makeSmClient(),
      makeHttpClient(),
      makeLog(),
    )).to.throw('Invalid path segment: organizationId and connectionId must be UUIDs');
  });
});

describe('CredentialManagerFactory', () => {
  beforeEach(() => {
    process.env.JIRA_OAUTH_CLIENT_ID = 'test-client-id';
    process.env.JIRA_OAUTH_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    delete process.env.JIRA_OAUTH_CLIENT_ID;
    delete process.env.JIRA_OAUTH_CLIENT_SECRET;
  });

  it('creates OAuthCredentialManager for jira_cloud', () => {
    const manager = CredentialManagerFactory.create(
      'jira_cloud',
      makeSmClient(),
      '/test/path',
      makeHttpClient(),
      makeLog(),
    );
    expect(manager).to.have.property('getAuthHeaders');
  });

  it('throws for unsupported provider', () => {
    expect(() => CredentialManagerFactory.create(
      'jira_corp',
      makeSmClient(),
      '/test/path',
      makeHttpClient(),
      makeLog(),
    )).to.throw('Unsupported provider for CredentialManagerFactory: jira_corp');
  });
});
