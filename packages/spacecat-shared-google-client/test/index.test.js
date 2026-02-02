/*
 * Copyright 2024 Adobe. All rights reserved.
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

import { expect } from 'chai';
import sinon from 'sinon';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import nock from 'nock';
import GoogleClient from '../src/index.js';

describe('GoogleClient', () => {
  const context = {
    env: {
      GOOGLE_CLIENT_ID: 'testClientId',
      GOOGLE_CLIENT_SECRET: 'testClientSecret',
      GOOGLE_REDIRECT_URI: 'testRedirectUri',
    },
    func: {
      version: 'v1',
    },
    log: {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    },
  };

  let defaultConfig;

  const baseURL = 'https://example.com/';
  const auditURL = 'www.example.com';
  const startDateString = '2024-01-01';
  const startDate = new Date(startDateString);
  const endDateString = '2024-01-31';
  const endDate = new Date(endDateString);

  let oauth2ClientStub;

  const stubSecretManager = (config) => {
    sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
      SecretString: JSON.stringify(config),
    });
  };

  beforeEach(() => {
    oauth2ClientStub = sinon.createStubInstance(OAuth2Client);
    oauth2ClientStub.refreshAccessToken.resolves({
      credentials: {
        access_token: 'newAccessToken',
        expiry_date: Date.now() + 3600 * 1000,
      },
    });

    sinon.stub(OAuth2Client.prototype, 'constructor').callsFake(() => oauth2ClientStub);
    sinon.stub(OAuth2Client.prototype, 'setCredentials').callsFake(function (credentials) {
      this.credentials = credentials;
    });
    sinon.stub(OAuth2Client.prototype, 'refreshAccessToken').callsFake(() => oauth2ClientStub.refreshAccessToken());
    defaultConfig = {
      access_token: 'testAccessToken',
      refresh_token: 'testRefreshToken',
      token_type: 'Bearer',
      site_url: baseURL,
      expiry_date: Date.now() * 1000,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFrom', () => {
    it('should create a new GoogleClient instance with the provided context', async () => {
      stubSecretManager(defaultConfig);

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      expect(googleClient).to.be.instanceOf(GoogleClient);
      expect(googleClient.authClient).to.be.instanceOf(OAuth2Client);
      expect(googleClient.log).to.equal(context.log);
    });

    it('should throw an error if the google client cannot be created', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').rejects(new Error('Secrets Manager error'));
      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Secrets Manager error');
      }
    });

    it('should throw an error if the base URL is invalid', async () => {
      try {
        await GoogleClient.createFrom(context, 'not a valid url');
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Invalid base URL');
      }
    });

    it('should throw an error if the base URL in secrets is invalid', async () => {
      stubSecretManager({ ...defaultConfig, site_url: 'not a valid url' });

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Invalid site URL in secret');
      }
    });

    it('should refresh access token when it is expired', async () => {
      stubSecretManager({
        ...defaultConfig,
        expiry_date: Date.now() - 10000,
      });

      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: webmastersStub,
        },
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.listSites();
      expect(result).to.eql(testResult);
      expect(oauth2ClientStub.refreshAccessToken.calledOnce).to.be.true;
    });

    it('should throw an error if the token cannot be refreshed', async () => {
      oauth2ClientStub.refreshAccessToken.rejects(new Error('Token refresh failed'));
      stubSecretManager({
        ...defaultConfig,
        expiry_date: Date.now() - 10000,
      });
      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Token refresh failed');
      }
    });
  });

  describe('getOrganicSearchData', () => {
    beforeEach(() => {
      nock(baseURL)
        .get('/')
        .reply(301, {}, { Location: 'https://www.example.com' });
    });
    it('should return organic search data for the provided baseURL, startDate, and endDate', async () => {
      stubSecretManager(defaultConfig);
      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const expectedRequest = {
        siteUrl: baseURL,
        requestBody: {
          startDate: startDateString,
          endDate: endDateString,
          dimensions: ['page'],
          startRow: 0,
          rowLimit: 1000,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'contains',
                  expression: auditURL,
                },
              ],
            },
          ],
        },
      };
      const result = await googleClient.getOrganicSearchData(startDate, endDate, ['page']);
      expect(context.log.debug.calledWith(`Retrieving organic search data: ${JSON.stringify(expectedRequest)}`)).to.be.true;
      expect(result).to.eql(testResult);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should return organic search data for the provided baseURL, startDate, and endDate if site url is a domain property', async () => {
      defaultConfig.site_url = 'sc-domain:example.com';
      stubSecretManager(defaultConfig);
      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const expectedRequest = {
        siteUrl: baseURL,
        requestBody: {
          startDate: startDateString,
          endDate: endDateString,
          dimensions: ['page'],
          startRow: 0,
          rowLimit: 1000,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'contains',
                  expression: auditURL,
                },
              ],
            },
          ],
        },
      };
      const result = await googleClient.getOrganicSearchData(startDate, endDate, ['page']);
      expect(context.log.debug.calledWith(`Retrieving organic search data: ${JSON.stringify(expectedRequest)}`)).to.be.true;
      expect(result).to.eql(testResult);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      stubSecretManager(defaultConfig);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: sinon.stub().rejects(new Error('Google API call failed')),
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      try {
        await googleClient.getOrganicSearchData(startDate, endDate);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Google API call failed');
      }
    });

    it('should return 500 when access token is missing', async () => {
      delete defaultConfig.access_token;
      stubSecretManager(defaultConfig);

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing access token in secret');
      }
    });

    it('should return 500 when refresh token is missing', async () => {
      delete defaultConfig.refresh_token;
      stubSecretManager(defaultConfig);

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing refresh token in secret');
      }
    });

    it('should throw an error if the date format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData('2024-01-01', '2024-05-14');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid date format');
      }
    });

    it('should throw an error if the dimensions format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, 'page');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid dimensions format');
      }
    });

    it('should throw an error if the row limit format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], '1000');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid row limit or start row format');
      }
    });

    it('should throw an error if the row limit is greater than 25000', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], 25001);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Row limit must be between 1 and 25000');
      }
    });

    it('should throw an error if the row limit is less than 1', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], 0);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Row limit must be between 1 and 25000');
      }
    });

    it('should throw an error if the start row is less than 0', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], 1000, -1);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Start row must be greater than or equal to 0');
      }
    });

    it('should throw an error if site URL is invalid', async () => {
      const invalidUrl = 'not a valid url';
      stubSecretManager({ ...defaultConfig, site_url: invalidUrl });
      try {
        const googleClient = await GoogleClient.createFrom(context, baseURL);
        await googleClient.getOrganicSearchData(startDate, endDate);
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving organic search data from Google API: Invalid site URL in secret (${invalidUrl})`);
      }
    });

    it('should throw an error if site URL is not defined', async () => {
      delete defaultConfig.site_url;
      stubSecretManager(defaultConfig);
      try {
        const googleClient = await GoogleClient.createFrom(context, baseURL);
        await googleClient.getOrganicSearchData(startDate, endDate);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid site URL in secret (undefined)');
      }
    });
  });

  describe('listSites', () => {
    const sites = {
      data: {
        siteEntry: [
          { siteUrl: 'https://www.example1.com' },
          { siteUrl: 'https://www.example2.com' },
        ],
      },
    };

    it('should return a list of sites', async () => {
      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(sites);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      const result = await googleClient.listSites();
      expect(result).to.eql(sites);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      const failMessage = 'Google API call failed';
      stubSecretManager(defaultConfig);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: sinon.stub().rejects(new Error(failMessage)),
        },
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.listSites();
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving sites from Google API: ${failMessage}`);
      }
    });
  });

  describe('getSite', () => {
    it('should return information about a specific site', async () => {
      const siteUrl = 'https://www.example.com/';
      const siteInfo = {
        data: {
          siteUrl,
          permissionLevel: 'siteOwner',
        },
      };

      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(siteInfo);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          get: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.getSite(siteUrl);

      expect(result).to.eql(siteInfo);
      expect(webmastersStub.calledOnce).to.be.true;
      expect(webmastersStub.calledWith({ siteUrl })).to.be.true;
    });

    it('should work with domain properties', async () => {
      const siteUrl = 'sc-domain:example.com';
      const siteInfo = {
        data: {
          siteUrl,
          permissionLevel: 'siteOwner',
        },
      };

      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(siteInfo);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          get: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.getSite(siteUrl);

      expect(result).to.eql(siteInfo);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should throw an error if the site URL is invalid', async () => {
      const invalidUrl = 'not a valid url';
      stubSecretManager(defaultConfig);

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getSite(invalidUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving site information: Invalid site URL format (${invalidUrl})`);
      }
    });

    it('should handle errors when the Google API call fails', async () => {
      const siteUrl = 'https://www.example.com/';
      const failMessage = 'Google API call failed';
      stubSecretManager(defaultConfig);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          get: sinon.stub().rejects(new Error(failMessage)),
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getSite(siteUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving site information from Google API: ${failMessage}`);
      }
    });
  });

  describe('getSitemap', () => {
    it('should return information about a specific sitemap', async () => {
      const sitemapUrl = 'https://www.example.com/sitemap.xml';
      const sitemapInfo = {
        data: {
          path: sitemapUrl,
          lastSubmitted: '2024-01-01T00:00:00.000Z',
          isPending: false,
          isSitemapsIndex: false,
          type: 'sitemap',
          lastDownloaded: '2024-01-01T00:00:00.000Z',
          warnings: '0',
          errors: '0',
        },
      };

      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(sitemapInfo);
      sinon.stub(google, 'webmasters').returns({
        sitemaps: {
          get: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.getSitemap(sitemapUrl);

      expect(result).to.eql(sitemapInfo);
      expect(webmastersStub.calledOnce).to.be.true;
      expect(webmastersStub.calledWith({
        siteUrl: baseURL,
        feedpath: sitemapUrl,
      })).to.be.true;
    });

    it('should throw an error if the sitemap URL is invalid', async () => {
      const invalidUrl = 'not a valid url';
      stubSecretManager(defaultConfig);

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getSitemap(invalidUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving sitemap information: Invalid sitemap URL format (${invalidUrl})`);
      }
    });

    it('should handle errors when the Google API call fails', async () => {
      const sitemapUrl = 'https://www.example.com/sitemap.xml';
      const failMessage = 'Google API call failed';
      stubSecretManager(defaultConfig);
      sinon.stub(google, 'webmasters').returns({
        sitemaps: {
          get: sinon.stub().rejects(new Error(failMessage)),
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getSitemap(sitemapUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving sitemap information from Google API: ${failMessage}`);
      }
    });
  });

  describe('listSitemaps', () => {
    it('should return a list of sitemaps for a site', async () => {
      const sitemaps = {
        data: {
          sitemap: [
            {
              path: 'https://www.example.com/sitemap.xml',
              lastSubmitted: '2024-01-01T00:00:00.000Z',
              isPending: false,
              isSitemapsIndex: false,
            },
            {
              path: 'https://www.example.com/sitemap2.xml',
              lastSubmitted: '2024-01-02T00:00:00.000Z',
              isPending: false,
              isSitemapsIndex: false,
            },
          ],
        },
      };

      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(sitemaps);
      sinon.stub(google, 'webmasters').returns({
        sitemaps: {
          list: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.listSitemaps();

      expect(result).to.eql(sitemaps);
      expect(webmastersStub.calledOnce).to.be.true;
      expect(webmastersStub.calledWith({ siteUrl: baseURL })).to.be.true;
    });

    it('should list sitemaps with a sitemap index', async () => {
      const sitemapIndexUrl = 'https://www.example.com/sitemap-index.xml';
      const sitemaps = {
        data: {
          sitemap: [
            {
              path: 'https://www.example.com/sitemap1.xml',
              lastSubmitted: '2024-01-01T00:00:00.000Z',
              isPending: false,
              isSitemapsIndex: false,
            },
          ],
        },
      };

      stubSecretManager(defaultConfig);
      const webmastersStub = sinon.stub().resolves(sitemaps);
      sinon.stub(google, 'webmasters').returns({
        sitemaps: {
          list: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.listSitemaps(sitemapIndexUrl);

      expect(result).to.eql(sitemaps);
      expect(webmastersStub.calledOnce).to.be.true;
      expect(webmastersStub.calledWith({
        siteUrl: baseURL,
        sitemapIndex: sitemapIndexUrl,
      })).to.be.true;
    });

    it('should throw an error if the sitemap index URL is invalid', async () => {
      const invalidUrl = 'not a valid url';
      stubSecretManager(defaultConfig);

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.listSitemaps(invalidUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error listing sitemaps: Invalid sitemap index URL format (${invalidUrl})`);
      }
    });

    it('should handle errors when the Google API call fails', async () => {
      const failMessage = 'Google API call failed';
      stubSecretManager(defaultConfig);
      sinon.stub(google, 'webmasters').returns({
        sitemaps: {
          list: sinon.stub().rejects(new Error(failMessage)),
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.listSitemaps();
      } catch (error) {
        expect(error.message).to.equal(`Error listing sitemaps from Google API: ${failMessage}`);
      }
    });
  });

  describe('urlInspect', () => {
    const apiEndpoint = 'https://searchconsole.googleapis.com';
    const apiPath = '/v1/urlInspection/index:inspect';

    beforeEach(() => {
      stubSecretManager(defaultConfig);
    });

    afterEach(() => {
      nock.cleanAll();
      sinon.restore();
    });

    it('should inspect a valid URL', async () => {
      const url = 'https://example.com/page';
      const mockResponse = {
        inspectionResult: {
          inspectionResultLink: 'https://search.google.com/search-console/inspect?resource_id=https://www.example.com/',
          indexStatusResult: {
            verdict: 'PASS',
            coverageState: 'Submitted and indexed',
            robotsTxtState: 'ALLOWED',
            indexingState: 'INDEXING_ALLOWED',
            lastCrawlTime: '2024-08-13T22:35:22Z',
            pageFetchState: 'SUCCESSFUL',
            googleCanonical: 'https://www.example.com/foo',
            userCanonical: 'https://www.example.com/foo',
            referringUrls: [
              'https://www.example.com/bar',
            ],
            crawledAs: 'MOBILE',
          },
          mobileUsabilityResult: {
            verdict: 'VERDICT_UNSPECIFIED',
          },
          richResultsResult: {
            verdict: 'PASS',
            detectedItems: [
              {
                richResultType: 'Product snippets',
                items: [
                  {
                    name: 'Example Product Name',
                    issues: [
                      {
                        issueMessage: 'Missing field "image"',
                        severity: 'ERROR',
                      },
                    ],
                  },
                ],
              },
              {
                richResultType: 'Merchant listings',
                items: [
                  {
                    name: 'Example Product Name',
                    issues: [
                      {
                        issueMessage: 'Missing field "hasMerchantReturnPolicy"',
                        severity: 'WARNING',
                      },
                      {
                        issueMessage: 'Missing field "shippingDetails"',
                        severity: 'ERROR',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      };

      nock(apiEndpoint)
        .post(apiPath)
        .reply(200, mockResponse);

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.urlInspect(url);
      expect(result).to.deep.equal(mockResponse);
    });

    it('should throw an error for invalid URL format', async () => {
      const invalidUrl = 'invalid-url';
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.urlInspect(invalidUrl);
      } catch (error) {
        expect(error.message).to.equal(`Error inspecting URL: Invalid URL format (${invalidUrl})`);
      }
    });

    it('should throw an error if the API response is not ok', async () => {
      const url = 'https://example.com/page';

      nock(apiEndpoint)
        .post(apiPath)
        .reply(500, 'Bad Request');

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.urlInspect(url);
      } catch (error) {
        expect(error.message).to.equal(`Error inspecting URL ${url}. Returned status 500`);
      }
    });

    it('should throw an error when the response cannot be parsed to json', async () => {
      const url = 'https://example.com/page';
      nock(apiEndpoint)
        .post(apiPath)
        .reply(200, 'Invalid JSON');

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.urlInspect(url);
      } catch (error) {
        expect(error.message).to.equal(`Error parsing result of inspecting URL ${url}: Unexpected token 'I', "Invalid JSON" is not valid JSON`);
      }
    });
  });
});
