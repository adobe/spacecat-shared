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

/* eslint-env mocha */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import BrandClient from '../src/index.js';

use(chaiAsPromised);

describe('BrandClient', () => {
  const validApiBaseUrl = 'https://brand.adobe.io';
  const validApiKey = 'test-api-key';
  const validImsOrgId = '36031A57899DEACD0A49402F@AdobeOrg';
  const validImsAccessToken = 'Bearer valid-ims-token';
  const validBrandId = 'brand123';
  const mockLog = {
    debug: () => { },
    info: () => { },
    error: () => { },
  };

  const validImsConfig = {
    host: 'ims-host',
    clientId: 'client-id',
    clientCode: 'client-code',
    clientSecret: 'client-secret',
  };

  const context = {
    env: {
      BRAND_API_BASE_URL: validApiBaseUrl,
      BRAND_API_KEY: validApiKey,
    },
    log: mockLog,
  };

  beforeEach(() => {
    nock.cleanAll();
  });

  it('creates a new instance when none exists in context', () => {
    const client = BrandClient.createFrom(context);
    expect(client).to.be.instanceOf(BrandClient);
    expect(context.brandClient).to.equal(client);
  });

  it('returns existing instance from context', () => {
    const firstClient = BrandClient.createFrom(context);
    const secondClient = BrandClient.createFrom(context);
    expect(secondClient).to.equal(firstClient);
  });

  it('throws error for invalid API base URL', () => {
    expect(() => new BrandClient({ apiBaseUrl: 'invalid-url', apiKey: validApiKey }, mockLog))
      .to.throw('Invalid Brand API Base URL');
  });

  it('throws error for missing API key', () => {
    expect(() => new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: '' }, mockLog))
      .to.throw('Invalid Brand API Key');
  });

  describe('getBrandsForOrganization', () => {
    it('fetches brands successfully', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      const mockBrands = {
        libraries: [{
          library_urn: 'lib1',
          name: 'Brand 1',
          org_id: validImsOrgId,
          created_date: '2024-01-01T00:00:00.000Z',
          modified_date: '2024-01-02T00:00:00.000Z',
        }],
      };

      nock(validApiBaseUrl)
        .get('/api/v1/libraries?roles=BRAND&itemFilter=publishedBrands')
        .reply(200, mockBrands);

      const result = await client.getBrandsForOrganization(validImsOrgId, validImsAccessToken);
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.include({
        id: 'lib1',
        name: 'Brand 1',
        imsOrgId: validImsOrgId,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
    });

    it('throws error for invalid IMS org ID', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandsForOrganization('invalid-org', validImsAccessToken))
        .to.be.rejectedWith('Invalid IMS Org ID');
    });

    it('throws error for invalid IMS access token', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandsForOrganization(validImsOrgId, ''))
        .to.be.rejectedWith('Invalid IMS Access Token');
    });

    it('handles API error response', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      nock(validApiBaseUrl)
        .get('/api/v1/libraries?roles=BRAND&itemFilter=publishedBrands')
        .reply(500);

      await expect(client.getBrandsForOrganization(validImsOrgId, validImsAccessToken))
        .to.be.rejectedWith(`Error getting brands for organization ${validImsOrgId}: Internal Server Error`);
    });

    it('handles JSON parsing error', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      nock(validApiBaseUrl)
        .get('/api/v1/libraries?roles=BRAND&itemFilter=publishedBrands')
        .reply(200, 'invalid json');

      await expect(client.getBrandsForOrganization(validImsOrgId, validImsAccessToken))
        .to.be.rejectedWith(`Error getting brands for organization ${validImsOrgId} with imsAccessToken`);
    });
  });

  describe('getBrandGuidelines', () => {
    it('fetches brand guidelines successfully', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      const mockGuidelines = {
        library_urn: validBrandId,
        name: 'Test Brand',
        org_id: validImsOrgId,
        created_date: '2024-01-01T00:00:00.000Z',
        modified_date: '2024-01-02T00:00:00.000Z',
        details: {
          'brand#copyGuidelines': {
            toneOfVoice: ['friendly'],
            coreValues: ['innovation'],
            guidelines: ['be clear'],
            restrictions: ['no jargon'],
            additionalGuidelines: ['extra info'],
          },
        },
      };

      // Mock IMS token endpoint
      nock('https://ims-host')
        .post('/ims/token/v4')
        .reply(200, { access_token: 'service-token' });

      // Mock brand guidelines endpoint
      nock(validApiBaseUrl)
        .get(`/api/v1/libraries/${validBrandId}?selector=details`)
        .reply(200, mockGuidelines);

      const result = await client.getBrandGuidelines(validBrandId, validImsOrgId, validImsConfig);
      expect(result).to.deep.include({
        id: validBrandId,
        name: 'Test Brand',
        imsOrgId: validImsOrgId,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        toneOfVoice: ['friendly'],
        coreValues: ['innovation'],
        guidelines: ['be clear'],
        restrictions: ['no jargon'],
        additionalGuidelines: ['extra info'],
      });
    });

    it('throws error for invalid brand ID', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines('', validImsOrgId, validImsConfig))
        .to.be.rejectedWith('Invalid brand ID: ');
    });

    it('throws error for invalid IMS org ID', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines(validBrandId, 'invalid-ims-org', validImsConfig))
        .to.be.rejectedWith('Invalid IMS Org ID: invalid-ims-org');
    });

    it('throws error for invalid IMS config', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines(validBrandId, validImsOrgId, {}))
        .to.be.rejectedWith('Invalid IMS Config: {}');
    });

    it('throws error when brand does not belong to org', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      const mockGuidelines = {
        library_urn: validBrandId,
        name: 'Test Brand',
        org_id: 'different-org@AdobeOrg',
      };

      // Mock IMS token endpoint
      nock('https://ims-host')
        .post('/ims/token/v4')
        .reply(200, { access_token: 'service-token' });

      // Mock brand guidelines endpoint
      nock(validApiBaseUrl)
        .get(`/api/v1/libraries/${validBrandId}?selector=details`)
        .reply(200, mockGuidelines);

      await expect(client.getBrandGuidelines(validBrandId, validImsOrgId, validImsConfig))
        .to.be.rejectedWith(`Brand ${validBrandId} not found for org ${validImsOrgId}`);
    });

    it('handles API error response', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);

      // Mock IMS token endpoint
      nock('https://ims-host')
        .post('/ims/token/v4')
        .reply(200, { access_token: 'service-token' });

      // Mock brand guidelines endpoint with error
      nock(validApiBaseUrl)
        .get(`/api/v1/libraries/${validBrandId}?selector=details`)
        .reply(500);

      await expect(client.getBrandGuidelines(validBrandId, validImsOrgId, validImsConfig))
        .to.be.rejectedWith(`Error getting brand guidelines for brand ${validBrandId}: 500`);
    });

    it('reuses cached IMS access token', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      const mockGuidelines = {
        library_urn: validBrandId,
        name: 'Test Brand',
        org_id: validImsOrgId,
      };

      // Mock IMS token endpoint - should only be called once
      const imsMock = nock('https://ims-host')
        .post('/ims/token/v4')
        .reply(200, { access_token: 'service-token' });

      // Mock brand guidelines endpoint for two calls
      nock(validApiBaseUrl)
        .get(`/api/v1/libraries/${validBrandId}?selector=details`)
        .twice()
        .reply(200, mockGuidelines);

      // Make two calls
      await client.getBrandGuidelines(validBrandId, validImsOrgId, validImsConfig);
      await client.getBrandGuidelines(validBrandId, validImsOrgId, validImsConfig);

      // Verify IMS token was only requested once
      expect(imsMock.isDone()).to.equal(true);
    });
  });
});
