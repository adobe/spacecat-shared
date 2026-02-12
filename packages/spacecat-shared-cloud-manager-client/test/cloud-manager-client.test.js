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
const EXPECTED_CLONE_PATH = `/tmp/cm-repo-${TEST_PROGRAM_ID}-${TEST_REPO_ID}`;
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
  let rmSyncStub;
  let writeSyncStub;
  let unlinkSyncStub;
  let archiverStub;

  beforeEach(async () => {
    execFileSyncStub = sinon.stub().returns('');
    existsSyncStub = sinon.stub().returns(false);
    rmSyncStub = sinon.stub();
    writeSyncStub = sinon.stub();
    unlinkSyncStub = sinon.stub();
    archiverStub = sinon.stub().callsFake(createMockArchiver);

    const mod = await esmock('../src/index.js', {
      child_process: { execFileSync: execFileSyncStub },
      fs: {
        existsSync: existsSyncStub,
        mkdirSync: sinon.stub(),
        rmSync: rmSyncStub,
        writeFileSync: writeSyncStub,
        unlinkSync: unlinkSyncStub,
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

    it('clones standard repository with basic auth in URL', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      const clonePath = await client.clone(
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      );

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      expect(execFileSyncStub).to.have.been.calledOnce;

      const gitArgs = getGitArgs(execFileSyncStub.firstCall);
      const gitArgsStr = getGitArgsStr(execFileSyncStub.firstCall);

      // Should use basic auth URL, not extraheader
      expect(gitArgs).to.include('clone');
      expect(gitArgsStr).to.include('https://stduser:stdtoken123@git.cloudmanager.adobe.com/myorg/myrepo.git');
      expect(gitArgs).to.include(EXPECTED_CLONE_PATH);

      // Should NOT contain extraheader args
      expect(gitArgsStr).to.not.include('extraheader');
      expect(gitArgsStr).to.not.include('Bearer');
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

    it('removes existing clone path before cloning', async () => {
      setupImsTokenNock();
      existsSyncStub.withArgs(EXPECTED_CLONE_PATH).returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, { imsOrgId: TEST_IMS_ORG_ID });

      expect(rmSyncStub).to.have.been.calledWith(
        EXPECTED_CLONE_PATH,
        { recursive: true, force: true },
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

      // Verify cleanup
      expect(unlinkSyncStub).to.have.been.calledOnce;
    });

    it('throws on invalid S3 path format', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 'not-an-s3-path'))
        .to.be.rejectedWith('Invalid S3 path');
    });

    it('cleans up temp patch file even on error', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => 'patch content' },
      });

      existsSyncStub.returns(true);
      // Make a git command after user config fail (4th call: checkout ok, am fails)
      execFileSyncStub.onCall(3).throws(new Error('am failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3://bucket/key'))
        .to.be.rejected;

      expect(unlinkSyncStub).to.have.been.calledOnce;
    });
  });

  describe('push', () => {
    it('pushes BYOG repo with auth headers', async () => {
      setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      await client.push(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { imsOrgId: TEST_IMS_ORG_ID },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pushArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pushArgStr).to.include('push');
      expect(pushArgStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(pushArgStr).to.include('x-api-key: aso-cm-repo-service');
      expect(pushArgStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
    });

    it('pushes standard repo with basic auth in URL', async () => {
      const client = CloudManagerClient.createFrom(
        createContext({ CM_STANDARD_REPO_CREDENTIALS: TEST_STANDARD_CREDENTIALS }),
      );

      await client.push(
        '/tmp/cm-repo-test',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        { repoType: 'standard', repoUrl: TEST_STANDARD_REPO_URL },
      );

      expect(execFileSyncStub).to.have.been.calledOnce;

      const pushArgStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(pushArgStr).to.include('push');
      expect(pushArgStr).to.include('https://stduser:stdtoken123@git.cloudmanager.adobe.com/myorg/myrepo.git');
      expect(pushArgStr).to.not.include('extraheader');
      expect(pushArgStr).to.not.include('Bearer');
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
        .to.be.rejectedWith('Invalid clone path for cleanup');
    });

    it('throws on null clone path', async () => {
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.cleanup(null))
        .to.be.rejectedWith('Invalid clone path for cleanup');
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
        TEST_IMS_ORG_ID,
        {
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
        TEST_IMS_ORG_ID,
        {
          destinationBranch: 'main',
          sourceBranch: 'fix',
          title: 'Fix',
          description: 'desc',
        },
      )).to.be.rejectedWith('Pull request creation failed');
    });
  });
});
