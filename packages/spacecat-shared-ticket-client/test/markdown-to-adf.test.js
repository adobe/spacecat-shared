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
import markdownToAdf from '../src/adf/markdown-to-adf.js';

describe('markdownToAdf', () => {
  it('returns null for null input', () => {
    expect(markdownToAdf(null)).to.be.null;
  });

  it('returns null for undefined input', () => {
    expect(markdownToAdf(undefined)).to.be.null;
  });

  it('returns null for whitespace-only input', () => {
    expect(markdownToAdf('   ')).to.be.null;
  });

  it('hits tokensToAdf depth guard with 22 nested blockquotes (depth 21 > MAX_DEPTH 20)', () => {
    // 22 '> ' prefixes = 22 nested blockquotes.
    // tokensToAdf recurses: bq1@depth0 → bq2@depth1 → ... → bq22@depth21.
    // At depth 21, 21 > MAX_DEPTH(20) → returns [] immediately (tokensToAdf guard).
    const nested = `${'> '.repeat(22)}text`;
    const result = markdownToAdf(nested);
    expect(result).to.exist;
    expect(result.type).to.equal('doc');
    expect(result.content).to.have.length.greaterThan(0);
  });

  it('hits inlineToAdf depth guard with 20 nested blockquotes (paragraph at depth 20)', () => {
    // 20 '> ' prefixes = 20 nested blockquotes.
    // Outermost bq processed at depth 0 → inner bq at depth 1 → ... → bq20 at depth 19.
    // tokensToAdf(bq20.tokens, 20) finds a paragraph → calls inlineToAdf(tokens, [], 21).
    // depth 21 > MAX_DEPTH(20) → returns [] (inlineToAdf guard).
    const nested = `${'> '.repeat(20)}text inside`;
    const result = markdownToAdf(nested);
    expect(result).to.exist;
    expect(result.type).to.equal('doc');
  });

  it('pads empty fenced code block with a space (ADF rejects empty text nodes)', () => {
    // A fenced code block with no body produces token.text = '' — must be padded to ' '
    const result = markdownToAdf('```\n```');
    expect(result).to.exist;
    const codeBlock = result.content[0];
    expect(codeBlock.type).to.equal('codeBlock');
    expect(codeBlock.content[0].text).to.equal(' ');
  });
});
