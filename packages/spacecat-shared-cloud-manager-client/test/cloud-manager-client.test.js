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
  CM_API_URL: 'https://cloudmanager.example.com',
  CM_REPO_URL: 'https://cm-repo.example.com',
  ASO_CODE_AUTOFIX_USERNAME: 'test-bot',
  ASO_CODE_AUTOFIX_EMAIL: 'test-bot@example.com',
};

const TEST_TOKEN = 'test-access-token-12345';
const TEST_IMS_ORG_ID = 'test-ims-org@AdobeOrg';
const TEST_PROGRAM_ID = '12345';
const TEST_REPO_ID = '67890';
const EXPECTED_CLONE_PATH = `/tmp/cm-repo-${TEST_PROGRAM_ID}-${TEST_REPO_ID}`;

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

describe('CloudManagerClient', () => {
  let CloudManagerClient;
  let execFileSyncStub;
  let existsSyncStub;
  let rmSyncStub;
  let writeSyncStub;
  let unlinkSyncStub;

  beforeEach(async () => {
    execFileSyncStub = sinon.stub().returns('');
    existsSyncStub = sinon.stub().returns(false);
    rmSyncStub = sinon.stub();
    writeSyncStub = sinon.stub();
    unlinkSyncStub = sinon.stub();

    const mod = await esmock('../src/index.js', {
      child_process: { execFileSync: execFileSyncStub },
      fs: {
        existsSync: existsSyncStub,
        mkdirSync: sinon.stub(),
        rmSync: rmSyncStub,
        writeFileSync: writeSyncStub,
        unlinkSync: unlinkSyncStub,
      },
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

    it('throws when IMS env vars are missing', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ ASO_CM_REPO_SERVICE_IMS_CLIENT_ID: '' }),
      )).to.throw('CloudManagerClient requires IMS_HOST');
    });

    it('throws when CM_API_URL is missing', () => {
      expect(() => CloudManagerClient.createFrom(
        createContext({ CM_API_URL: '' }),
      )).to.throw('CloudManagerClient requires CM_API_URL');
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
  });

  describe('IMS token', () => {
    it('fetches and caches token across multiple calls', async () => {
      const imsNock = setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      const repoNock = nock(TEST_ENV.CM_API_URL)
        .get(`/api/program/${TEST_PROGRAM_ID}/repositories`)
        .twice()
        .reply(200, { repositories: [] });

      await client.getRepositories(TEST_PROGRAM_ID, TEST_IMS_ORG_ID);
      await client.getRepositories(TEST_PROGRAM_ID, TEST_IMS_ORG_ID);

      expect(imsNock.isDone()).to.be.true;
      expect(repoNock.isDone()).to.be.true;
    });

    it('throws when IMS token request fails', async () => {
      nock(`https://${TEST_ENV.IMS_HOST}`)
        .post('/ims/token/v4')
        .reply(401);

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.getRepositories(TEST_PROGRAM_ID, TEST_IMS_ORG_ID))
        .to.be.rejectedWith('IMS token request failed with status: 401');
    });
  });

  describe('clone', () => {
    it('clones repository with correct git command and headers', async () => {
      setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      const clonePath = await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, TEST_IMS_ORG_ID);

      expect(clonePath).to.equal(EXPECTED_CLONE_PATH);
      expect(execFileSyncStub).to.have.been.calledOnce;

      // execFileSync(file, args, options) — file is args[0], args array is args[1]
      expect(execFileSyncStub.firstCall.args[0]).to.equal('/opt/bin/git');

      const gitArgs = getGitArgs(execFileSyncStub.firstCall);
      const gitArgsStr = getGitArgsStr(execFileSyncStub.firstCall);
      expect(gitArgsStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(gitArgsStr).to.include('x-api-key: aso-cm-repo-service');
      expect(gitArgsStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
      expect(gitArgsStr).to.include(`${TEST_ENV.CM_REPO_URL}/api/program/${TEST_PROGRAM_ID}/repository/${TEST_REPO_ID}.git`);
      expect(gitArgs).to.include(EXPECTED_CLONE_PATH);
    });

    it('removes existing clone path before cloning', async () => {
      setupImsTokenNock();
      existsSyncStub.withArgs(EXPECTED_CLONE_PATH).returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, TEST_IMS_ORG_ID);

      expect(rmSyncStub).to.have.been.calledWith(
        EXPECTED_CLONE_PATH,
        { recursive: true, force: true },
      );
    });

    it('throws on git clone failure', async () => {
      setupImsTokenNock();
      execFileSyncStub.throws(new Error('git clone failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.clone(TEST_PROGRAM_ID, TEST_REPO_ID, TEST_IMS_ORG_ID))
        .to.be.rejectedWith('Git command failed');
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
    it('downloads patch from S3 and applies it', async () => {
      const patchContent = 'diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n';

      s3Mock.on(GetObjectCommand).resolves({
        Body: { transformToString: async () => patchContent },
      });

      // existsSync returns true for the patch file in finally block
      existsSyncStub.returns(true);

      const client = CloudManagerClient.createFrom(createContext());
      await client.applyPatch('/tmp/cm-repo-test', 'feature/fix', 's3://my-bucket/patches/fix.diff');

      // Verify S3 download
      const s3Calls = s3Mock.commandCalls(GetObjectCommand);
      expect(s3Calls).to.have.lengthOf(1);
      expect(s3Calls[0].args[0].input.Bucket).to.equal('my-bucket');
      expect(s3Calls[0].args[0].input.Key).to.equal('patches/fix.diff');

      // Verify patch file written
      expect(writeSyncStub).to.have.been.calledOnce;
      expect(writeSyncStub.firstCall.args[1]).to.equal(patchContent);

      // Verify git checkout and apply
      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));
      expect(allGitArgStrs.some((s) => s.includes('checkout') && s.includes('feature/fix'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('apply'))).to.be.true;

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
      // Make git apply fail
      execFileSyncStub.onSecondCall().throws(new Error('apply failed'));

      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.applyPatch('/tmp/cm-repo-test', 'main', 's3://bucket/key'))
        .to.be.rejected;

      expect(unlinkSyncStub).to.have.been.calledOnce;
    });
  });

  describe('commitAndPush', () => {
    it('configures git user, commits, and pushes with auth', async () => {
      setupImsTokenNock();
      const client = CloudManagerClient.createFrom(createContext());

      await client.commitAndPush(
        '/tmp/cm-repo-test',
        'Fix accessibility issue',
        TEST_PROGRAM_ID,
        TEST_REPO_ID,
        TEST_IMS_ORG_ID,
      );

      const allGitArgStrs = execFileSyncStub.getCalls().map((c) => getGitArgsStr(c));

      // Git user config
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.name') && s.includes('test-bot'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('config') && s.includes('user.email') && s.includes('test-bot@example.com'))).to.be.true;

      // Stage and commit
      expect(allGitArgStrs.some((s) => s.includes('add') && s.includes('-A'))).to.be.true;
      expect(allGitArgStrs.some((s) => s.includes('commit') && s.includes('Fix accessibility issue'))).to.be.true;

      // Push with auth
      const pushArgStr = allGitArgStrs.find((s) => s.includes('push'));
      expect(pushArgStr).to.include(`Authorization: Bearer ${TEST_TOKEN}`);
      expect(pushArgStr).to.include('x-api-key: aso-cm-repo-service');
      expect(pushArgStr).to.include(`x-gw-ims-org-id: ${TEST_IMS_ORG_ID}`);
    });
  });

  describe('zipRepository', () => {
    it('throws when clone path does not exist', async () => {
      existsSyncStub.returns(false);
      const client = CloudManagerClient.createFrom(createContext());

      await expect(client.zipRepository('/tmp/cm-repo-nonexistent'))
        .to.be.rejectedWith('Clone path does not exist');
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

  describe('getRepositories', () => {
    it('fetches repositories with correct headers', async () => {
      setupImsTokenNock();

      const repoNock = nock(TEST_ENV.CM_API_URL, {
        reqheaders: {
          authorization: `Bearer ${TEST_TOKEN}`,
          'x-api-key': 'aso-cm-repo-service',
          'x-gw-ims-org-id': TEST_IMS_ORG_ID,
        },
      })
        .get(`/api/program/${TEST_PROGRAM_ID}/repositories`)
        .reply(200, { repositories: [{ id: '1', name: 'repo1' }] });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.getRepositories(TEST_PROGRAM_ID, TEST_IMS_ORG_ID);

      expect(result.repositories).to.have.lengthOf(1);
      expect(repoNock.isDone()).to.be.true;
    });
  });

  describe('getTenants', () => {
    it('fetches tenants with correct headers', async () => {
      setupImsTokenNock();

      const tenantsNock = nock(TEST_ENV.CM_API_URL, {
        reqheaders: {
          'x-gw-ims-org-id': TEST_IMS_ORG_ID,
        },
      })
        .get('/api/tenants')
        .reply(200, { tenants: [{ id: 't1', name: 'Tenant 1' }] });

      const client = CloudManagerClient.createFrom(createContext());
      const result = await client.getTenants(TEST_IMS_ORG_ID);

      expect(result.tenants).to.have.lengthOf(1);
      expect(tenantsNock.isDone()).to.be.true;
    });
  });

  describe('createPullRequest', () => {
    it('creates a PR with correct payload', async () => {
      setupImsTokenNock();

      const prNock = nock(TEST_ENV.CM_API_URL)
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

      nock(TEST_ENV.CM_API_URL)
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
      )).to.be.rejectedWith('CM API request to');
    });
  });
});
