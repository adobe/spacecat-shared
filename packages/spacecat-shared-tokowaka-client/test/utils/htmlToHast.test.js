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
import { htmlToHast } from '../../src/utils/html-utils.js';

describe('htmlToHast', () => {
  it('should convert simple HTML to HAST', () => {
    const html = '<section><h2>Hello</h2></section>';
    const result = htmlToHast(html);

    expect(result).to.be.an('object');
    expect(result.type).to.equal('root');
    expect(result.children).to.be.an('array');
  });

  it('should convert HTML with data attributes to HAST', () => {
    const html = '<section data-llm-context="image" data-llm-shadow="image-text"><h2>Test</h2></section>';
    const result = htmlToHast(html);

    expect(result.type).to.equal('root');
    const section = result.children.find((c) => c.tagName === 'section');
    expect(section).to.exist;
    expect(section.properties.dataLlmContext).to.equal('image');
    expect(section.properties.dataLlmShadow).to.equal('image-text');
  });

  it('should convert HTML with nested elements', () => {
    const html = '<section><h2>Headline</h2><p>Description</p><button>CTA</button></section>';
    const result = htmlToHast(html);

    const section = result.children.find((c) => c.tagName === 'section');
    expect(section.children).to.be.an('array');

    const tagNames = section.children
      .filter((c) => c.type === 'element')
      .map((c) => c.tagName);
    expect(tagNames).to.include('h2');
    expect(tagNames).to.include('p');
    expect(tagNames).to.include('button');
  });

  it('should handle real semantic HTML from Mystique', () => {
    const html = `<section data-llm-context="image" data-llm-shadow="image-text" data-image-id="https://example.com/image.jpg">
  <h2>Carahsoft and Partners at WEST 2026</h2>
  <span>February 10 - 12, 2026 • San Diego, CA</span>
  <button>Learn More</button>
</section>`;

    const result = htmlToHast(html);

    expect(result.type).to.equal('root');
    const section = result.children.find((c) => c.tagName === 'section');
    expect(section).to.exist;
    expect(section.properties.dataLlmContext).to.equal('image');
    expect(section.properties.dataImageId).to.equal('https://example.com/image.jpg');
  });

  it('should handle empty HTML', () => {
    const html = '';
    const result = htmlToHast(html);

    expect(result.type).to.equal('root');
    expect(result.children).to.be.an('array');
  });

  it('should handle HTML with special characters', () => {
    const html = '<section><p>Price: €10 &amp; more</p></section>';
    const result = htmlToHast(html);

    const section = result.children.find((c) => c.tagName === 'section');
    const p = section.children.find((c) => c.tagName === 'p');
    const textContent = p.children.find((c) => c.type === 'text');
    expect(textContent.value).to.include('€10');
    expect(textContent.value).to.include('&');
  });
});
