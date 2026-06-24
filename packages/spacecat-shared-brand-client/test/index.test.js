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

/* eslint-disable max-len */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import BrandClient, { BrandGovernanceClient } from '../src/index.js';

use(chaiAsPromised);

describe('BrandClient', () => {
  const validApiBaseUrl = 'https://brand.adobe.io';
  const validApiKey = 'test-api-key';
  const validImsOrgId = '36031A57899DEACD0A49402F@AdobeOrg';
  const validImsAccessToken = 'Bearer valid-ims-token';
  const validBrandId = 'brand123';
  const validUserId = 'user123';
  const brandConfig = {
    brandId: validBrandId,
    userId: validUserId,
  };
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

      const result = await client.getBrandGuidelines(brandConfig, validImsOrgId, validImsConfig);
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

    it('throws error for invalid brand id', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines({}, validImsOrgId, validImsConfig))
        .to.be.rejectedWith('Invalid brand ID or user ID');
    });

    it('throws error for invalid brand userId', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines({ ...brandConfig, userId: '' }, validImsOrgId, validImsConfig))
        .to.be.rejectedWith('Invalid brand ID or user ID');
    });

    it('throws error for invalid IMS org ID', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines(brandConfig, 'invalid-ims-org', validImsConfig))
        .to.be.rejectedWith('Invalid IMS Org ID: invalid-ims-org');
    });

    it('throws error for invalid IMS config', async () => {
      const client = new BrandClient({ apiBaseUrl: validApiBaseUrl, apiKey: validApiKey }, mockLog);
      await expect(client.getBrandGuidelines(brandConfig, validImsOrgId, {}))
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

      await expect(client.getBrandGuidelines(brandConfig, validImsOrgId, validImsConfig))
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

      await expect(client.getBrandGuidelines(brandConfig, validImsOrgId, validImsConfig))
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
      await client.getBrandGuidelines(brandConfig, validImsOrgId, validImsConfig);
      await client.getBrandGuidelines(brandConfig, validImsOrgId, validImsConfig);

      // Verify IMS token was only requested once
      expect(imsMock.isDone()).to.equal(true);
    });
  });
});

describe('BrandGovernanceClient', () => {
  const validGovApiBaseUrl = 'https://brand-governance-agent.adobe.io';
  const validGovApiKey = 'gov-api-key';
  const validSiteBaseUrl = 'https://example.com';
  const validImsOrgId = '36031A57899DEACD0A49402F@AdobeOrg';
  const validGovImsConfig = {
    host: 'https://ims-gov-host',
    clientId: 'gov-client-id',
    clientCode: 'gov-client-code',
    clientSecret: 'gov-client-secret',
  };
  const mockLog = {
    debug: () => {},
    info: () => {},
    error: () => {},
  };
  const mockBrand = {
    id: 'brand-gov-123',
    name: 'Test Brand',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  const mockImsToken = () => nock('https://ims-gov-host')
    .post('/ims/token/v4')
    .reply(200, { access_token: 'gov-service-token' });

  const mockBrandFromUrl = (brand, status = 200) => {
    const scope = nock(validGovApiBaseUrl)
      .get('/api/v1/brands/from-url')
      .query({ url: validSiteBaseUrl });
    return status === 200 ? scope.reply(200, brand) : scope.reply(status);
  };

  const mockBrandProfile = (brandId, profile, status = 200) => {
    const scope = nock(validGovApiBaseUrl).get(`/api/v1/brands/${brandId}/profile`);
    return status === 200 ? scope.reply(200, profile) : scope.reply(status);
  };

  beforeEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('creates instance with valid config', () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      expect(client).to.be.instanceOf(BrandGovernanceClient);
    });

    it('throws error for invalid API base URL', () => {
      expect(() => new BrandGovernanceClient({ apiBaseUrl: 'not-a-url', apiKey: validGovApiKey }, mockLog))
        .to.throw('Invalid Brand Governance API Base URL');
    });

    it('throws error for missing API key', () => {
      expect(() => new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: '' }, mockLog))
        .to.throw('Invalid Brand Governance API Key');
    });
  });

  describe('createFrom', () => {
    it('creates new instance from context env and caches it', () => {
      const ctx = {
        env: { BRAND_GOV_API_BASE_URL: validGovApiBaseUrl, BRAND_GOV_API_KEY: validGovApiKey },
        log: mockLog,
      };
      const client = BrandGovernanceClient.createFrom(ctx);
      expect(client).to.be.instanceOf(BrandGovernanceClient);
      expect(ctx.brandGovernanceClient).to.equal(client);
    });

    it('returns cached instance from context without re-constructing', () => {
      const existingClient = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      const ctx = { env: {}, log: mockLog, brandGovernanceClient: existingClient };
      expect(BrandGovernanceClient.createFrom(ctx)).to.equal(existingClient);
    });
  });

  describe('getBrandGuidelinesForUrl', () => {
    const mockProfile = {
      data: {
        id: 'brand-gov-123',
        brand_name: 'Test Brand',
        identity: { traits: ['Premium', 'Modern'], core_values: ['Quality'] },
        voice_and_tone: { guardrails: ['Be concise'], formality_label: 'professional' },
        language: { preferred_patterns: ['Active voice'], avoid_patterns: ['Jargon'] },
        editorial: { dos: ['Use facts'], donts: ['Exaggerate'] },
      },
      meta: { version: 1 },
    };

    it('fetches raw brand profile data from /profile endpoint', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl(mockBrand);
      mockBrandProfile(mockBrand.id, mockProfile);

      const result = await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);

      expect(result).to.deep.equal(mockProfile);
    });

    it('returns null when brand is not registered (404 from from-url)', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl(null, 404);

      const result = await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);
      expect(result).to.be.null;
    });

    it('returns null when brand has no profile (404 from profile endpoint)', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl(mockBrand);
      mockBrandProfile(mockBrand.id, null, 404);

      const result = await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);
      expect(result).to.be.null;
    });

    it('throws when brand resolved by URL has no id (guards against /brands/undefined/profile)', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl({ name: 'No ID Brand' });

      await expect(client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig))
        .to.be.rejectedWith(`Brand resolved for URL ${validSiteBaseUrl} has no id`);
    });

    it('sends x-gw-ims-org-id, x-api-key, and Authorization headers on all requests', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      nock('https://ims-gov-host')
        .post('/ims/token/v4')
        .reply(200, { access_token: 'gov-service-token' });

      nock(validGovApiBaseUrl)
        .get('/api/v1/brands/from-url')
        .query({ url: validSiteBaseUrl })
        .matchHeader('x-gw-ims-org-id', validImsOrgId)
        .matchHeader('x-api-key', validGovApiKey)
        .matchHeader('Authorization', 'Bearer gov-service-token')
        .reply(200, mockBrand);

      nock(validGovApiBaseUrl)
        .get(`/api/v1/brands/${mockBrand.id}/profile`)
        .matchHeader('x-gw-ims-org-id', validImsOrgId)
        .matchHeader('x-api-key', validGovApiKey)
        .matchHeader('Authorization', 'Bearer gov-service-token')
        .reply(200, mockProfile);

      const result = await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);
      expect(result).to.not.be.null;
      expect(nock.isDone()).to.equal(true);
    });

    it('throws error for invalid site base URL', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl('not-a-url', validImsOrgId, validGovImsConfig))
        .to.be.rejectedWith('Invalid site base URL');
    });

    it('throws error for invalid IMS org ID', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl(validSiteBaseUrl, 'invalid-org', validGovImsConfig))
        .to.be.rejectedWith('Invalid IMS Org ID');
    });

    it('throws error when IMS config host is missing', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl(
        validSiteBaseUrl,
        validImsOrgId,
        { clientId: 'id', clientCode: 'code', clientSecret: 'secret' },
      )).to.be.rejectedWith('Invalid IMS Config: missing fields [host]');
    });

    it('throws error when IMS config clientId is missing', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl(
        validSiteBaseUrl,
        validImsOrgId,
        { host: 'https://ims-gov-host', clientCode: 'code', clientSecret: 'secret' },
      )).to.be.rejectedWith('Invalid IMS Config: missing fields [clientId]');
    });

    it('throws error when IMS config clientCode is missing', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl(
        validSiteBaseUrl,
        validImsOrgId,
        { host: 'https://ims-gov-host', clientId: 'id', clientSecret: 'secret' },
      )).to.be.rejectedWith('Invalid IMS Config: missing fields [clientCode]');
    });

    it('throws error when IMS config clientSecret is missing', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);
      await expect(client.getBrandGuidelinesForUrl(
        validSiteBaseUrl,
        validImsOrgId,
        { host: 'https://ims-gov-host', clientId: 'id', clientCode: 'code' },
      )).to.be.rejectedWith('Invalid IMS Config: missing fields [clientSecret]');
    });

    it('throws error when IMS token response is empty', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      nock('https://ims-gov-host')
        .post('/ims/token/v4')
        .reply(200, {});

      await expect(client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig))
        .to.be.rejectedWith('Failed to obtain IMS access token');
    });

    it('throws error when brand URL lookup returns non-404 error', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl(null, 500);

      await expect(client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig))
        .to.be.rejectedWith(`Error resolving brand for URL ${validSiteBaseUrl}: 500`);
    });

    it('throws error when brand profile fetch fails', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      mockImsToken();
      mockBrandFromUrl(mockBrand);
      mockBrandProfile(mockBrand.id, null, 503);

      await expect(client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig))
        .to.be.rejectedWith(`Error fetching brand profile for brand ${mockBrand.id}: 503`);
    });

    it('fetches a fresh IMS token on every call to avoid stale token errors on warm Lambdas', async () => {
      const client = new BrandGovernanceClient({ apiBaseUrl: validGovApiBaseUrl, apiKey: validGovApiKey }, mockLog);

      nock('https://ims-gov-host')
        .post('/ims/token/v4')
        .twice()
        .reply(200, { access_token: 'gov-service-token' });

      nock(validGovApiBaseUrl)
        .get('/api/v1/brands/from-url')
        .query({ url: validSiteBaseUrl })
        .twice()
        .reply(200, mockBrand);

      nock(validGovApiBaseUrl)
        .get(`/api/v1/brands/${mockBrand.id}/profile`)
        .twice()
        .reply(200, mockProfile);

      await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);
      await client.getBrandGuidelinesForUrl(validSiteBaseUrl, validImsOrgId, validGovImsConfig);

      expect(nock.isDone()).to.equal(true);
    });
  });
});
