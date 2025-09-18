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

import { expect } from 'chai';
import sinon from 'sinon';
import nock from 'nock';
import { determineAEMCSPageId, getPageEditUrl, CONTENT_API_PREFIX } from '../src/aem-content-api-utils.js';

describe('determineAEMCSPageId', () => {
  let mockLog;

  beforeEach(() => {
    nock.cleanAll();
    mockLog = {
      info: sinon.spy(),
      error: sinon.spy(),
      warn: sinon.spy(),
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });
  it('should extract page ID from valid meta tag', async () => {
    const pageURL = 'https://example.com/page';
    const expectedPageId = 'page-12345';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="${expectedPageId}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.equal(expectedPageId);
  });

  it('should extract page ID from self-closing meta tag', async () => {
    const pageURL = 'https://example.com/page';
    const expectedPageId = 'page-self-closing';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="${expectedPageId}" />
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.equal(expectedPageId);
  });

  it('should trim whitespace from extracted page ID', async () => {
    const pageURL = 'https://example.com/page';
    const pageIdWithWhitespace = '  page-with-spaces  ';
    const expectedPageId = 'page-with-spaces';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="${pageIdWithWhitespace}">
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.equal(expectedPageId);
  });

  it('should return null when fetch response is not ok', async () => {
    const pageURL = 'https://example.com/not-found';

    nock('https://example.com')
      .get('/not-found')
      .reply(404, 'Page not found');

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.be.null;
  });

  it('should return null when no meta tag is found', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="A test page">
        </head>
        <body>Content without page ID meta tag</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.be.null;
  });

  it('should return null when meta tag content is empty', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.be.null;
  });

  it('should handle network errors gracefully', async () => {
    const pageURL = 'https://example.com/error';

    nock('https://example.com')
      .get('/error')
      .replyWithError('Network error');

    try {
      await determineAEMCSPageId(pageURL);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error.message).to.include('Network error');
    }
  });

  it('should handle multiple meta tags and return first match', async () => {
    const pageURL = 'https://example.com/page';
    const expectedPageId = 'first-page-id';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="${expectedPageId}">
          <meta name="content-page-id" content="second-page-id">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.equal(expectedPageId);
  });

  it('should handle server error responses', async () => {
    const pageURL = 'https://example.com/server-error';

    nock('https://example.com')
      .get('/server-error')
      .reply(500, 'Internal Server Error');

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.be.null;
  });

  it('should handle empty HTML response', async () => {
    const pageURL = 'https://example.com/empty';

    nock('https://example.com')
      .get('/empty')
      .reply(200, '');

    const result = await determineAEMCSPageId(pageURL);
    expect(result).to.be.null;
  });

  it('should return null when content-page-ref available but authentication is missing', async () => {
    const pageURL1 = 'https://example.com/page1';
    const pageURL2 = 'https://example.com/page2';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-abc123">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page1')
      .reply(200, htmlContent);

    nock('https://example.com')
      .get('/page2')
      .reply(200, htmlContent);

    // Test missing authorURL
    const result1 = await determineAEMCSPageId(pageURL1);
    expect(result1).to.be.null;

    // Test missing bearerToken
    const result2 = await determineAEMCSPageId(pageURL2, 'https://author.example.com');
    expect(result2).to.be.null;
  });

  it('should fallback to content-page-id when content-page-ref is empty', async () => {
    const pageURL = 'https://example.com/page';
    const expectedPageId = 'fallback-page-id';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="">
          <meta name="content-page-id" content="${expectedPageId}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123');
    expect(result).to.equal(expectedPageId);
  });

  it('should trim whitespace from content-page-ref', async () => {
    const pageURL = 'https://example.com/page';
    const contentPageRef = '  content-ref-abc123  ';
    const expectedPageId = 'page-456';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="${contentPageRef}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-abc123`)
      .reply(200, { id: expectedPageId });

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.equal(expectedPageId);
    expect(mockLog.info).to.have.been.calledWith(`Resolving content-page-ref via https://author.example.com${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-abc123 (preferContentApi=true)`);
  });

  it('should use Content API and return page ID from JSON response', async () => {
    const pageURL = 'https://example.com/page';
    const contentPageRef = 'content-ref-abc123';
    const expectedPageId = 'page-456';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="${contentPageRef}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-abc123`)
      .reply(200, { id: expectedPageId });

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.equal(expectedPageId);
    expect(mockLog.info).to.have.been.calledWith(`Resolved pageId: "${expectedPageId}" from JSON directly for ref "${contentPageRef}"`);
  });

  it('should return null when Content API returns JSON without id field', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-no-id">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-no-id`)
      .reply(200, { name: 'some-name' });

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.be.null;
    expect(mockLog.error).to.have.been.calledWith('resolve response did not contain an "id" property.');
  });

  it('should return null when Content API returns empty JSON', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-empty">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-empty`)
      .reply(200, {});

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.be.null;
    expect(mockLog.error).to.have.been.calledWith('resolve response did not contain an "id" property.');
  });

  it('should return null when Content API returns non-200 status', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-fail">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-fail`)
      .reply(500, 'Internal Server Error');

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.be.null;
    expect(mockLog.warn).to.have.been.calledWith('Unexpected status 500 when resolving content-page-ref.');
  });

  it('should return null when Content API fails and no fallback', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-fail-no-fallback">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-fail-no-fallback`)
      .reply(500, 'Internal Server Error');

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true);
    expect(result).to.be.null;
  });

  it('should handle Content API network errors gracefully', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-network-error">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-network-error`)
      .replyWithError('Content API network error');

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true, mockLog);
    expect(result).to.be.null;
    expect(mockLog.error).to.have.been.calledWith('Error while resolving content-page-ref: Content API network error');
  });

  it('should use PSS API and return page ID from text response', async () => {
    const pageURL = 'https://example.com/page';
    const contentPageRef = 'content-ref-abc123';
    const expectedPageId = 'page-456';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="${contentPageRef}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get('/adobe/experimental/pss/pages/resolve?pageRef=content-ref-abc123')
      .reply(200, expectedPageId);

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', false, mockLog);
    expect(result).to.equal(expectedPageId);
    expect(mockLog.info).to.have.been.calledWith(`Resolved pageId: "${expectedPageId}" from JSON directly for ref "${contentPageRef}"`);
  });

  it('should return null when PSS API returns empty text response', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-empty">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get('/adobe/experimental/pss/pages/resolve?pageRef=content-ref-empty')
      .reply(200, '');

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', false, mockLog);
    expect(result).to.be.null;
    expect(mockLog.error).to.have.been.calledWith('resolve response did not contain an "id" property.');
  });

  it('should return null when PSS API returns non-200 status', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="content-ref-fail">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get('/adobe/experimental/pss/pages/resolve?pageRef=content-ref-fail')
      .reply(500, 'Internal Server Error');

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', false, mockLog);
    expect(result).to.be.null;
    expect(mockLog.warn).to.have.been.calledWith('Unexpected status 500 when resolving content-page-ref.');
  });

  it('should prioritize content-page-ref over content-page-id when both are present and API succeeds', async () => {
    const pageURL = 'https://example.com/page';
    const contentPageRef = 'content-ref-priority';
    const contentPageId = 'content-page-id-value';
    const expectedPageId = 'priority-page-id';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="${contentPageRef}">
          <meta name="content-page-id" content="${contentPageId}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    nock('https://author.example.com')
      .get(`${CONTENT_API_PREFIX}/pages/resolve?pageRef=content-ref-priority`)
      .reply(200, { id: expectedPageId });

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true);
    expect(result).to.equal(expectedPageId);
  });

  it('should fallback to content-page-id when content-page-ref has whitespace-only content', async () => {
    const pageURL = 'https://example.com/page';
    const expectedPageId = 'fallback-page-id';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-ref" content="   ">
          <meta name="content-page-id" content="${expectedPageId}">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true);
    expect(result).to.equal(expectedPageId);
  });

  it('should handle content-page-id with whitespace-only content', async () => {
    const pageURL = 'https://example.com/page';
    const htmlContent = `
      <html>
        <head>
          <meta name="content-page-id" content="   ">
          <title>Test Page</title>
        </head>
        <body>Content</body>
      </html>
    `;

    nock('https://example.com')
      .get('/page')
      .reply(200, htmlContent);

    const result = await determineAEMCSPageId(pageURL, 'https://author.example.com', 'Bearer token123', true);
    expect(result).to.be.null;
  });
});

describe('getPageEditUrl', () => {
  const AUTHOR_URL = 'https://author.example.com';
  const BEARER_TOKEN = 'Bearer test-token';
  const PAGE_ID = 'test-page-id';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  it('should return edit URL when API call is successful', async () => {
    const expectedEditUrl = 'https://author.example.com/editor.html/content/test-page';
    const apiResponse = {
      id: 'some-page-id',
      _links: {
        edit: expectedEditUrl,
      },
    };

    nock(AUTHOR_URL)
      .get(`${CONTENT_API_PREFIX}/pages/${PAGE_ID}`)
      .matchHeader('Authorization', BEARER_TOKEN)
      .reply(200, apiResponse);

    const result = await getPageEditUrl(AUTHOR_URL, BEARER_TOKEN, PAGE_ID);
    expect(result).to.equal(expectedEditUrl);
  });

  it('should return null when API call fails', async () => {
    nock(AUTHOR_URL)
      .get(`${CONTENT_API_PREFIX}/pages/${PAGE_ID}`)
      .matchHeader('Authorization', BEARER_TOKEN)
      .reply(500, 'Internal Server Error');

    const result = await getPageEditUrl(AUTHOR_URL, BEARER_TOKEN, PAGE_ID);
    expect(result).to.be.null;
  });

  it('should return undefined when response is successful but has no _links', async () => {
    const apiResponse = {
      id: PAGE_ID,
      title: 'Test Page',
      // No _links property
    };

    nock(AUTHOR_URL)
      .get(`${CONTENT_API_PREFIX}/pages/${PAGE_ID}`)
      .matchHeader('Authorization', BEARER_TOKEN)
      .reply(200, apiResponse);

    const result = await getPageEditUrl(AUTHOR_URL, BEARER_TOKEN, PAGE_ID);
    expect(result).to.be.undefined;
  });
});
