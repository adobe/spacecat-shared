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
import { DELIVERY_TYPES, detectAEMVersion, determineAEMCSPageId } from '../src/aem.js';

describe('AEM Detection', () => {
  describe('detectAEMVersion', () => {
    describe('null and invalid inputs', () => {
      it('should return null for null, undefined, non-string, or empty htmlSource', () => {
        const invalidInputs = [null, undefined, 123, ''];
        invalidInputs.forEach((input) => {
          const result = detectAEMVersion(input);
          expect(result).to.be.null;
        });
      });

      it('should return other for htmlSource with no patterns', () => {
        const result = detectAEMVersion('<html><body>Simple HTML</body></html>');
        expect(result).to.equal(DELIVERY_TYPES.OTHER);
      });
    });

    describe('AEM Edge (EDS) detection', () => {
      it('should detect AEM Edge via lib-franklin.js pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/scripts/lib-franklin.js"></script>
            </head>
            <body>
              <div class="block hero">Hero Block</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should detect AEM Edge via data-block-status pattern', () => {
        const htmlSource = `
          <html>
            <body>
              <div class="hero block" data-block-status="initialized">
                <h1>Hero Block</h1>
              </div>
              <div class="teaser block" data-block-status="loaded">
                <p>Teaser content</p>
              </div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should detect AEM Edge via aem.js pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/scripts/aem.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });
    });

    describe('AEM Cloud Service detection', () => {
      it('should detect AEM CS via core component cmp- classes', () => {
        const htmlSource = `
          <html>
            <body>
              <div class="cmp-header">
                <h1 class="cmp-title">Title</h1>
              </div>
              <div class="cmp-navigation">Navigation</div>
              <div class="cmp-text">Text component</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });

      it('should detect AEM CS via lc- clientlib pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc.clientlibs/mysite/clientlibs/base.lc-abc123-lc.min.css">
              <script src="/etc.clientlibs/mysite/clientlibs/base.lc-def456-lc.min.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });

      it('should detect AEM CS via data-cmp- attributes', () => {
        const htmlSource = `
          <html>
            <body>
              <div class="cmp-teaser" data-cmp-is="teaser">
                <h2 data-cmp-hook-teaser="title">Title</h2>
                <p data-cmp-hook-teaser="description">Description</p>
              </div>
              <div class="cmp-navigation" data-cmp-version="1.0" data-cmp-is="navigation">Navigation</div>
              <div class="cmp-text" data-cmp-text="Some text content">Text</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });

      it('should detect AEM CS via RUM data-routing pattern', () => {
        const htmlSource = `
          <html>
            <body data-routing="project=mysite,cs=publish">
              <div class="content">CS Content</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });
    });

    describe('AEM Managed Services (AMS) detection', () => {
      it('should detect AMS via legacy /etc/clientlibs/ pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc/clientlibs/foundation/css/base.css">
              <script src="/etc/clientlibs/granite/utils.js"></script>
              <script src="/etc/designs/mysite/js/app.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should detect AMS via x-dispatcher header pattern', () => {
        const headers = {
          'x-dispatcher': 'dispatcher1.adobe.com',
        };
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc/clientlibs/foundation/css/base.css">
            </head>
            <body>Simple content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource, headers);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should detect AMS via fingerprinted clientlib pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc.clientlibs/mysite/clientlibs/base.min.abc123def456789012345678901234567890.css">
              <script src="/etc.clientlibs/mysite/clientlibs/base.min.fedcba0987654321098765432109876543.js"></script>
              <script src="/etc/designs/mysite/clientlibs/app.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should detect AMS via RUM data-routing pattern', () => {
        const htmlSource = `
          <html>
            <body data-routing="project=mysite,ams=publish">
              <div class="content">AMS Content</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should detect AMS via foundation- pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/etc/clientlibs/foundation-main/js/foundation.js"></script>
            </head>
            <body>
              <div class="foundation-layout">Content</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });
    });

    describe('AEM Headless detection', () => {
      it('should detect AEM Headless via aem-headless pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <meta name="generator" content="aem-headless">
            </head>
            <body>
              <div class="content">Headless content</div>
              <img src="/content/dam/mysite/images/hero.jpg" alt="Hero Image">
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_HEADLESS);
      });

      it('should detect AEM Headless via /content/dam/ pattern', () => {
        const htmlSource = `
          <html>
            <body>
              <img src="/content/dam/mysite/images/hero.jpg" alt="Hero Image">
              <a href="/content/dam/mysite/documents/brochure.pdf">Download Brochure</a>
              <div class="aem-headless-component">Headless content</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_HEADLESS);
      });
    });

    describe('threshold and priority testing', () => {
      it('should return other when matches are below minimum threshold', () => {
        const htmlSource = `
          <html>
            <body>
              <div class="content">Basic HTML with minimal patterns</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.OTHER);
      });

      it('should prioritize AEM Edge when multiple patterns match but Edge has highest score', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/scripts/lib-franklin.js"></script>
              <link rel="stylesheet" href="/etc/clientlibs/base.css">
            </head>
            <body>
              <div class="cmp-title">Title</div>
              <div class="block hero" data-block-status="loaded">Hero</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should prioritize AMS when fingerprinted clientlibs are present', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/etc.clientlibs/mysite/base.min.fedcba0987654321098765432109876543.js"></script>
              <link rel="stylesheet" href="/etc.clientlibs/foundation/base.min.123456789012345678901234567890ab.css">
            </head>
            <body>
              <div class="content">Regular content without CS patterns</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should handle case where CS and AMS patterns both match but CS wins', () => {
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc.clientlibs/mysite/base.lc-abc123-lc.min.css">
              <script src="/etc/clientlibs/foundation/utils.js"></script>
            </head>
            <body>
              <div class="cmp-navigation" data-cmp-is="navigation">Navigation</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });
    });

    describe('edge cases and complex scenarios', () => {
      it('should handle case-insensitive HTML matching', () => {
        const htmlSource = `
          <HTML>
            <HEAD>
              <SCRIPT src="/scripts/LIB-FRANKLIN.JS"></SCRIPT>
            </HEAD>
            <BODY>Content</BODY>
          </HTML>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should handle mixed delivery type patterns with clear winner', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/scripts/lib-franklin.js"></script>
              <script src="/scripts/aem.js"></script>
            </head>
            <body data-routing="project=mysite,eds=author">
              <div class="block hero" data-block-status="loaded">
                <div class="cmp-title">Mixed patterns</div>
              </div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should handle empty headers gracefully', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/scripts/lib-franklin.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should handle missing x-dispatcher header gracefully', () => {
        const headers = {
          'content-type': 'text/html',
        };
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc/clientlibs/foundation/css/base.css">
              <script src="/etc/designs/mysite/js/app.js"></script>
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource, headers);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should detect AMS via /etc/designs/ pattern', () => {
        const htmlSource = `
          <html>
            <head>
              <link rel="stylesheet" href="/etc/designs/mysite/css/styles.css">
            </head>
            <body>Content</body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_AMS);
      });

      it('should handle multiple RUM routing patterns', () => {
        const htmlSource = `
          <html>
            <body data-routing="project=mysite,eds=author,cs=publish">
              <div class="content">Multiple routing</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        // EDS should win due to higher weight (5 points each)
        expect(result).to.equal(DELIVERY_TYPES.AEM_EDGE);
      });

      it('should detect via data-sly- patterns for CS', () => {
        const htmlSource = `
          <html>
            <body>
              <div data-sly-test="\${properties.title}">
                <h1 data-sly-text="\${properties.title}">Title</h1>
              </div>
              <div data-sly-list="\${children}">Content</div>
              <div class="cmp-title">Another component</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });

      it('should detect via libs.clientlibs pattern for CS', () => {
        const htmlSource = `
          <html>
            <head>
              <script src="/libs.clientlibs/granite/utils/source/utils.js"></script>
              <link rel="stylesheet" href="/libs.clientlibs/cq/gui/css/coral.css">
            </head>
            <body>
              <div class="cmp-navigation" data-cmp-is="navigation">Navigation</div>
            </body>
          </html>
        `;
        const result = detectAEMVersion(htmlSource);
        expect(result).to.equal(DELIVERY_TYPES.AEM_CS);
      });
    });
  });
});

describe('determineAEMCSPageId', () => {
  beforeEach(() => {
    nock.cleanAll();
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
});
