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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import nock from 'nock';

import CloudManagerApiClient from '../src/cloud-manager-api-client.js';

use(chaiAsPromised);

const IMS_HOST = 'ims.example.com';
const API_HOST = 'https://ssg-stage.private.example.io';

const TEST_ENV = {
  CM_CLIENT_ID: 'cm-client-id',
  CM_CLIENT_SECRET: 'cm-client-secret',
  CM_SCOPES: 'openid,AdobeID',
  CM_IMS_ORG_ID: 'org@AdobeOrg',
  CM_PRIVATE_API_URL: API_HOST,
  IMS_HOST,
};

const PROGRAM_ID = '12345';
const REPO_ID = '67890';

function createLog() {
  return {
    info: sinon.stub(),
    debug: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
  };
}

function createContext(envOverrides = {}) {
  return { env: { ...TEST_ENV, ...envOverrides }, log: createLog() };
}

function mockImsToken() {
  return nock(`https://${IMS_HOST}`)
    .persist()
    .post('/ims/token/v3')
    .reply(200, { access_token: 'cm-access-token', token_type: 'bearer', expires_in: 3600 });
}

describe('CloudManagerApiClient', () => {
  beforeEach(() => {
    mockImsToken();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createFrom', () => {
    it('creates a client from a valid context', () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      expect(client).to.be.instanceOf(CloudManagerApiClient);
    });

    it('creates a client when context has no logger (defaults to console)', () => {
      const client = CloudManagerApiClient.createFrom({ env: { ...TEST_ENV } });
      expect(client).to.be.instanceOf(CloudManagerApiClient);
    });

    it('strips trailing slashes from CM_PRIVATE_API_URL', async () => {
      const client = CloudManagerApiClient.createFrom(createContext({ CM_PRIVATE_API_URL: `${API_HOST}///` }));
      const scope = nock(API_HOST)
        .get(`/api/program/${PROGRAM_ID}`)
        .reply(200, { imsOrgId: 'x@AdobeOrg' });
      const result = await client.getProgram(PROGRAM_ID);
      expect(result.imsOrgId).to.equal('x@AdobeOrg');
      scope.done();
    });

    ['CM_CLIENT_ID', 'CM_CLIENT_SECRET', 'CM_SCOPES',
      'CM_IMS_ORG_ID', 'CM_PRIVATE_API_URL', 'IMS_HOST'].forEach((key) => {
      it(`throws when ${key} is missing`, () => {
        expect(() => CloudManagerApiClient.createFrom(createContext({ [key]: undefined })))
          .to.throw('CloudManagerApiClient requires');
      });
    });
  });

  describe('constructor', () => {
    it('defaults the logger to console when omitted', () => {
      const client = new CloudManagerApiClient({ baseUrl: API_HOST }, {});
      expect(client.log).to.equal(console);
    });
  });

  describe('request auth headers', () => {
    it('sends Bearer token, x-api-key and x-gw-ims-org-id', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      const scope = nock(API_HOST, {
        reqheaders: {
          authorization: 'Bearer cm-access-token',
          'x-api-key': 'cm-client-id',
          'x-gw-ims-org-id': 'org@AdobeOrg',
        },
      })
        .get(`/api/program/${PROGRAM_ID}`)
        .reply(200, { imsOrgId: 'y@AdobeOrg' });
      const result = await client.getProgram(PROGRAM_ID);
      expect(result.imsOrgId).to.equal('y@AdobeOrg');
      scope.done();
    });

    it('throws with response body detail on a non-2xx response', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST)
        .get(`/api/program/${PROGRAM_ID}`)
        .reply(404, 'program not found');
      await expect(client.getProgram(PROGRAM_ID))
        .to.be.rejectedWith('CM API request failed: GET /program/12345 -> HTTP 404 - program not found');
    });

    it('throws without body detail when the error body is empty', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST)
        .get(`/api/program/${PROGRAM_ID}`)
        .reply(500, '');
      await expect(client.getProgram(PROGRAM_ID))
        .to.be.rejectedWith('CM API request failed: GET /program/12345 -> HTTP 500');
    });
  });

  describe('getProductionPipeline', () => {
    const pipelinesUrl = `/api/program/${PROGRAM_ID}/pipelines`;

    it('returns repositoryId and branch from the STAGE_PROD CI_CD pipeline', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {
        _embedded: {
          pipelines: [
            { type: 'CI_CD', buildTarget: 'DEV', phases: [{ type: 'BUILD', repositoryId: 1, branch: 'dev' }] },
            { type: 'CI_CD', buildTarget: 'STAGE_PROD', phases: [{ type: 'BUILD', repositoryId: 67890, branch: 'main' }] },
          ],
        },
      });
      const result = await client.getProductionPipeline(PROGRAM_ID);
      expect(result).to.deep.equal({ repositoryId: '67890', branch: 'main' });
    });

    it('falls back to the PROD CI_CD pipeline when STAGE_PROD is absent', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {
        _embedded: {
          pipelines: [
            { type: 'CI_CD', buildTarget: 'PROD', phases: [{ type: 'BUILD', repositoryId: '42', branch: 'release' }] },
          ],
        },
      });
      const result = await client.getProductionPipeline(PROGRAM_ID);
      expect(result).to.deep.equal({ repositoryId: '42', branch: 'release' });
    });

    it('throws when no production pipeline exists', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, { _embedded: { pipelines: [{ type: 'CI_CD', buildTarget: 'DEV' }] } });
      await expect(client.getProductionPipeline(PROGRAM_ID))
        .to.be.rejectedWith('No production pipeline (CI_CD/STAGE_PROD|PROD) found for program 12345');
    });

    it('throws when the response has no _embedded pipelines', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {});
      await expect(client.getProductionPipeline(PROGRAM_ID))
        .to.be.rejectedWith('No production pipeline');
    });

    it('throws when the production pipeline has no BUILD phase', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {
        _embedded: { pipelines: [{ type: 'CI_CD', buildTarget: 'STAGE_PROD' }] },
      });
      await expect(client.getProductionPipeline(PROGRAM_ID))
        .to.be.rejectedWith('No BUILD phase found in production pipeline for program 12345');
    });

    it('throws when repositoryId is missing in the BUILD phase', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {
        _embedded: { pipelines: [{ type: 'CI_CD', buildTarget: 'STAGE_PROD', phases: [{ type: 'BUILD', branch: 'main' }] }] },
      });
      await expect(client.getProductionPipeline(PROGRAM_ID))
        .to.be.rejectedWith('repositoryId or branch missing in BUILD phase for program 12345');
    });

    it('throws when branch is missing in the BUILD phase', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(pipelinesUrl).reply(200, {
        _embedded: { pipelines: [{ type: 'CI_CD', buildTarget: 'STAGE_PROD', phases: [{ type: 'BUILD', repositoryId: 1 }] }] },
      });
      await expect(client.getProductionPipeline(PROGRAM_ID))
        .to.be.rejectedWith('repositoryId or branch missing in BUILD phase for program 12345');
    });
  });

  describe('getRepository', () => {
    const repoUrl = `/api/program/${PROGRAM_ID}/repository/${REPO_ID}`;

    it('returns url and type', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(repoUrl).reply(200, { repositoryUrl: 'https://github.com/o/r', type: 'github' });
      const result = await client.getRepository(PROGRAM_ID, REPO_ID);
      expect(result).to.deep.equal({ url: 'https://github.com/o/r', type: 'github' });
    });

    it('defaults url and type to empty strings when absent', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(repoUrl).reply(200, {});
      const result = await client.getRepository(PROGRAM_ID, REPO_ID);
      expect(result).to.deep.equal({ url: '', type: '' });
    });
  });

  describe('getProgram', () => {
    it('returns imsOrgId', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(`/api/program/${PROGRAM_ID}`).reply(200, { imsOrgId: 'z@AdobeOrg' });
      const result = await client.getProgram(PROGRAM_ID);
      expect(result).to.deep.equal({ imsOrgId: 'z@AdobeOrg' });
    });

    it('defaults imsOrgId to an empty string when absent', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST).get(`/api/program/${PROGRAM_ID}`).reply(200, {});
      const result = await client.getProgram(PROGRAM_ID);
      expect(result).to.deep.equal({ imsOrgId: '' });
    });
  });

  describe('resolveCodeConfig', () => {
    it('resolves the full code config from pipeline + repository', async () => {
      const client = CloudManagerApiClient.createFrom(createContext());
      nock(API_HOST)
        .get(`/api/program/${PROGRAM_ID}/pipelines`)
        .reply(200, {
          _embedded: {
            pipelines: [
              { type: 'CI_CD', buildTarget: 'STAGE_PROD', phases: [{ type: 'BUILD', repositoryId: 67890, branch: 'main' }] },
            ],
          },
        })
        .get(`/api/program/${PROGRAM_ID}/repository/67890`)
        .reply(200, { repositoryUrl: 'https://git.cloudmanager.adobe.com/org/repo', type: 'standard' });

      const result = await client.resolveCodeConfig(PROGRAM_ID);
      expect(result).to.deep.equal({
        owner: '12345',
        repo: '67890',
        type: 'standard',
        url: 'https://git.cloudmanager.adobe.com/org/repo',
        ref: 'main',
      });
    });
  });
});
