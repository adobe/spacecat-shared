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

import { expect } from 'chai';
import {
  stripTagsToText,
  htmlToMarkdown,
  htmlToRenderedMarkdown,
  generateMarkdownDiff,
  filterHtmlContent,
} from '../src/index.js';
import { realWorldExamples } from './fixtures/real-world-examples.js';

/**
 * Real-World Rendering Tests
 *
 * These tests ensure that markdown rendering and diff view behave correctly
 * They verify what content gets rendered in the extension's markdown view and diff comparison.
 */

describe('Real-World Markdown Rendering', () => {
  describe('E-commerce Sites', () => {
    it('should render server-side content with noscript fallbacks', async () => {
      const { serverSide } = realWorldExamples.ecommerce;
      const text = await stripTagsToText(serverSide, true, true);

      // Should include main product info
      expect(text).to.include('Blue Widget');
      expect(text).to.include('High-quality blue widget');
      expect(text).to.include('Price: $29.99');

      // Should include noscript fallback text
      expect(text).to.include('JavaScript required for image gallery');
      expect(text).to.include('Enable JavaScript to view customer reviews');
    });

    it('should render client-side content without noscript', async () => {
      const { clientSide } = realWorldExamples.ecommerce;
      const text = await stripTagsToText(clientSide, true, false);

      // Should include main product info
      expect(text).to.include('Blue Widget');
      expect(text).to.include('High-quality blue widget');

      // Should include dynamically loaded reviews
      expect(text).to.include('Customer Reviews');
      expect(text).to.include('Great product');

      // Should NOT include noscript fallback text
      expect(text).to.not.include('JavaScript required for image gallery');
      expect(text).to.not.include('Enable JavaScript to view customer reviews');
    });

    it('should convert to markdown with proper formatting', async () => {
      const { clientSide } = realWorldExamples.ecommerce;

      // Get filtered HTML first
      const filteredHtml = await filterHtmlContent(clientSide, true, false, false);
      const markdown = await htmlToMarkdown(filteredHtml);

      // Should have markdown headers
      expect(markdown).to.match(/^#+ /m); // Has headers

      // Should include key content
      expect(markdown).to.include('Blue Widget');
      expect(markdown).to.include('Customer Reviews');

      // Should NOT include noscript content
      expect(markdown).to.not.include('JavaScript required');
    });

    it('should render markdown diff view for e-commerce', async () => {
      const { serverSide, clientSide } = realWorldExamples.ecommerce;

      const diff = await generateMarkdownDiff(serverSide, clientSide, true);

      // Should have both sides rendered
      expect(diff.originalRenderedHtml).to.be.a('string').with.length.greaterThan(0);
      expect(diff.currentRenderedHtml).to.be.a('string').with.length.greaterThan(0);

      // Both should include main product content
      expect(diff.originalRenderedHtml).to.include('Blue Widget');
      expect(diff.currentRenderedHtml).to.include('Blue Widget');

      // Current should include dynamic content (reviews)
      expect(diff.currentRenderedHtml).to.include('Customer Reviews');
      expect(diff.currentRenderedHtml).to.include('Great product');

      // Original should NOT have reviews yet
      expect(diff.originalRenderedHtml).to.not.include('Great product');
    });
  });

  describe('News Articles', () => {
    it('should render server-side article with noscript notices', async () => {
      const { serverSide } = realWorldExamples.newsArticle;
      const text = await stripTagsToText(serverSide, true, true);

      // Core article content
      expect(text).to.include('Breaking News');
      expect(text).to.include('main article content');

      // Noscript notices
      expect(text).to.include('For the full interactive experience');
      expect(text).to.include('Comments require JavaScript');
    });

    it('should render client-side article with comments', async () => {
      const { clientSide } = realWorldExamples.newsArticle;
      const text = await stripTagsToText(clientSide, true, false);

      // Core article content
      expect(text).to.include('Breaking News');
      expect(text).to.include('main article content');

      // Dynamically loaded comments
      expect(text).to.include('Comments');
      expect(text).to.include('First comment here');

      // Should NOT include noscript notices
      expect(text).to.not.include('For the full interactive experience');
      expect(text).to.not.include('Comments require JavaScript');
    });

    it('should show comments as additions in markdown diff', async () => {
      const { serverSide, clientSide } = realWorldExamples.newsArticle;

      const diff = await generateMarkdownDiff(serverSide, clientSide, true);

      // Server-side should have article but no comments
      expect(diff.originalRenderedHtml).to.include('Breaking News');
      expect(diff.originalRenderedHtml).to.not.include('First comment here');

      // Client-side should have comments added
      expect(diff.currentRenderedHtml).to.include('Comments');
      expect(diff.currentRenderedHtml).to.include('First comment here');
      expect(diff.currentRenderedHtml).to.include('Another perspective');
    });
  });

  describe('SPA Applications', () => {
    it('should render server-side SPA with critical warning', async () => {
      const { serverSide } = realWorldExamples.spaApplication;
      const text = await stripTagsToText(serverSide, true, true);

      // Should show loading state
      expect(text).to.include('Loading your dashboard');

      // Should show critical noscript warning
      expect(text).to.include('JavaScript Required');
      expect(text).to.include('This application requires JavaScript');
    });

    it('should render client-side SPA with full content', async () => {
      const { clientSide } = realWorldExamples.spaApplication;
      const text = await stripTagsToText(clientSide, true, false);

      // Should show actual dashboard content
      expect(text).to.include('Welcome Back');
      expect(text).to.include('Recent Activity');
      expect(text).to.include('Quick Stats');

      // Should NOT show the noscript warning
      expect(text).to.not.include('JavaScript Required');
      expect(text).to.not.include('This application requires JavaScript');
    });

    it('should show dramatic content change in markdown diff for SPA', async () => {
      const { serverSide, clientSide } = realWorldExamples.spaApplication;

      const diff = await generateMarkdownDiff(serverSide, clientSide, true);

      // Server-side should show minimal/loading content
      expect(diff.originalRenderedHtml).to.include('Dashboard');
      expect(diff.originalRenderedHtml).to.not.include('Recent Activity');

      // Client-side should show full app
      expect(diff.currentRenderedHtml).to.include('Welcome Back');
      expect(diff.currentRenderedHtml).to.include('Recent Activity');
      expect(diff.currentRenderedHtml).to.include('Quick Stats');

      // Original should NOT have the full dashboard content
      expect(diff.originalRenderedHtml).to.not.include('Quick Stats');
    });
  });

  describe('Accessibility-First Sites', () => {
    it('should render server-side form with noscript notices', async () => {
      const { serverSide } = realWorldExamples.accessibilityFirst;
      const text = await stripTagsToText(serverSide, true, true);

      // Core form content
      expect(text).to.include('Get in Touch');
      expect(text).to.include('Name:');
      expect(text).to.include('Email:');

      // Noscript notices for accessibility
      expect(text).to.include('This form works without JavaScript');
      expect(text).to.include('This field is required');
    });

    it('should render client-side form with enhancements', async () => {
      const { clientSide } = realWorldExamples.accessibilityFirst;
      const text = await stripTagsToText(clientSide, true, false);

      // Core form content
      expect(text).to.include('Get in Touch');

      // Enhanced features
      expect(text).to.include('Real-time validation enabled');
      expect(text).to.include('characters');

      // Should NOT show noscript notices
      expect(text).to.not.include('This form works without JavaScript');
    });
  });

  describe('GDPR-Compliant Sites', () => {
    it('should render server-side with privacy notices', async () => {
      const { serverSide } = realWorldExamples.gdprCompliant;
      const text = await stripTagsToText(serverSide, true, true);

      // Core content
      expect(text).to.include('Understanding Web Performance');
      expect(text).to.include('First Contentful Paint');

      // Privacy notice in noscript
      expect(text).to.include('Privacy Notice');
      expect(text).to.include('No tracking or analytics cookies');
    });

    it('should render client-side with recommendations', async () => {
      const { clientSide } = realWorldExamples.gdprCompliant;
      const text = await stripTagsToText(clientSide, true, false);

      // Core content
      expect(text).to.include('Understanding Web Performance');

      // Dynamically loaded recommendations
      expect(text).to.include('You Might Also Like');
      expect(text).to.include('Core Web Vitals Explained');

      // Should NOT show privacy notice
      expect(text).to.not.include('Privacy Notice');
    });
  });

  describe('Noscript Handling Verification', () => {
    it('should consistently exclude noscript from client-side rendering', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        /* eslint-disable no-await-in-loop */
        const clientText = await stripTagsToText(example.clientSide, true, false);
        const clientTextWithNoscript = await stripTagsToText(example.clientSide, true, true);

        // Client text without noscript should be shorter or equal
        expect(
          clientTextWithNoscript.length,
          `${example.name}: with noscript should have more content`,
        ).to.be.at.least(clientText.length);
      }
    });

    it('should consistently include noscript in server-side rendering', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentFromNoscript) {
          /* eslint-disable no-await-in-loop */
          const serverText = await stripTagsToText(example.serverSide, true, true);

          // At least one piece of noscript content should be present
          const hasNoscriptContent = example.expectedDiff.contentFromNoscript.some(
            (content) => serverText.includes(content),
          );

          expect(
            hasNoscriptContent,
            `${example.name}: server-side should include noscript content`,
          ).to.be.true;
        }
      }
    });
  });

  describe('Markdown Diff View Tests', () => {
    it('should generate diff for all site types', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        const diff = await generateMarkdownDiff(example.serverSide, example.clientSide, true);

        // Both sides should be rendered
        expect(
          diff.originalRenderedHtml,
          `${example.name}: should have original rendered HTML`,
        ).to.be.a('string').with.length.greaterThan(0);

        expect(
          diff.currentRenderedHtml,
          `${example.name}: should have current rendered HTML`,
        ).to.be.a('string').with.length.greaterThan(0);
      }
    });

    it('should not include noscript content in markdown diff views', async () => {
      // Note: By default, generateMarkdownDiff excludes noscript from both sides
      // This is because noscript is typically not rendered in modern browsers
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentFromNoscript) {
          /* eslint-disable no-await-in-loop */
          const diff = await generateMarkdownDiff(example.serverSide, example.clientSide, true);

          // Neither side should show noscript content in the markdown view
          // (This represents what users see in the extension)
          const noscriptInOriginal = example.expectedDiff.contentFromNoscript.some(
            (content) => diff.originalRenderedHtml.includes(content),
          );

          const noscriptInCurrent = example.expectedDiff.contentFromNoscript.some(
            (content) => diff.currentRenderedHtml.includes(content),
          );

          expect(
            noscriptInOriginal,
            `${example.name}: noscript should NOT appear in server markdown (matches browser behavior)`,
          ).to.be.false;

          expect(
            noscriptInCurrent,
            `${example.name}: noscript should NOT appear in client markdown`,
          ).to.be.false;
        }
      }
    });

    it('should show added content in client-side markdown', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentAdded) {
          /* eslint-disable no-await-in-loop */
          const diff = await generateMarkdownDiff(example.serverSide, example.clientSide, true);

          example.expectedDiff.contentAdded.forEach((content) => {
            expect(
              diff.currentRenderedHtml,
              `${example.name}: should show added content "${content}" in client markdown`,
            ).to.include(content);
          });
        }
      }
    });

    it('should render markdown with proper HTML structure', async () => {
      const { clientSide } = realWorldExamples.ecommerce;
      const renderedHtml = await htmlToRenderedMarkdown(clientSide, true);

      // Should be valid HTML
      expect(renderedHtml).to.include('<');
      expect(renderedHtml).to.include('>');

      // Should have content
      expect(renderedHtml).to.include('Blue Widget');

      // Should NOT have noscript
      expect(renderedHtml).to.not.include('JavaScript required');
    });

    it('should preserve markdown formatting in diff view', async () => {
      const { serverSide, clientSide } = realWorldExamples.accessibilityFirst;
      const diff = await generateMarkdownDiff(serverSide, clientSide, true);

      // Both sides should have HTML elements (from markdown conversion)
      expect(diff.originalRenderedHtml).to.match(/<[^>]+>/);
      expect(diff.currentRenderedHtml).to.match(/<[^>]+>/);

      // Should preserve form structure in markdown
      expect(diff.currentRenderedHtml).to.include('Get in Touch');
      expect(diff.currentRenderedHtml).to.include('Name');
      expect(diff.currentRenderedHtml).to.include('Email');
    });
  });

  describe('Expected Content Verification', () => {
    it('should render expected content additions on client-side', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentAdded) {
          const clientText = await stripTagsToText(example.clientSide, true, false);

          example.expectedDiff.contentAdded.forEach((content) => {
            expect(
              clientText,
              `${example.name} should contain added content: "${content}"`,
            ).to.include(content);
          });
        }
      }
    });

    it('should not render noscript content on client-side by default', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentFromNoscript) {
          /* eslint-disable no-await-in-loop */
          const clientText = await stripTagsToText(example.clientSide, true, false);

          example.expectedDiff.contentFromNoscript.forEach((content) => {
            expect(
              clientText,
              `${example.name} should NOT contain noscript: "${content}"`,
            ).to.not.include(content);
          });
        }
      }
    });

    it('should render noscript content on server-side', async () => {
      for (const [example] of Object.entries(realWorldExamples)) {
        if (example.expectedDiff?.contentFromNoscript) {
          /* eslint-disable no-await-in-loop */
          const serverText = await stripTagsToText(example.serverSide, true, true);

          // At least one noscript snippet should be present
          const hasNoscript = example.expectedDiff.contentFromNoscript.some(
            (content) => serverText.includes(content),
          );

          expect(
            hasNoscript,
            `${example.name} server should contain noscript content`,
          ).to.be.true;
        }
      }
    });
  });
});
