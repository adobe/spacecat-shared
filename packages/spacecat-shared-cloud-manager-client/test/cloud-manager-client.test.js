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

import os from 'os';
import path from 'path';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';
import esmock from 'esmock';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

use(chaiAsPromised);
use(sinonChai);

const TEST_ENV = {
  IMS_HOST: 'ims.example.com',
  ASO_CM_REPO_SERVICE_IMS_CLIENT_ID: 'test-client-id',
  ASO_CM_REPO_SERVICE_IMS_CLIENT_SECRET: 'test-client-secret',
  ASO_CM_REPO_SERVICE_IMS_CLIENT_CODE: 'test-client-code',
  CM_REPO_URL: 'https://cm-repo.example.com',
  ASO_CODE_AUTOFIX_USERNAME: 'test-bot',
  ASO_CODE_AUTOFIX_EMAIL: 'test-bot@example.com',
};

const TEST_STANDARD_CREDENTIALS = JSON.stringify({
  12345: 'stduser:stdtoken123',
  99999: 'otheruser:othertoken',
});

const TEST_TOKEN = 'test-access-token-12345';
const TEST_IMS_ORG_ID = 'test-ims-org@AdobeOrg';
const TEST_PROGRAM_ID = '12345';
const TEST_REPO_ID = '67890';
const EXPECTED_CLONE_PATH = `${path.join(os.tmpdir(), 'cm-repo-')}XXXXXX`;
const TEST_STANDARD_REPO_URL = 'https://git.cloudmanager.adobe.com/myorg/myrepo.git';

const s3Mock = mockClient(S3Client);

function createContext(envOverrides = {}) {
  return {
    env: { ...TEST_ENV, ...envOverrides },
    log: {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    },
    s3: {
      s3Client: s3Mock,
    },
  };
}

const mockImsClient = {
  getServiceAccessToken: sinon.stub(),
};
const createFromStub = sinon.stub().returns(mockImsClient);

function setupImsTokenMock() {
  mockImsClient.getServiceAccessToken.resolves({
    access_token: TEST_TOKEN,
    token_type: 'Bearer',
    expires_in: 86400,
  });
}

/**
 * Helper: extracts the git args array from an execFileSync call.
 * execFileSync is called as execFileSync(file, args, options),
 * so call.args[1] is the args array.
 */
function getGitArgs(call) {
  return call.args[1];
}

/**
 * Helper: joins the git args into a single string for easy substring checks.
 */
function getGitArgsStr(call) {
  return call.args[1].join(' ');
}

describe('CloudManagerClient', () => {
  let CloudManagerClient;
  const execFileSyncStub = sinon.stub();
  const existsSyncStub = sinon.stub();
  const mkdirSyncStub = sinon.stub();
  const mkdtempSyncStub = sinon.stub();
  const readdirSyncStub = sinon.stub();
  const readFileSyncStub = sinon.stub().returns(Buffer.from('zip-content'));
  const readlinkSyncStub = sinon.stub();
  const rmSyncStub = sinon.stub();
  const statfsSyncStub = sinon.stub();
  const writeSyncStub = sinon.stub();
  const archiveFolderStub = sinon.stub().resolves(Buffer.from('zip-content'));
  const extractStub = sinon.stub().resolves();

  // esmock's initial module resolution can exceed mocha's default 2s timeout
  // eslint-disable-next-line prefer-arrow-callback
  before(async function () {
    this.timeout(5000);
    const mod = await esmock('../src/index.js', {
      child_process: { execFileSync: execFileSyncStub },
      fs: {
        existsSync: existsSyncStub,
        mkdirSync: mkdirSyncStub,
        mkdtempSync: mkdtempSyncStub,
        readdirSync: readdirSyncStub,
        readFileSync: readFileSyncStub,
        readlinkSync: readlinkSyncStub,
        rmSync: rmSyncStub,
        statfsSync: statfsSyncStub,
        writeFileSync: writeSyncStub,
      },
      'zip-lib': { archiveFolder: archiveFolderStub, extract: extractStub },
    }, {
      '@adobe/spacecat-shared-ims-client': {
        ImsClient: { createFrom: createFromStub },
      },
    });
    CloudManagerClient = mod.default;
  });

  beforeEach(() => {
    execFileSyncStub.reset();
    execFileSyncStub.returns('');
    existsSyncStub.reset();
    existsSyncStub.returns(false);
    mkdirSyncStub.reset();
    mkdtempSyncStub.reset();
    mkdtempSyncStub.callsFake((prefix) => `${prefix}XXXXXX`);
    readdirSyncStub.reset();
    readdirSyncStub.returns([]);
    readFileSyncStub.reset();
    readFileSyncStub.returns(Buffer.from('zip-content'));
    readlinkSyncStub.reset();
    rmSyncStub.reset();
    statfsSyncStub.reset();
    statfsSyncStub.returns({ bsize: 4096, blocks: 131072, bfree: 65536 });
    writeSyncStub.reset();
    archiveFolderStub.reset();
    archiveFolderStub.resolves(Buffer.from('zip-content'));
    extractStub.reset();
    extractStub.resolves();
    createFromStub.reset();
    createFromStub.returns(mockImsClient);
    mockImsClient.getServiceAccessToken.reset();
    setupImsTokenMock();
    nock.cleanAll();
    s3Mock.reset();
  });

  afterEach(() => {
    nock.cleanAll();
    s3Mock.reset();
  });

  describe('createFrom', () => {
    it('creates an instance with valid context', () => {
      const client = CloudManagerClient.createFrom(createContext());
      expect(client).to.be.instanceOf(CloudManagerClient);
    });

    it('creates an instance with standard repo credentials', () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );
      expect(client).to.be.instanceOf(CloudManagerClient);
    });

    it('throws when IMS env vars are missing', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ ASO_CM_REPO_SERVICE_IMS_CLIENT_ID: '' }),
      )).to.throw('CloudManagerClient requires IMS_HOST');
    });

    it('throws when CM_REPO_URL is missing', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ CM_REPO_URL: '' }),
      )).to.throw('CloudManagerClient requires CM_REPO_URL');
    });

    it('throws when git user config is missing', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ ASO_CODE_AUTOFIX_USERNAME: '' }),
      )).to.throw('CloudManagerClient requires ASO_CODE_AUTOFIX_USERNAME');
    });

    it('throws when S3 client is missing', () => {
      const context = createContext();
      delete context.s3;
      expect(() => CloudManagerClient.createFrom(context))
        .to.throw('CloudManagerClient requires S3 client');
    });

    it('throws when CM_STANDARD_REPO_CREDENTIALS is invalid JSON', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: 'not-valid-json' }),
      )).to.throw('CM_STANDARD_REPO_CREDENTIALS must be valid JSON');
    });
  });

  describe('IMS token', () => {
    it('delegates token fetching to ImsClient', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });
      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      // ImsClient.getServiceAccessToken called for each BYOG operation
      // (ImsClient handles caching internally)
      expect(mockImsClient.getServiceAccessToken).to.have.been.calledTwice;
      expect(execFileSyncStub).to.have.been.calledTwice;
    });

    it('throws when ImsClient token request fails', async () => {
      mockImsClient.getServiceAccessToken.rejects(new Error('IMS getServiceAccessToken request failed with status: 401'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('IMS getServiceAccessToken request failed with status: 401');
    });
  });

  describe('clone', () => {
    it('clones BYOG repository with correct git command and headers', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID },
      );

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      // BYOG: only clone call, no set-url needed (no credentials in URL)
      expect(execFileSyncStub).to.have.been.calledOnce;

      expect(execFileSyncStub.firstCall.args[0]).to.equal('/opt/bin/git');

      const gitArgs = getGitArgs(execFileSyncStub.firstCall);
      const gitArgsStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(gitArgsStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(gitArgsStr).to.include('x-api-key: test-client-id');
      expect(gitArgsStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
      expect(gitArgsStr).to.include(`${TEST_ENV.CM_REPO_URL}/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}.git`);
      expect(gitArgs).to.include(EXPECTED_CLONE_PATH);
    });

    it('clones standard repository with Basic auth extraheader', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      );

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      // Standard: single clone call (no set-url needed — credentials are in extraheader, not URL)
      expect(execFileSyncStub).to.have.been.calledOnce;

      const cloneArgs = getGitArgs(execFileSyncStub.firstCall);
      const cloneArgsStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(cloneArgs).to.include('clone');
      expect(cloneArgsStr).to.include(`http.${TEST_STANDARD_REPO_URL}.extraheader=Authorization: Basic c3RkdXNlcjpzdGR0b2tlbjEyMw==`);
      expect(cloneArgsStr).to.include(TEST_STANDARD_REPO_URL);
      expect(cloneArgs).to.include(EXPECTED_CLONE_PATH);
      // No credentials in the URL itself
      expect(cloneArgsStr).to.not.include('stduser:stdtoken123@');
      expect(cloneArgsStr).to.not.include('Bearer');
    });

    it('throws when standard credentials not found for programId', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      await expect(client.clone(
        '00000',
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      )).to.be.rejectedWith('No standard repo credentials found for programId: 00000');
    });

    it('creates a unique temp directory via mkdtempSync', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-repo-$/);
    });

    it('checks out ref after clone when ref is provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID, ref: 'release/5.11' },
      );

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      // First call: clone, second call: checkout
      expect(execFileSyncStub).to.have.been.calledTwice;

      const checkoutArgs = getGitArgs(execFileSyncStub.secondCall);
      expect(checkoutArgs).to.deep.equal(['checkout', 'release/5.11']);
      expect(execFileSyncStub.secondCall.args[2]).to.have.property('cwd', EXPECTED_CLONE_PATH);
    });

    it('does not checkout when ref is not provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      // Only the clone call, no checkout
      expect(execFileSyncStub).to.have.been.calledOnce;
    });

    it('does not fail clone when checkout ref fails', async () => {
      // First call (clone) succeeds, second call (checkout) fails
      execFileSyncStub.onFirstCall().returns('');
      execFileSyncStub.onSecondCall().throws(new Error('Git command failed: pathspec \'nonexistent\' did not match'));

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID, ref: 'nonexistent' },
      );

      // Clone should still succeed
      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      expect(context.log.error).to.have.been.calledWith(
        sinon.match(/Failed to checkout ref 'nonexistent'.*Continuing with default branch/),
      );
    });

    it('throws on git clone failure and cleans up temp directory', async () => {
      execFileSyncStub.throws(new Error('git clone failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('Git command failed');

      expect(rmSyncStub).to.have.been.calledOnceWith(
        EXPECTED_CLONE_PATH,
        { recursive: true, force: true },
      );
    });

    it('throws a clear message when git command times out', async () => {
      const err = new Error('SIGTERM');
      err.killed = true;
      execFileSyncStub.throws(err);

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('Git command timed out after 120s');

      expect(context.log.error.firstCall.args[0]).to.include('timed out after 120s');
    });

    it('sanitizes Bearer token and credentials in git error output', async () => {
      const err = new Error('auth failed');
      err.stderr = 'fatal: Authorization: Bearer secret-token-123';
      execFileSyncStub.throws(err);

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('Git command failed');

      const logged = context.log.error.firstCall.args[0];
      expect(logged).to.include('Bearer [REDACTED]');
      expect(logged).to.not.include('secret-token-123');
    });
  });

  describe('createBranch', () => {
    it('checks out base and creates new branch', async () => {
      const client = CloudManagerClient.createFrom(createContext());
      await client.createBranch('/tmp/cm-repo-test', 'main', 'feature/fix');

      expect(execFileSyncStub).to.have.been.calledTwice;

      const checkoutArgs = getGitArgs(execFileSyncStub.firstCall);
      expect(checkoutArgs).to.include('checkout');
      expect(checkoutArgs).to.include('main');

      const branchArgs = getGitArgs(execFileSyncStub.secondCall);
      expect(branchArgs).to.include('checkout');
      expect(branchArgs).to.include('-b');
      expect(branchArgs).to.include('feature/fix');
    });
  });

  describe('applyPatch', () => {
    it('applies mail-message patch with git am when content starts with "From "', async () => {
      const patchContent = 'From abc123\nSubject: Fix bug\n\ndiff --git a/file.txt b/file.txt\n';

      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      // existsSync returns true for the patch file in finally block
      existsSyncStub.returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.applyPatch('/tmp/cm-repo-test', 'feature/fix', 's3://my-bucket/patches/fix.patch');

      // Verify S3 download
      const s3Calls = s3Mock.commandCalls(GetObjectCommand);
      expect(s3Calls).to.have.lengthOf(1);
      expect(s3Calls[0].args[0].input.Bucket).to.equal('my-bucket');
      expect(s3Calls[0].args[0].input.Key).to.equal('patches/fix.patch');

      // Verify patch file written
      expect(writeSyncStub).to.have.been.calledOnce;
      expect(writeSyncStub.firstCall.args[1]).to.equal(patchContent);

      // Verify git user config, checkout, and am (no apply/add/commit)
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.name') && s.includes('test-bot'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.email') && s.includes('test-bot@example.com'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('checkout') && s.includes('feature/fix'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.startsWith('am '))).to.be.true;
      expect(allGitArgStrs.some((s) => s.startsWith('apply '))).to.be.false;

      // Verify patch temp directory cleanup
      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-patch-$/);
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
    });

    it('logs warning when commitMessage is provided with a mail-message patch', async () => {
      const patchContent = 'From abc123\nSubject: Fix bug\n\ndiff --git a/file.txt b/file.txt\n';

      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      existsSyncStub.returns(true);

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);
      await client.applyPatch('/tmp/cm-repo-test', 'feature/fix', 's3://my-bucket/patches/fix.patch', {
        commitMessage: 'This should be ignored',
      });

      // Verify git am is used (not apply)
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.startsWith('am '))).to.be.true;
      expect(allGitArgStrs.some((s) => s.startsWith('apply '))).to.be.false;

      // Verify warning was logged
      expect(context.log.warn).to.have.been.calledOnceWith(
        'commitMessage is ignored for mail-message patches; git am uses the embedded commit message',
      );
    });

    it('applies plain diff with git apply, add, and commit when content starts with "diff "', async () => {
      const patchContent = 'diff --git a/file.txt b/file.txt\nindex abc..def 100644\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n';

      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      existsSyncStub.returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.applyPatch('/tmp/cm-repo-test', 'feature/fix', 's3://my-bucket/patches/fix.patch', {
        commitMessage: 'Apply agent suggestion',
      });

      // Verify git apply, add -A, and commit (no am)
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('apply'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('add') && s.includes('-A'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('commit') && s.includes('-m') && s.includes('Apply agent suggestion'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.startsWith('am '))).to.be.false;
    });

    it('throws when plain diff patch is applied without commitMessage', async () => {
      const patchContent = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n';

      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      existsSyncStub.returns(true);

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3://bucket/patches/fix.patch'))
        .to.be.rejectedWith('commitMessage is required when applying a plain diff patch');
    });

    it('throws on invalid S3 path format (non-URL)', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 'not-an-s3-path'))
        .to.be.rejectedWith('Invalid S3 path');
    });

    it('throws when S3 path has wrong protocol (valid URL but not s3:)', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 'https://my-bucket/patches/fix.patch'))
        .to.be.rejectedWith('Invalid S3 path: https://my-bucket/patches/fix.patch. Expected format: s3://bucket/key');
    });

    it('throws when S3 path has empty bucket (missing hostname)', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3:///patches/fix.patch'))
        .to.be.rejectedWith('Invalid S3 path: s3:///patches/fix.patch. Expected format: s3://bucket/key');
    });

    it('throws when S3 path has empty key (pathname is only slash)', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3://my-bucket/'))
        .to.be.rejectedWith('Invalid S3 path: s3://my-bucket/. Expected format: s3://bucket/key');
    });

    it('cleans up temp patch directory even on error', async () => {
      const patchContent = 'From abc123\nSubject: test\n\ndiff --git a/f b/f\n';
      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      existsSyncStub.returns(true);
      // Make a git command after user config fail (4th call: checkout ok, am fails)
      execFileSyncStub.onCall(3).throws(new Error('am failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3://bucket/key'))
        .to.be.rejected;

      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
    });
  });

  describe('applyPatchContent', () => {
    it('applies plain diff patch content with git apply, add, and commit', async () => {
      const patchContent = 'diff --git a/file.txt b/file.txt\nindex abc..def 100644\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n';

      existsSyncStub.returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.applyPatchContent('/tmp/cm-repo-test', 'feature/fix', patchContent, 'Fix the bug');

      // Verify patch file written to temp directory
      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-patch-$/);
      expect(writeSyncStub).to.have.been.calledOnce;
      expect(writeSyncStub.firstCall.args[1]).to.equal(patchContent);

      // Verify git commands: config, config, checkout, apply, add, commit
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.name') && s.includes('test-bot'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.email') && s.includes('test-bot@example.com'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('checkout') && s.includes('feature/fix'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('apply'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('add') && s.includes('-A'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('commit') && s.includes('-m') && s.includes('Fix the bug'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.startsWith('am '))).to.be.false;

      // Verify temp directory cleanup
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
    });

    it('applies mail-message patch with git am (commitMessage ignored)', async () => {
      const patchContent = 'From abc123\nSubject: Fix bug\n\ndiff --git a/file.txt b/file.txt\n';

      existsSyncStub.returns(true);

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);
      await client.applyPatchContent('/tmp/cm-repo-test', 'feature/fix', patchContent, 'This is ignored');

      // Verify git am is used, not apply
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.startsWith('am '))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('apply'))).to.be.false;
      expect(allGitArgStrs.some((s) => s.includes('commit'))).to.be.false;

      // Verify log message mentions commitMessage ignored
      expect(context.log.info).to.have.been.calledWith(
        sinon.match(/commitMessage ignored/),
      );
    });

    it('throws when commitMessage is not provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatchContent('/tmp/cm-repo-test', 'main', 'diff content'))
        .to.be.rejectedWith('commitMessage is required for applyPatchContent');
    });

    it('cleans up temp patch directory even on error', async () => {
      existsSyncStub.returns(true);
      // Make checkout fail (3rd git call: config, config, checkout)
      execFileSyncStub.onCall(2).throws(new Error('checkout failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatchContent('/tmp/cm-repo-test', 'bad-branch', 'diff content', 'msg'))
        .to.be.rejected;

      // Temp directory should still be cleaned up
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
    });

    it('skips cleanup when temp directory does not exist', async () => {
      existsSyncStub.returns(false);
      // Make checkout fail
      execFileSyncStub.onCall(2).throws(new Error('checkout failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatchContent('/tmp/cm-repo-test', 'bad-branch', 'diff content', 'msg'))
        .to.be.rejected;

      // rmSync should NOT be called since existsSync returned false
      expect(rmSyncStub).to.not.have.been.called;
    });
  });

  describe('applyFiles', () => {
    it('writes files and commits on the specified branch', async () => {
      // existsSync returns true for directories (no mkdirSync needed)
      existsSyncStub.returns(true);

      const files = [
        { path: 'src/main.js', content: 'console.log("hello");' },
        { path: 'README.md', content: '# Hello' },
      ];

      const context = createContext();
      const client = CloudManagerClient.createFrom(context);
      await client.applyFiles('/tmp/cm-repo-test', 'feature/fix', files, 'Add files');

      // Verify git commands: config, config, checkout, add, commit
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.name') && s.includes('test-bot'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.email') && s.includes('test-bot@example.com'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('checkout') && s.includes('feature/fix'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('add') && s.includes('-A'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('commit') && s.includes('-m') && s.includes('Add files'))).to.be.true;

      // Verify files written
      expect(writeSyncStub).to.have.been.calledTwice;
      expect(writeSyncStub.firstCall.args[0]).to.equal(path.join('/tmp/cm-repo-test', 'src/main.js'));
      expect(writeSyncStub.firstCall.args[1]).to.equal('console.log("hello");');
      expect(writeSyncStub.secondCall.args[0]).to.equal(path.join('/tmp/cm-repo-test', 'README.md'));
      expect(writeSyncStub.secondCall.args[1]).to.equal('# Hello');

      // No mkdirSync needed since directories exist
      expect(mkdirSyncStub).to.not.have.been.called;

      // Verify log message
      expect(context.log.info).to.have.been.calledWith('2 file(s) applied and committed on branch feature/fix');
    });

    it('creates parent directories when they do not exist', async () => {
      // existsSync returns false for directories
      existsSyncStub.returns(false);

      const files = [
        { path: 'deep/nested/dir/file.js', content: 'export default {};' },
      ];

      const client = CloudManagerClient.createFrom(createContext());
      await client.applyFiles('/tmp/cm-repo-test', 'main', files, 'Add nested file');

      // Verify mkdirSync was called with recursive: true
      expect(mkdirSyncStub).to.have.been.calledOnce;
      expect(mkdirSyncStub.firstCall.args[0]).to.equal(
        path.dirname(path.join('/tmp/cm-repo-test', 'deep/nested/dir/file.js')),
      );
      expect(mkdirSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true });

      // Verify file written
      expect(writeSyncStub).to.have.been.calledOnce;
      expect(writeSyncStub.firstCall.args[0]).to.equal(path.join('/tmp/cm-repo-test', 'deep/nested/dir/file.js'));
    });

    it('throws when commitMessage is not provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyFiles('/tmp/cm-repo-test', 'main', [{ path: 'f.js', content: 'x' }]))
        .to.be.rejectedWith('commitMessage is required for applyFiles');
    });

    it('throws when files is empty', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyFiles('/tmp/cm-repo-test', 'main', [], 'msg'))
        .to.be.rejectedWith('files must be a non-empty array of {path, content} objects');
    });

    it('throws when files is not an array', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyFiles('/tmp/cm-repo-test', 'main', 'not-an-array', 'msg'))
        .to.be.rejectedWith('files must be a non-empty array of {path, content} objects');
    });

    it('throws when files is null', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyFiles('/tmp/cm-repo-test', 'main', null, 'msg'))
        .to.be.rejectedWith('files must be a non-empty array of {path, content} objects');
    });
  });

  describe('push', () => {
    it('pushes BYOG repo with auth headers and ref', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.push(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID, ref: 'main' },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pushArgs = getGitArgs(execFileSyncStub.firstCall);
      const pushArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pushArgStr).to.include('push');
      expect(pushArgStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(pushArgStr).to.include('x-api-key: test-client-id');
      expect(pushArgStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
      // ref should be the last argument
      expect(pushArgs[pushArgs.length - 1]).to.equal('main');
    });

    it('pushes standard repo with basic auth in URL and ref', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      await client.push(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL, ref: 'main' },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pushArgs = getGitArgs(execFileSyncStub.firstCall);
      const pushArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pushArgStr).to.include('push');
      expect(pushArgStr).to.include(`http.${TEST_STANDARD_REPO_URL}.extraheader=Authorization: Basic c3RkdXNlcjpzdGR0b2tlbjEyMw==`);
      expect(pushArgStr).to.include(TEST_STANDARD_REPO_URL);
      expect(pushArgStr).to.not.include('stduser:stdtoken123@');
      expect(pushArgStr).to.not.include('Bearer');
      expect(pushArgs[pushArgs.length - 1]).to.equal('main');
    });

    it('pushes a new branch ref', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.push(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID, ref: 'aso-test' },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pushArgs = getGitArgs(execFileSyncStub.firstCall);
      expect(pushArgs[pushArgs.length - 1]).to.equal('aso-test');
    });
  });

  describe('pull', () => {
    it('pulls BYOG repo with auth headers', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.pull(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pullArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pullArgStr).to.include('pull');
      expect(pullArgStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(pullArgStr).to.include('x-api-key: test-client-id');
      expect(pullArgStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);

      expect(execFileSyncStub.firstCall.args[2]).to.have.property('cwd', '/tmp/cm-repo-test');
    });

    it('pulls standard repo with basic auth in URL', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      await client.pull(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pullArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pullArgStr).to.include('pull');
      expect(pullArgStr).to.include(`http.${TEST_STANDARD_REPO_URL}.extraheader=Authorization: Basic c3RkdXNlcjpzdGR0b2tlbjEyMw==`);
      expect(pullArgStr).to.include(TEST_STANDARD_REPO_URL);
      expect(pullArgStr).to.not.include('stduser:stdtoken123@');
      expect(pullArgStr).to.not.include('Bearer');
    });

    it('checks out ref before pulling when ref is provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.pull(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID, ref: 'feature/my-branch' },
      );

      expect(execFileSyncStub).to.have.been.calledTwice;

      // First call: checkout
      const checkoutArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(checkoutArgStr).to.include('checkout');
      expect(checkoutArgStr).to.include('feature/my-branch');

      // Second call: pull
      const pullArgStr = getGitArgsStr(execFileSyncStub.secondCall);
      expect(pullArgStr).to.include('pull');
      expect(pullArgStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
    });

    it('skips checkout when ref is not provided', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.pull(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pullArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pullArgStr).to.include('pull');
      expect(pullArgStr).to.not.include('checkout');
    });
  });

  describe('checkout', () => {
    it('checks out the specified ref in the clone path', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await client.checkout('/tmp/cm-repo-test', 'release/5.11');

      expect(execFileSyncStub).to.have.been.calledOnce;
      const checkoutArgs = getGitArgs(execFileSyncStub.firstCall);
      expect(checkoutArgs).to.deep.equal(['checkout', 'release/5.11']);
      expect(execFileSyncStub.firstCall.args[2]).to.have.property('cwd', '/tmp/cm-repo-test');
    });

    it('throws when checkout fails', async () => {
      execFileSyncStub.throws(new Error('Git command failed: pathspec not found'));
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.checkout('/tmp/cm-repo-test', 'nonexistent'))
        .to.be.rejectedWith('Git command failed');
    });
  });

  describe('unzipRepository', () => {
    const expectedExtractPath = `${path.join(os.tmpdir(), 'cm-repo-')}XXXXXX`;
    const expectedZipDir = `${path.join(os.tmpdir(), 'cm-zip-')}XXXXXX`;
    const expectedZipFile = path.join(expectedZipDir, 'repo.zip');

    it('extracts ZIP buffer to a temp directory', async () => {
      const client = CloudManagerClient.createFrom(createContext());
      const zipBuffer = Buffer.from('fake-zip-content');

      const extractPath = await client.unzipRepository(zipBuffer);

      // Should have created temp dirs for extract (cm-repo-) and zip file (cm-zip-)
      expect(mkdtempSyncStub).to.have.been.calledTwice;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-repo-$/);
      expect(mkdtempSyncStub.secondCall.args[0]).to.match(/cm-zip-$/);

      // Should write buffer to temp zip file, then extract
      expect(writeSyncStub).to.have.been.calledOnce;
      expect(writeSyncStub.firstCall.args[0]).to.equal(expectedZipFile);
      expect(writeSyncStub.firstCall.args[1]).to.equal(zipBuffer);
      expect(extractStub).to.have.been.calledOnce;
      expect(extractStub.firstCall.args[0]).to.equal(expectedZipFile);
      expect(extractStub.firstCall.args[1]).to.equal(expectedExtractPath);

      // Should validate symlinks after extraction
      expect(readdirSyncStub).to.have.been.calledOnce;
      expect(readdirSyncStub.firstCall.args[0]).to.equal(expectedExtractPath);

      // Should clean up the temp zip directory
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[0]).to.equal(expectedZipDir);

      // Should return the extract path
      expect(extractPath).to.equal(expectedExtractPath);
    });

    it('cleans up on unzip failure', async () => {
      extractStub.rejects(new Error('Invalid or unsupported zip format'));
      const client = CloudManagerClient.createFrom(createContext());
      const zipBuffer = Buffer.from('bad-zip-content');

      await expect(client.unzipRepository(zipBuffer))
        .to.be.rejectedWith('Failed to unzip repository');

      // Should have cleaned up both the extraction directory and the temp zip directory
      expect(rmSyncStub).to.have.been.calledTwice;
      const rmPaths = rmSyncStub.getCalls().map((c) => c.args[0]);
      expect(rmPaths.some((p) => p.includes('cm-repo-'))).to.be.true;
      expect(rmPaths.some((p) => p.includes('cm-zip-'))).to.be.true;
    });

    it('cleans up extractPath when second mkdtempSync fails', async () => {
      mkdtempSyncStub.onFirstCall().returns(expectedExtractPath);
      mkdtempSyncStub.onSecondCall().throws(new Error('ENOSPC: no space left on device'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.unzipRepository(Buffer.from('zip')))
        .to.be.rejectedWith('Failed to unzip repository: ENOSPC: no space left on device');

      // extractPath should be cleaned up even though zipDir was never created
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[0]).to.equal(expectedExtractPath);
    });

    it('rejects when extracted symlink points outside repository root', async () => {
      // Simulate a directory with a symlink that escapes the root
      readdirSyncStub.withArgs(expectedExtractPath, { withFileTypes: true }).returns([{
        name: 'evil-link',
        isSymbolicLink: () => true,
        isDirectory: () => false,
      }]);
      readlinkSyncStub.returns('/etc/shadow');

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.unzipRepository(Buffer.from('zip')))
        .to.be.rejectedWith('Symlink escapes repository root: evil-link -> /etc/shadow');

      // extractPath should be cleaned up
      const rmPaths = rmSyncStub.getCalls().map((c) => c.args[0]);
      expect(rmPaths.some((p) => p.includes('cm-repo-'))).to.be.true;
    });

    it('allows symlinks that point within the repository root', async () => {
      // Simulate dispatcher-style symlinks: enabled_farms/foo.farm -> ../available_farms/foo.farm
      readdirSyncStub.withArgs(expectedExtractPath, { withFileTypes: true }).returns([{
        name: 'dispatcher',
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }]);
      const dispatcherPath = path.join(expectedExtractPath, 'dispatcher');
      readdirSyncStub.withArgs(dispatcherPath, { withFileTypes: true }).returns([{
        name: 'enabled_farms',
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }, {
        name: 'available_farms',
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }]);
      const enabledPath = path.join(dispatcherPath, 'enabled_farms');
      readdirSyncStub.withArgs(enabledPath, { withFileTypes: true }).returns([{
        name: 'default.farm',
        isSymbolicLink: () => true,
        isDirectory: () => false,
      }]);
      readlinkSyncStub.returns('../available_farms/default.farm');
      const availablePath = path.join(dispatcherPath, 'available_farms');
      readdirSyncStub.withArgs(availablePath, { withFileTypes: true }).returns([]);

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.unzipRepository(Buffer.from('zip'));

      expect(result).to.equal(expectedExtractPath);
    });
  });

  describe('zipRepository', () => {
    it('throws when clone path does not exist', async () => {
      existsSyncStub.returns(false);
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.zipRepository('/tmp/cm-repo-nonexistent'))
        .to.be.rejectedWith('Clone path does not exist');
    });

    it('returns zip buffer when clone path exists', async () => {
      const clonePath = '/tmp/cm-repo-zip-test';
      existsSyncStub.withArgs(clonePath).returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.zipRepository(clonePath);

      expect(Buffer.isBuffer(result)).to.be.true;
      expect(result.toString()).to.equal('zip-content');

      // Should call archiveFolder with followSymlinks: false
      expect(archiveFolderStub).to.have.been.calledOnce;
      expect(archiveFolderStub.firstCall.args[0]).to.equal(clonePath);
      expect(archiveFolderStub.firstCall.args[1]).to.deep.equal({ followSymlinks: false });
    });

    it('rejects symlinks that escape the repo root before zipping', async () => {
      const clonePath = '/tmp/cm-repo-zip-test';
      existsSyncStub.withArgs(clonePath).returns(true);

      readdirSyncStub.withArgs(clonePath, { withFileTypes: true }).returns([{
        name: 'evil-link',
        isSymbolicLink: () => true,
        isDirectory: () => false,
      }]);
      readlinkSyncStub.returns('/etc/passwd');

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.zipRepository(clonePath))
        .to.be.rejectedWith('Symlink escapes repository root: evil-link -> /etc/passwd');

      // archiveFolder should never be called
      expect(archiveFolderStub).to.not.have.been.called;
    });

    it('logs a warning for broken symlinks but proceeds with zip', async () => {
      const clonePath = '/tmp/cm-repo-zip-test';
      existsSyncStub.withArgs(clonePath).returns(true);

      const enabledFarmsPath = path.join(clonePath, 'dispatcher', 'enabled_farms');
      const brokenLinkPath = path.join(enabledFarmsPath, 'broken.farm');
      const brokenTarget = '../available_farms/missing.farm';
      const resolvedTarget = path.resolve(enabledFarmsPath, brokenTarget);

      readdirSyncStub.withArgs(clonePath, { withFileTypes: true }).returns([{
        name: 'dispatcher',
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }]);
      readdirSyncStub.withArgs(path.join(clonePath, 'dispatcher'), { withFileTypes: true }).returns([{
        name: 'enabled_farms',
        isSymbolicLink: () => false,
        isDirectory: () => true,
      }]);
      readdirSyncStub.withArgs(enabledFarmsPath, { withFileTypes: true }).returns([{
        name: 'broken.farm',
        isSymbolicLink: () => true,
        isDirectory: () => false,
      }]);
      readlinkSyncStub.withArgs(brokenLinkPath).returns(brokenTarget);
      existsSyncStub.withArgs(resolvedTarget).returns(false);

      const ctx = createContext();
      const client = CloudManagerClient.createFrom(ctx);
      const result = await client.zipRepository(clonePath);

      expect(Buffer.isBuffer(result)).to.be.true;
      expect(ctx.log.warn).to.have.been.calledWithMatch(/Broken symlink.*broken\.farm.*missing\.farm/);
      expect(archiveFolderStub).to.have.been.calledOnce;
    });

    it('throws when archiveFolder fails', async () => {
      const clonePath = '/tmp/cm-repo-zip-test';
      existsSyncStub.withArgs(clonePath).returns(true);
      archiveFolderStub.rejects(new Error('failed to read directory'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.zipRepository(clonePath))
        .to.be.rejectedWith('Failed to zip repository: failed to read directory');
    });
  });

  describe('cleanup', () => {
    it('removes the clone directory', async () => {
      existsSyncStub.returns(true);
      const client = CloudManagerClient.createFrom(createContext());

      await client.cleanup(EXPECTED_CLONE_PATH);

      expect(rmSyncStub).to.have.been.calledWith(
        EXPECTED_CLONE_PATH,
        { recursive: true, force: true },
      );
    });

    it('throws on invalid clone path', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.cleanup('/some/random/path'))
        .to.be.rejectedWith('Must be a cm-repo temp directory');
    });

    it('throws on null clone path', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.cleanup(null))
        .to.be.rejectedWith('Must be a cm-repo temp directory');
    });

    it('handles non-existent path gracefully', async () => {
      existsSyncStub.returns(false);
      const client = CloudManagerClient.createFrom(createContext());

      await client.cleanup(EXPECTED_CLONE_PATH);

      expect(rmSyncStub).to.not.have.been.called;
    });
  });

  describe('createPullRequest', () => {
    it('creates a PR and constructs pullRequestUrl from repoUrl and externalNumber', async () => {
      const prNock = nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`, {
          title: 'Fix issue',
          sourceBranch: 'feature/fix',
          destinationBranch: 'main',
          description: 'Automated fix',
        })
        .reply(201, { id: 169205, externalNumber: '2', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'feature/fix',
          title: 'Fix issue',
          description: 'Automated fix',
          repoUrl: 'https://github.com/owner/repo.git',
        },
      );

      expect(result.id).to.equal(169205);
      expect(result.pullRequestUrl).to.equal('https://github.com/owner/repo/pull/2');
      expect(prNock.isDone()).to.be.true;
    });

    it('constructs pullRequestUrl for GitHub without .git suffix', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, externalNumber: '10', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
          repoUrl: 'https://github.com/owner/repo',
        },
      );

      expect(result.pullRequestUrl).to.equal('https://github.com/owner/repo/pull/10');
    });

    it('constructs pullRequestUrl for GitLab', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, externalNumber: '5', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
          repoUrl: 'https://gitlab.com/group/project.git',
        },
      );

      expect(result.pullRequestUrl).to.equal('https://gitlab.com/group/project/-/merge_requests/5');
    });

    it('constructs pullRequestUrl for self-hosted GitLab', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, externalNumber: '3', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
          repoUrl: 'https://gitlab.corp.example.com/team/repo.git',
        },
      );

      expect(result.pullRequestUrl).to.equal('https://gitlab.corp.example.com/team/repo/-/merge_requests/3');
    });

    it('does not set pullRequestUrl for unsupported provider', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, externalNumber: '1', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
          repoUrl: 'https://bitbucket.org/owner/repo.git',
        },
      );

      expect(result.pullRequestUrl).to.be.undefined;
    });

    it('does not set pullRequestUrl when repoUrl is not provided', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, externalNumber: '1', state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
        },
      );

      expect(result.pullRequestUrl).to.be.undefined;
    });

    it('does not set pullRequestUrl when externalNumber is missing', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(201, { id: 1, state: 'OPEN' });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
          repoUrl: 'https://github.com/owner/repo.git',
        },
      );

      expect(result.pullRequestUrl).to.be.undefined;
    });

    it('throws on failed PR creation', async () => {
      nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`)
        .reply(422, 'Validation failed');

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.createPullRequest(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        {
          imsOrgId: TEST_IMS_ORG_ID,
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
        },
      )).to.be.rejectedWith('Pull request creation failed');
    });
  });
});
