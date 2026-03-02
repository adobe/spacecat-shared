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
import * as cheerio from 'cheerio';
import {
  htmlToMarkdown,
  markdownToHtml,
  htmlToMarkdownToHtml,
  diffDOMBlocks,
  createMarkdownTableDiff,
  generateMarkdownDiff,
  htmlToRenderedMarkdown,
} from '../src/index.js';

describe('Markdown Conversion and Diff', () => {
  describe('htmlToMarkdown', () => {
    it('should convert HTML to Markdown', async () => {
      const html = '<h1>Title</h1><p>This is <strong>bold</strong> text.</p>';
      const markdown = await htmlToMarkdown(html);

      expect(markdown).to.be.a('string');
      expect(markdown).to.include('Title');
      expect(markdown).to.include('bold');
    });

    it('should handle empty HTML', async () => {
      const result = await htmlToMarkdown('');
      expect(result).to.equal('');
    });

    it('should handle null/undefined input', async () => {
      expect(await htmlToMarkdown(null)).to.equal('');
      expect(await htmlToMarkdown(undefined)).to.equal('');
    });
  });

  describe('markdownToHtml', () => {
    it('should convert Markdown to HTML', async () => {
      const markdown = '# Title\n\nThis is **bold** text.';
      const html = await markdownToHtml(markdown);

      expect(html).to.be.a('string');
      expect(html).to.include('Title');
      expect(html).to.include('bold');
    });

    it('should handle empty markdown', async () => {
      const result = await markdownToHtml('');
      expect(result).to.equal('');
    });

    it('should handle null/undefined input', async () => {
      expect(await markdownToHtml(null)).to.equal('');
      expect(await markdownToHtml(undefined)).to.equal('');
    });
  });

  describe('htmlToMarkdownToHtml', () => {
    it('should normalize HTML through markdown', async () => {
      const html = '<div><h1>Title</h1><p>Content</p></div>';
      const result = await htmlToMarkdownToHtml(html);

      expect(result).to.be.a('string');
      expect(result).to.include('Title');
      expect(result).to.include('Content');
    });
  });

  describe('htmlToRenderedMarkdown', () => {
    it('should convert HTML to rendered markdown HTML', async () => {
      const html = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      const result = await htmlToRenderedMarkdown(html, true);

      expect(result).to.be.a('string');
      expect(result).to.include('Title');
      expect(result).to.include('Content');
    });

    it('should respect ignoreNavFooter option', async () => {
      const html = '<html><body><nav>Nav</nav><h1>Title</h1><footer>Footer</footer></body></html>';
      const resultWithFilter = await htmlToRenderedMarkdown(html, true);
      const resultWithoutFilter = await htmlToRenderedMarkdown(html, false);

      expect(resultWithFilter).to.include('Title');
      expect(resultWithoutFilter).to.include('Title');
    });
  });

  describe('generateMarkdownDiff', () => {
    it('should generate rendered HTML for both sides', async () => {
      const originalHtml = '<html><body><h1>Title</h1><p>Original</p></body></html>';
      const currentHtml = '<html><body><h1>Title</h1><p>Updated</p></body></html>';

      const result = await generateMarkdownDiff(originalHtml, currentHtml);

      expect(result).to.have.property('originalRenderedHtml');
      expect(result).to.have.property('currentRenderedHtml');
      expect(result.originalRenderedHtml).to.be.a('string');
      expect(result.currentRenderedHtml).to.be.a('string');
    });

    it('should respect ignoreNavFooter option', async () => {
      const html = '<html><body><nav>Nav</nav><h1>Title</h1><footer>Footer</footer></body></html>';

      const resultIgnored = await generateMarkdownDiff(html, html, true);
      const resultNotIgnored = await generateMarkdownDiff(html, html, false);

      expect(resultIgnored.originalRenderedHtml).to.be.a('string');
      expect(resultNotIgnored.originalRenderedHtml).to.be.a('string');
    });
  });

  describe('diffDOMBlocks', () => {
    it('should find matching blocks with identical text', () => {
      const originalBlocks = [
        { html: '<p>Hello World</p>', text: 'Hello World', tagName: 'p' },
        { html: '<p>Goodbye</p>', text: 'Goodbye', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<p>Hello World</p>', text: 'Hello World', tagName: 'p' },
        { html: '<p>Goodbye</p>', text: 'Goodbye', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops).to.have.lengthOf(2);
      expect(ops[0].type).to.equal('same');
      expect(ops[1].type).to.equal('same');
    });

    it('should detect additions', () => {
      const originalBlocks = [
        { html: '<p>Hello</p>', text: 'Hello', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<p>Hello</p>', text: 'Hello', tagName: 'p' },
        { html: '<p>New Content</p>', text: 'New Content', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops).to.have.lengthOf(2);
      expect(ops[0].type).to.equal('same');
      expect(ops[1].type).to.equal('add');
      expect(ops[1].currentBlock.text).to.equal('New Content');
    });

    it('should detect deletions', () => {
      const originalBlocks = [
        { html: '<p>Hello</p>', text: 'Hello', tagName: 'p' },
        { html: '<p>Removed</p>', text: 'Removed', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<p>Hello</p>', text: 'Hello', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops).to.have.lengthOf(2);
      expect(ops[0].type).to.equal('same');
      expect(ops[1].type).to.equal('del');
      expect(ops[1].originalBlock.text).to.equal('Removed');
    });

    it('should handle empty blocks', () => {
      const originalBlocks = [];
      const currentBlocks = [];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops).to.have.lengthOf(0);
    });

    it('should match blocks by text content regardless of HTML structure', () => {
      const originalBlocks = [
        { html: '<p>Content</p>', text: 'Content', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<div><p>Content</p></div>', text: 'Content', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops).to.have.lengthOf(1);
      expect(ops[0].type).to.equal('same');
    });

    it('should handle mixed operations (add, delete, same)', () => {
      const originalBlocks = [
        { html: '<p>Keep</p>', text: 'Keep', tagName: 'p' },
        { html: '<p>Delete</p>', text: 'Delete', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<p>Keep</p>', text: 'Keep', tagName: 'p' },
        { html: '<p>Add</p>', text: 'Add', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      const sameOps = ops.filter((op) => op.type === 'same');
      const delOps = ops.filter((op) => op.type === 'del');
      const addOps = ops.filter((op) => op.type === 'add');

      expect(sameOps).to.have.lengthOf(1);
      expect(delOps).to.have.lengthOf(1);
      expect(addOps).to.have.lengthOf(1);
    });

    it('should use LCS algorithm to find optimal matching', () => {
      const originalBlocks = [
        { html: '<p>A</p>', text: 'A', tagName: 'p' },
        { html: '<p>B</p>', text: 'B', tagName: 'p' },
        { html: '<p>C</p>', text: 'C', tagName: 'p' },
      ];
      const currentBlocks = [
        { html: '<p>A</p>', text: 'A', tagName: 'p' },
        { html: '<p>C</p>', text: 'C', tagName: 'p' },
      ];

      const ops = diffDOMBlocks(originalBlocks, currentBlocks);

      expect(ops[0].type).to.equal('same');
      expect(ops[1].type).to.equal('del');
      expect(ops[2].type).to.equal('same');
    });

    it('should handle large number of blocks efficiently', function () {
      this.timeout(5000);

      const blocks = Array.from({ length: 100 }, (_, i) => ({
        html: `<p>Block ${i}</p>`,
        text: `Block ${i}`,
        tagName: 'p',
      }));

      const start = Date.now();
      const ops = diffDOMBlocks(blocks, blocks);
      const duration = Date.now() - start;

      expect(ops).to.have.lengthOf(100);
      expect(duration).to.be.lessThan(1000);
    });
  });

  describe('createMarkdownTableDiff - Node.js (Cheerio)', () => {
    // Helper to recursively create element structure for testing
    const createElementFromCheerio = ($, el) => {
      const children = $(el).children().toArray();
      return {
        tagName: el.tagName?.toUpperCase() || 'DIV',
        outerHTML: $.html(el),
        textContent: $(el).text(),
        get children() {
          return children.map((child) => createElementFromCheerio($, child));
        },
      };
    };

    const createElementsFromHtml = (html) => {
      const $ = cheerio.load(html);
      return $('body').children().toArray().map((el) => createElementFromCheerio($, el));
    };

    it('should extract simple list items as individual blocks', () => {
      const originalHtml = '<body><p>Item 1</p><p>Item 2</p></body>';
      const currentHtml = '<body><ul><li>Item 1</li><li>Item 2</li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.tableHtml).to.be.a('string');
      expect(result.counters).to.be.a('string');
      expect(result.counters).to.include('No differences');
    });

    it('should extract nested paragraphs from list items', () => {
      const originalHtml = '<body><p>Question</p><p>Answer</p></body>';
      const currentHtml = '<body><ul><li><p>Question</p><p>Answer</p></li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.counters).to.include('No differences');
    });

    it('should handle mixed list and non-list elements', () => {
      const originalHtml = '<body><h1>Title</h1><p>Text</p></body>';
      const currentHtml = '<body><h1>Title</h1><ul><li>Text</li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.tableHtml).to.include('Title');
      expect(result.tableHtml).to.include('Text');
    });

    it('should preserve list styling with ul wrapper', () => {
      const originalHtml = '<body><p>Item</p></body>';
      const currentHtml = '<body><ul><li>Item</li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.tableHtml).to.include('<ul>');
      expect(result.tableHtml).to.include('<li>');
    });

    it('should preserve list styling with ol wrapper', () => {
      const originalHtml = '<body><p>First</p></body>';
      const currentHtml = '<body><ol><li>First</li></ol></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.tableHtml).to.include('<ol>');
      expect(result.tableHtml).to.include('<li>');
    });

    it('should handle list items with multiple nested block elements', () => {
      const originalHtml = '<body><p>Q</p><p>A</p><p>Detail</p></body>';
      const currentHtml = '<body><ul><li><p>Q</p><p>A</p><p>Detail</p></li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.counters).to.include('No differences');
    });

    it('should handle complex FAQ structure', () => {
      const originalHtml = `
        <body>
          <p>FAQs</p>
          <p>What are the new prices?</p>
          <p>The prices have been revised.</p>
        </body>
      `;
      const currentHtml = `
        <body>
          <h2>FAQs</h2>
          <ul>
            <li>
              <p>What are the new prices?</p>
              <p>The prices have been revised.</p>
            </li>
          </ul>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.tableHtml).to.include('FAQs');
      expect(result.tableHtml).to.include('What are the new prices');
      expect(result.tableHtml).to.include('prices have been revised');
    });

    it('should count additions and deletions correctly', () => {
      const originalHtml = '<body><p>Keep</p><p>Delete</p></body>';
      const currentHtml = '<body><ul><li><p>Keep</p></li><li><p>Add</p></li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.counters).to.include('addition');
      expect(result.counters).to.include('deletion');
    });

    it('should handle deeply nested list structures', () => {
      const complexHtml = `
        <body>
          <ul>
            <li><p>Item 1</p><p>Sub 1</p></li>
            <li><p>Item 2</p><p>Sub 2</p></li>
            <li><p>Item 3</p><p>Sub 3</p></li>
          </ul>
        </body>
      `;

      const children = createElementsFromHtml(complexHtml);

      const start = Date.now();
      const result = createMarkdownTableDiff(children, children);
      const duration = Date.now() - start;

      expect(result.counters).to.include('No differences');
      expect(duration).to.be.lessThan(500);
    });

    it('should filter out empty list items to prevent misalignment', () => {
      const originalHtml = `
        <body>
          <h2>PRODUCT CATEGORY</h2>
          <ul>
            <li>Item 1</li>
            <li></li>
            <li>Item 2</li>
          </ul>
          <h2>NEW DROPS</h2>
        </body>
      `;
      const currentHtml = `
        <body>
          <h2>PRODUCT CATEGORY</h2>
          <ul>
            <li>Item 1</li>
            <li></li>
            <li>Item 2</li>
          </ul>
          <h2>NEW DROPS</h2>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Should recognize as no differences despite empty list items
      expect(result.counters).to.include('No differences');
      // Should not show NEW DROPS as changed
      expect(result.tableHtml).to.not.include('diff-line-del');
      expect(result.tableHtml).to.not.include('diff-line-add');
    });

    it('should handle duplicate headings at different positions correctly', () => {
      const originalHtml = `
        <body>
          <h2>PRODUCT CATEGORY</h2>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
          <h2>NEW DROPS</h2>
        </body>
      `;
      const currentHtml = `
        <body>
          <h2>PRODUCT CATEGORY</h2>
          <ul>
            <li>Item 1</li>
          </ul>
          <h2>NEW DROPS</h2>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Should show list items as deleted but heading should match
      expect(result.counters).to.include('deletion');
      // NEW DROPS heading should appear as "same" on both sides
      const { tableHtml } = result;
      const newDropsMatches = (tableHtml.match(/NEW DROPS/g) || []).length;
      // Should appear twice (once in each column as "same")
      expect(newDropsMatches).to.be.at.least(2);
    });

    it('should handle lists with only empty items', () => {
      const originalHtml = `
        <body>
          <h2>Title</h2>
          <ul>
            <li></li>
            <li></li>
          </ul>
          <p>After list</p>
        </body>
      `;
      const currentHtml = `
        <body>
          <h2>Title</h2>
          <ul>
            <li></li>
            <li></li>
          </ul>
          <p>After list</p>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Should match correctly without treating empty items as blocks
      expect(result.counters).to.include('No differences');
    });

    it('should handle mixed empty and whitespace-only list items', () => {
      const originalHtml = `
        <body>
          <ul>
            <li>Valid Item</li>
            <li></li>
            <li>   </li>
            <li>Another Valid</li>
          </ul>
        </body>
      `;
      const currentHtml = `
        <body>
          <ul>
            <li>Valid Item</li>
            <li></li>
            <li>   </li>
            <li>Another Valid</li>
          </ul>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Should only compare non-empty items
      expect(result.counters).to.include('No differences');
    });

    it('should handle nested empty blocks within list items', () => {
      const originalHtml = `
        <body>
          <ul>
            <li><p>Content</p><p></p></li>
            <li><p></p><p>More Content</p></li>
          </ul>
        </body>
      `;
      const currentHtml = `
        <body>
          <ul>
            <li><p>Content</p><p></p></li>
            <li><p></p><p>More Content</p></li>
          </ul>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Should filter empty nested blocks
      expect(result.counters).to.include('No differences');
    });

    it('should correctly align when list sizes differ significantly', () => {
      const originalHtml = `
        <body>
          <h2>Section A</h2>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
            <li>Item 4</li>
            <li>Item 5</li>
          </ul>
          <h2>Section B</h2>
        </body>
      `;
      const currentHtml = `
        <body>
          <h2>Section A</h2>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <h2>Section B</h2>
        </body>
      `;

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      // Section headings should match correctly
      expect(result.tableHtml).to.include('Section A');
      expect(result.tableHtml).to.include('Section B');
      // Should show 3 deletions (Item 3, 4, 5)
      expect(result.counters).to.include('3 block deletion');
    });

    it('should handle empty HTML input', () => {
      const result = createMarkdownTableDiff([], []);

      expect(result.tableHtml).to.be.a('string');
      expect(result.counters).to.include('No differences');
    });

    it('should handle unicode characters', () => {
      const originalHtml = '<body><p>Hello 世界 🌍</p></body>';
      const currentHtml = '<body><ul><li>Hello 世界 🌍</li></ul></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.counters).to.include('No differences');
    });

    it('should handle whitespace-only differences', () => {
      const originalHtml = '<body><p>Text</p></body>';
      const currentHtml = '<body><p>  Text  </p></body>';

      const originalChildren = createElementsFromHtml(originalHtml);
      const currentChildren = createElementsFromHtml(currentHtml);

      const result = createMarkdownTableDiff(originalChildren, currentChildren);

      expect(result.counters).to.include('No differences');
    });
  });
});
