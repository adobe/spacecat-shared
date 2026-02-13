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

/* eslint-env mocha */

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

function setupImsTokenNock() {
  return nock(`https://${TEST_ENV.IMS_HOST}`)
    .post('/ims/token/v4')
    .reply(200, {
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

/**
 * Creates a mock archiver that resolves the zip Promise when finalize() is called.
 * Used to test zipRepository without hitting the real filesystem.
 */
function createMockArchiver() {
  let dataCb;
  let endCb;
  return {
    on(ev, fn) {
      if (ev === 'data') dataCb = fn;
      if (ev === 'end') endCb = fn;
      if (ev === 'error') { /* this mock never emits error */ }
      return this;
    },
    glob: sinon.stub(),
    finalize() {
      setImmediate(() => {
        if (dataCb) dataCb(Buffer.from('zip-content'));
        if (endCb) endCb();
      });
    },
  };
}

describe('CloudManagerClient', () => {
  let CloudManagerClient;
  let execFileSyncStub;
  let existsSyncStub;
  let mkdtempSyncStub;
  let rmSyncStub;
  let writeSyncStub;
  let archiverStub;

  beforeEach(async () => {
    execFileSyncStub = sinon.stub().returns('');
    existsSyncStub = sinon.stub().returns(false);
    mkdtempSyncStub = sinon.stub().callsFake((prefix) => `${prefix}XXXXXX`);
    rmSyncStub = sinon.stub();
    writeSyncStub = sinon.stub();
    archiverStub = sinon.stub().callsFake(createMockArchiver);

    const mod = await esmock('../src/index.js', {
      child_process: { execFileSync: execFileSyncStub },
      fs: {
        existsSync: existsSyncStub,
        mkdtempSync: mkdtempSyncStub,
        rmSync: rmSyncStub,
        writeFileSync: writeSyncStub,
      },
      archiver: archiverStub,
    });
    CloudManagerClient = mod.default;
  });

  afterEach(() => {
    sinon.restore();
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
    it('fetches and caches token across multiple calls', async () => {
      const imsNock = setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });
      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      // IMS token should only be fetched once (cached)
      expect(imsNock.isDone()).to.be.true;
      expect(execFileSyncStub).to.have.been.calledTwice;
    });

    it('throws when IMS token request fails', async () => {
      nock(`https://${TEST_ENV.IMS_HOST}`)
        .post('/ims/token/v4')
        .reply(401);

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('IMS token request failed with status: 401');
    });
  });

  describe('clone', () => {
    it('clones BYOG repository with correct git command and headers', async () => {
      setupImsTokenNock();
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
      expect(gitArgsStr).to.include('x-api-key: aso-cm-repo-service');
      expect(gitArgsStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
      expect(gitArgsStr).to.include(`${TEST_ENV.CM_REPO_URL}/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}.git`);
      expect(gitArgs).to.include(EXPECTED_CLONE_PATH);
    });

    it('clones standard repository with basic auth and strips credentials from origin', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      );

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      // Standard: clone call + set-url call to strip credentials
      expect(execFileSyncStub).to.have.been.calledTwice;

      // First call: clone with basic auth URL
      const cloneArgs = getGitArgs(execFileSyncStub.firstCall);
      const cloneArgsStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(cloneArgs).to.include('clone');
      expect(cloneArgsStr).to.include('https://stduser:stdtoken123@git.cloudmanager.adobe.com/myorg/myrepo.git');
      expect(cloneArgs).to.include(EXPECTED_CLONE_PATH);
      expect(cloneArgsStr).to.not.include('extraheader');
      expect(cloneArgsStr).to.not.include('Bearer');

      // Second call: set-url to replace credentials with clean URL
      const setUrlArgs = getGitArgs(execFileSyncStub.secondCall);
      expect(setUrlArgs).to.deep.equal(['remote', 'set-url', 'origin', TEST_STANDARD_REPO_URL]);
      expect(execFileSyncStub.secondCall.args[2]).to.have.property('cwd', EXPECTED_CLONE_PATH);
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
      setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-repo-$/);
    });

    it('checks out ref after clone when ref is provided', async () => {
      setupImsTokenNock();
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
      setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      // Only the clone call, no checkout
      expect(execFileSyncStub).to.have.been.calledOnce;
    });

    it('does not fail clone when checkout ref fails', async () => {
      setupImsTokenNock();
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

    it('throws on git clone failure', async () => {
      setupImsTokenNock();
      execFileSyncStub.throws(new Error('git clone failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID }))
        .to.be.rejectedWith('Git command failed');
    });

    it('sanitizes Bearer token and credentials in git error output', async () => {
      setupImsTokenNock();
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
    it('downloads patch from S3 and applies it with git am', async () => {
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

      // Verify git user config, checkout, and am
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.name') && s.includes('test-bot'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.email') && s.includes('test-bot@example.com'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('checkout') && s.includes('feature/fix'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('am'))).to.be.true;

      // Verify patch temp directory cleanup
      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-patch-$/);
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
    });

    it('throws on invalid S3 path format', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 'not-an-s3-path'))
        .to.be.rejectedWith('Invalid S3 path');
    });

    it('cleans up temp patch directory even on error', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => 'patch content' },
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

  describe('push', () => {
    it('pushes BYOG repo with auth headers and ref', async () => {
      setupImsTokenNock();
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
      expect(pushArgStr).to.include('x-api-key: aso-cm-repo-service');
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
      expect(pushArgStr).to.include('https://stduser:stdtoken123@git.cloudmanager.adobe.com/myorg/myrepo.git');
      expect(pushArgStr).to.not.include('extraheader');
      expect(pushArgStr).to.not.include('Bearer');
      expect(pushArgs[pushArgs.length - 1]).to.equal('main');
    });

    it('pushes a new branch ref', async () => {
      setupImsTokenNock();
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
      setupImsTokenNock();
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
      expect(pullArgStr).to.include('x-api-key: aso-cm-repo-service');
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
      expect(pullArgStr).to.include('https://stduser:stdtoken123@git.cloudmanager.adobe.com/myorg/myrepo.git');
      expect(pullArgStr).to.not.include('extraheader');
      expect(pullArgStr).to.not.include('Bearer');
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
    it('extracts ZIP buffer to a temp directory', async () => {
      // execFileSync is called for unzip command (not git)
      const client = CloudManagerClient.createFrom(createContext());
      const zipBuffer = Buffer.from('fake-zip-content');

      const extractPath = await client.unzipRepository(zipBuffer);

      // Should have created a temp dir with cm-repo- prefix
      expect(mkdtempSyncStub).to.have.been.calledOnce;
      expect(mkdtempSyncStub.firstCall.args[0]).to.match(/cm-repo-$/);

      // Should have written the ZIP file
      expect(writeSyncStub).to.have.been.calledOnce;
      const writtenPath = writeSyncStub.firstCall.args[0];
      expect(writtenPath).to.include('repository.zip');
      expect(writeSyncStub.firstCall.args[1]).to.equal(zipBuffer);

      // Should have called unzip via execFileSync (second call after esmock module load)
      // Note: execFileSyncStub is used for both git and unzip commands
      expect(execFileSyncStub).to.have.been.calledOnce;
      expect(execFileSyncStub.firstCall.args[0]).to.equal('unzip');
      expect(execFileSyncStub.firstCall.args[1]).to.include('-o');
      expect(execFileSyncStub.firstCall.args[1]).to.include('-q');

      // Should have removed the ZIP file after extraction
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[0]).to.include('repository.zip');

      // Should return the extract path
      expect(extractPath).to.equal(`${path.join(os.tmpdir(), 'cm-repo-')}XXXXXX`);
    });

    it('cleans up on unzip failure', async () => {
      // Make execFileSync fail (simulating unzip failure)
      execFileSyncStub.throws(new Error('unzip: not found'));
      const client = CloudManagerClient.createFrom(createContext());
      const zipBuffer = Buffer.from('bad-zip-content');

      await expect(client.unzipRepository(zipBuffer))
        .to.be.rejectedWith('Failed to unzip repository');

      // Should have cleaned up the extraction directory
      expect(rmSyncStub).to.have.been.calledOnce;
      expect(rmSyncStub.firstCall.args[1]).to.deep.equal({ recursive: true, force: true });
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
      expect(result.length).to.be.greaterThan(0);
      expect(result.toString()).to.equal('zip-content');
      expect(archiverStub).to.have.been.calledOnceWith('zip', { zlib: { level: 9 } });
      const archive = archiverStub.firstCall.returnValue;
      expect(archive.glob).to.have.been.calledWith('**/*', { cwd: clonePath, dot: true });
    });

    it('rejects when archiver emits error', async () => {
      const clonePath = '/tmp/cm-repo-zip-test';
      existsSyncStub.withArgs(clonePath).returns(true);

      archiverStub.callsFake(() => {
        let errCb;
        return {
          on(ev, fn) {
            if (ev === 'error') errCb = fn;
            return this;
          },
          glob() {},
          finalize() {
            setImmediate(() => errCb && errCb(new Error('archiver error')));
          },
        };
      });

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.zipRepository(clonePath))
        .to.be.rejectedWith('archiver error');
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
    it('creates a PR with correct payload', async () => {
      setupImsTokenNock();

      const prNock = nock(TEST_ENV.CM_REPO_URL)
        .post(`/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}/pullRequests`, {
          title: 'Fix issue',
          sourceBranch: 'feature/fix',
          destinationBranch: 'main',
          description: 'Automated fix',
        })
        .reply(201, { id: 'pr-1', status: 'open' });

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
        },
      );

      expect(result.id).to.equal('pr-1');
      expect(prNock.isDone()).to.be.true;
    });

    it('throws on failed PR creation', async () => {
      setupImsTokenNock();

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
