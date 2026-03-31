# Response Compression Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-response compression wrapper to `@adobe/spacecat-shared-http-utils` that negotiates encoding via `Accept-Encoding` and compresses responses inside the Lambda, bypassing the 6MB helix-universal payload limit.

**Architecture:** A Helix-style wrapper function (`compressResponse`) that intercepts the `@adobe/fetch` Response after the handler returns, picks the best encoding via RFC 7231 content negotiation (preferring brotli), compresses with async zlib, and returns a new Response with `Content-Encoding` set. The adapter's `isBinary()` detects this header and base64-encodes the compressed buffer.

**Tech Stack:** Node.js 22+ ESM, `@adobe/fetch` (Response class), `zlib` (built-in async gzip/brotli/deflate), Mocha + Chai + Sinon for tests.

**Spec:** `mysticat-architecture/platform/design-response-compression.md`

**Jira:** SITES-42279

**Target repo:** `spacecat-shared` (package: `packages/spacecat-shared-http-utils`)

---

## File Structure

```
packages/spacecat-shared-http-utils/
  src/
    compression-wrapper.js        # NEW - negotiation, compression, wrapper
    index.js                      # MODIFY - add export
  test/
    compression-wrapper.test.js   # NEW - full test coverage
```

All logic lives in one file (`compression-wrapper.js`). Internal helpers (`negotiateEncoding`, `isCompressible`, `mergeVary`, `compress`) are exported for testability but are not part of the public API (not re-exported from `index.js`).

---

### Task 1: Content Negotiation Function

**Files:**
- Create: `packages/spacecat-shared-http-utils/src/compression-wrapper.js`
- Create: `packages/spacecat-shared-http-utils/test/compression-wrapper.test.js`

- [ ] **Step 1: Write failing tests for `negotiateEncoding`**

Create `test/compression-wrapper.test.js`:

```js
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
/* eslint-env mocha */
import { expect } from 'chai';

import { negotiateEncoding } from '../src/compression-wrapper.js';

describe('compression-wrapper', () => {
  describe('negotiateEncoding', () => {
    it('returns identity when header is missing', () => {
      expect(negotiateEncoding(null)).to.equal('identity');
      expect(negotiateEncoding(undefined)).to.equal('identity');
      expect(negotiateEncoding('')).to.equal('identity');
    });

    it('returns preferred encoding when all are accepted equally', () => {
      expect(negotiateEncoding('gzip, br, deflate')).to.equal('br');
    });

    it('respects quality values', () => {
      expect(negotiateEncoding('gzip;q=1.0, br;q=0.5')).to.equal('gzip');
    });

    it('returns identity when only identity is accepted', () => {
      expect(negotiateEncoding('identity')).to.equal('identity');
    });

    it('returns identity when all encodings have q=0', () => {
      expect(negotiateEncoding('gzip;q=0, br;q=0')).to.equal('identity');
    });

    it('expands wildcard to first available preference', () => {
      expect(negotiateEncoding('*')).to.equal('br');
    });

    it('expands wildcard excluding explicitly listed encodings', () => {
      expect(negotiateEncoding('gzip;q=0.5, *')).to.equal('br');
    });

    it('returns identity when wildcard has q=0 and no other match', () => {
      expect(negotiateEncoding('*;q=0')).to.equal('identity');
    });

    it('handles single encoding', () => {
      expect(negotiateEncoding('gzip')).to.equal('gzip');
      expect(negotiateEncoding('br')).to.equal('br');
      expect(negotiateEncoding('deflate')).to.equal('deflate');
    });

    it('ignores unsupported encodings', () => {
      expect(negotiateEncoding('compress, sdch')).to.equal('identity');
    });

    it('picks supported encoding among mixed', () => {
      expect(negotiateEncoding('compress, gzip;q=0.8')).to.equal('gzip');
    });

    it('respects custom preference order', () => {
      expect(negotiateEncoding('gzip, br, deflate', ['gzip', 'deflate', 'br'])).to.equal('gzip');
    });

    it('handles whitespace variations', () => {
      expect(negotiateEncoding('  gzip ; q=0.8 , br ; q=1.0 ')).to.equal('br');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: FAIL - `negotiateEncoding` is not exported / does not exist

- [ ] **Step 3: Implement `negotiateEncoding`**

Create `src/compression-wrapper.js`:

```js
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

const DEFAULT_PREFERENCE = ['br', 'gzip', 'deflate'];

export function negotiateEncoding(header, preference = DEFAULT_PREFERENCE) {
  if (!header || typeof header !== 'string') {
    return 'identity';
  }

  const entries = header.split(',').map((entry) => {
    const parts = entry.trim().split(';');
    const encoding = parts[0].trim().toLowerCase();
    const qParam = parts.find((p) => p.trim().startsWith('q='));
    const quality = qParam ? parseFloat(qParam.trim().substring(2)) : 1.0;
    return { encoding, quality };
  });

  // Expand wildcard: * stands for all preference encodings not explicitly listed
  const explicit = new Set(entries.map((e) => e.encoding));
  const expanded = [];
  for (const { encoding, quality } of entries) {
    if (encoding === '*') {
      for (const pref of preference) {
        if (!explicit.has(pref)) {
          expanded.push({ encoding: pref, quality });
        }
      }
    } else {
      expanded.push({ encoding, quality });
    }
  }

  // Keep only supported encodings with quality > 0
  const candidates = expanded.filter(
    ({ encoding, quality }) => quality > 0 && preference.includes(encoding),
  );

  if (candidates.length === 0) {
    return 'identity';
  }

  // Highest quality first; preference order breaks ties
  candidates.sort((a, b) => {
    if (b.quality !== a.quality) return b.quality - a.quality;
    return preference.indexOf(a.encoding) - preference.indexOf(b.encoding);
  });

  return candidates[0].encoding;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: All `negotiateEncoding` tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-http-utils/src/compression-wrapper.js packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "feat(http-utils): add content negotiation for response compression"
```

---

### Task 2: Helper Functions (isCompressible, mergeVary)

**Files:**
- Modify: `packages/spacecat-shared-http-utils/src/compression-wrapper.js`
- Modify: `packages/spacecat-shared-http-utils/test/compression-wrapper.test.js`

- [ ] **Step 1: Write failing tests for `isCompressible` and `mergeVary`**

Append to `test/compression-wrapper.test.js`, inside the outer `describe('compression-wrapper')` block. Also update the import to include the new functions:

```js
import { negotiateEncoding, isCompressible, mergeVary } from '../src/compression-wrapper.js';
```

```js
  describe('isCompressible', () => {
    it('returns true for application/json', () => {
      expect(isCompressible('application/json')).to.be.true;
      expect(isCompressible('application/json; charset=utf-8')).to.be.true;
    });

    it('returns true for text/* types', () => {
      expect(isCompressible('text/html')).to.be.true;
      expect(isCompressible('text/plain')).to.be.true;
      expect(isCompressible('text/csv')).to.be.true;
    });

    it('returns true for application/xml', () => {
      expect(isCompressible('application/xml')).to.be.true;
    });

    it('returns true for +json and +xml suffixed types', () => {
      expect(isCompressible('application/vnd.api+json')).to.be.true;
      expect(isCompressible('application/atom+xml')).to.be.true;
    });

    it('returns false for binary types', () => {
      expect(isCompressible('image/png')).to.be.false;
      expect(isCompressible('application/octet-stream')).to.be.false;
      expect(isCompressible('application/pdf')).to.be.false;
    });

    it('returns false for null/undefined', () => {
      expect(isCompressible(null)).to.be.false;
      expect(isCompressible(undefined)).to.be.false;
    });
  });

  describe('mergeVary', () => {
    it('returns Accept-Encoding when no existing Vary', () => {
      expect(mergeVary(null)).to.equal('Accept-Encoding');
      expect(mergeVary(undefined)).to.equal('Accept-Encoding');
    });

    it('preserves existing Vary and appends Accept-Encoding', () => {
      expect(mergeVary('Origin')).to.equal('Origin, Accept-Encoding');
    });

    it('does not duplicate Accept-Encoding', () => {
      expect(mergeVary('Accept-Encoding')).to.equal('Accept-Encoding');
      expect(mergeVary('Origin, Accept-Encoding')).to.equal('Origin, Accept-Encoding');
    });

    it('handles case-insensitive match', () => {
      expect(mergeVary('accept-encoding')).to.equal('accept-encoding');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: FAIL - `isCompressible` and `mergeVary` not exported

- [ ] **Step 3: Implement `isCompressible` and `mergeVary`**

Add to `src/compression-wrapper.js` (after the existing `negotiateEncoding` function):

```js
const COMPRESSIBLE_TYPES = [
  /^text\//i,
  /^application\/json/i,
  /^application\/xml/i,
  /^application\/[a-z.+-]*\+json/i,
  /^application\/[a-z.+-]*\+xml/i,
];

export function isCompressible(contentType) {
  if (!contentType) return false;
  return COMPRESSIBLE_TYPES.some((re) => re.test(contentType));
}

export function mergeVary(existing) {
  if (!existing) return 'Accept-Encoding';
  if (existing.toLowerCase().includes('accept-encoding')) return existing;
  return `${existing}, Accept-Encoding`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-http-utils/src/compression-wrapper.js packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "feat(http-utils): add isCompressible and mergeVary helpers"
```

---

### Task 3: Async Compress Function

**Files:**
- Modify: `packages/spacecat-shared-http-utils/src/compression-wrapper.js`
- Modify: `packages/spacecat-shared-http-utils/test/compression-wrapper.test.js`

- [ ] **Step 1: Write failing tests for `compress`**

Add imports at the top of `test/compression-wrapper.test.js`:

```js
import { gunzip, brotliDecompress, inflate } from 'zlib';
import { promisify } from 'util';

const gunzipAsync = promisify(gunzip);
const brotliDecompressAsync = promisify(brotliDecompress);
const inflateAsync = promisify(inflate);
```

Update the import from the source:

```js
import {
  negotiateEncoding, isCompressible, mergeVary, compress,
} from '../src/compression-wrapper.js';
```

Add inside the outer `describe` block:

```js
  describe('compress', () => {
    const input = Buffer.from('hello world - test compression content');

    it('compresses with brotli and produces decompressible output', async () => {
      const compressed = await compress('br', input);
      const decompressed = await brotliDecompressAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('compresses with gzip and produces decompressible output', async () => {
      const compressed = await compress('gzip', input);
      const decompressed = await gunzipAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('compresses with deflate and produces decompressible output', async () => {
      const compressed = await compress('deflate', input);
      const decompressed = await inflateAsync(compressed);
      expect(decompressed.toString()).to.equal(input.toString());
    });

    it('throws for unsupported encoding', async () => {
      try {
        await compress('compress', input);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err.message).to.equal('Unsupported encoding: compress');
      }
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: FAIL - `compress` not exported

- [ ] **Step 3: Implement `compress`**

Add imports at the top of `src/compression-wrapper.js`:

```js
import { promisify } from 'util';
import {
  gzip, brotliCompress, deflate, constants as zlibConstants,
} from 'zlib';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const deflateAsync = promisify(deflate);
```

Add the function after `mergeVary`:

```js
export async function compress(encoding, buffer) {
  switch (encoding) {
    case 'br':
      return brotliCompressAsync(buffer, {
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
      });
    case 'gzip':
      return gzipAsync(buffer);
    case 'deflate':
      return deflateAsync(buffer);
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-http-utils/src/compression-wrapper.js packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "feat(http-utils): add async compress function for br/gzip/deflate"
```

---

### Task 4: compressResponse Wrapper - Skip Conditions

**Files:**
- Modify: `packages/spacecat-shared-http-utils/src/compression-wrapper.js`
- Modify: `packages/spacecat-shared-http-utils/test/compression-wrapper.test.js`

- [ ] **Step 1: Write failing tests for all skip conditions**

Add import for `Response` and `sinon` at the top of `test/compression-wrapper.test.js`:

```js
import sinon from 'sinon';
import { Response } from '@adobe/fetch';
```

Update the import from the source to include `compressResponse`:

```js
import {
  negotiateEncoding, isCompressible, mergeVary, compress, compressResponse,
} from '../src/compression-wrapper.js';
```

Add inside the outer `describe` block:

```js
  describe('compressResponse', () => {
    let mockContext;

    beforeEach(() => {
      mockContext = { log: { info: sinon.stub() } };
    });

    afterEach(() => {
      sinon.restore();
    });

    function createMockRequest(acceptEncoding) {
      return {
        headers: {
          get: (key) => (key === 'accept-encoding' ? acceptEncoding : null),
        },
      };
    }

    function createJsonResponse(body, status = 200, extraHeaders = {}) {
      const jsonBody = JSON.stringify(body);
      return new Response(jsonBody, {
        status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          ...extraHeaders,
        },
      });
    }

    it('passes through when status is 204', async () => {
      const innerResponse = new Response('', { status: 204 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when status is 304', async () => {
      const innerResponse = new Response('', { status: 304 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Content-Encoding is already set', async () => {
      const innerResponse = createJsonResponse({ data: 'test' }, 200, { 'content-encoding': 'br' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when content-type is not compressible', async () => {
      const innerResponse = new Response(Buffer.from('binary'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Accept-Encoding is missing', async () => {
      const innerResponse = createJsonResponse({ data: 'test' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest(null), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when Accept-Encoding resolves to identity', async () => {
      const innerResponse = createJsonResponse({ data: 'test' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('identity'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when body is empty', async () => {
      const innerResponse = new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('passes through when body is below minSize', async () => {
      const smallBody = JSON.stringify({ a: 1 });
      const innerResponse = new Response(smallBody, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { minSize: 1024 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result).to.equal(innerResponse);
    });

    it('calls the inner handler with request and context', async () => {
      const innerResponse = new Response('', { status: 204 });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);
      const req = createMockRequest('gzip');

      await wrapped(req, mockContext);
      expect(handler.calledOnceWith(req, mockContext)).to.be.true;
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: FAIL - `compressResponse` not exported

- [ ] **Step 3: Implement `compressResponse` wrapper with skip conditions**

Add import at the top of `src/compression-wrapper.js`:

```js
import { Response } from '@adobe/fetch';
```

Add at the end of the file:

```js
const DEFAULT_MIN_SIZE = 1024;
const SKIP_STATUSES = new Set([204, 304]);

export function compressResponse(fn, opts = {}) {
  const {
    minSize = DEFAULT_MIN_SIZE,
    preference = DEFAULT_PREFERENCE,
  } = opts;

  return async (request, context) => {
    const response = await fn(request, context);

    if (SKIP_STATUSES.has(response.status)) {
      return response;
    }

    if (response.headers.get('content-encoding')) {
      return response;
    }

    const contentType = response.headers.get('content-type');
    if (!isCompressible(contentType)) {
      return response;
    }

    const acceptEncoding = request.headers.get('accept-encoding');
    const encoding = negotiateEncoding(acceptEncoding, preference);
    if (encoding === 'identity') {
      return response;
    }

    const body = Buffer.from(await response.arrayBuffer());

    if (body.length === 0 || body.length < minSize) {
      return response;
    }

    const compressed = await compress(encoding, body);

    const { log = console } = context;
    log.info(`[compression] encoding=${encoding} original=${body.length} compressed=${compressed.length}`);

    const headers = Object.fromEntries(response.headers.entries());
    headers['content-encoding'] = encoding;
    headers.vary = mergeVary(headers.vary);

    return new Response(compressed, {
      status: response.status,
      headers,
    });
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/spacecat-shared-http-utils/src/compression-wrapper.js packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "feat(http-utils): add compressResponse wrapper with skip conditions"
```

---

### Task 5: compressResponse Wrapper - Happy Path Compression

**Files:**
- Modify: `packages/spacecat-shared-http-utils/test/compression-wrapper.test.js`

- [ ] **Step 1: Write tests for actual compression behavior**

Add these tests inside the existing `describe('compressResponse')` block in `test/compression-wrapper.test.js`:

```js
    // Generate a body larger than default minSize (1024 bytes)
    function largeBody() {
      const items = [];
      for (let i = 0; i < 50; i += 1) {
        items.push({ id: i, name: `site-${i}.example.com`, status: 'active' });
      }
      return items;
    }

    it('compresses with brotli when br is preferred', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip, br'), mockContext);

      expect(result.status).to.equal(200);
      expect(result.headers.get('content-encoding')).to.equal('br');
      expect(result.headers.get('vary')).to.include('Accept-Encoding');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await brotliDecompressAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('compresses with gzip when only gzip is accepted', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);

      expect(result.headers.get('content-encoding')).to.equal('gzip');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await gunzipAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('compresses with deflate when only deflate is accepted', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('deflate'), mockContext);

      expect(result.headers.get('content-encoding')).to.equal('deflate');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await inflateAsync(compressed);
      expect(JSON.parse(decompressed.toString())).to.deep.equal(body);
    });

    it('preserves response status code', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 201);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.status).to.equal(201);
    });

    it('preserves existing response headers', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { 'x-custom': 'value' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('x-custom')).to.equal('value');
    });

    it('merges Vary header without duplicating', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body, 200, { vary: 'Origin' });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('vary')).to.equal('Origin, Accept-Encoding');
    });

    it('logs compression stats', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);

      await wrapped(createMockRequest('gzip'), mockContext);
      expect(mockContext.log.info.calledOnce).to.be.true;
      expect(mockContext.log.info.firstCall.args[0]).to.match(/\[compression\]/);
    });

    it('respects custom minSize option', async () => {
      const body = { small: true };
      const jsonStr = JSON.stringify(body);
      const innerResponse = new Response(jsonStr, {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      // Set minSize below the body length so it compresses
      const wrapped = compressResponse(handler, { minSize: 1 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('respects custom preference order', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { preference: ['gzip', 'br', 'deflate'] });

      const result = await wrapped(createMockRequest('gzip, br'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');
    });

    it('compresses text/html content', async () => {
      const htmlBody = '<html>' + '<p>content</p>'.repeat(100) + '</html>';
      const innerResponse = new Response(htmlBody, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler, { minSize: 1 });

      const result = await wrapped(createMockRequest('gzip'), mockContext);
      expect(result.headers.get('content-encoding')).to.equal('gzip');

      const compressed = Buffer.from(await result.arrayBuffer());
      const decompressed = await gunzipAsync(compressed);
      expect(decompressed.toString()).to.equal(htmlBody);
    });

    it('uses console as fallback when context has no log', async () => {
      const body = largeBody();
      const innerResponse = createJsonResponse(body);
      const handler = sinon.stub().resolves(innerResponse);
      const wrapped = compressResponse(handler);
      const consoleStub = sinon.stub(console, 'info');

      await wrapped(createMockRequest('gzip'), {});

      expect(consoleStub.calledOnce).to.be.true;
      consoleStub.restore();
    });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -30`
Expected: All tests PASS (implementation was added in Task 4)

- [ ] **Step 3: Run lint**

Run: `npm run lint -w packages/spacecat-shared-http-utils 2>&1 | tail -20`
Expected: No lint errors. Fix any that appear.

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "test(http-utils): add happy-path compression tests"
```

---

### Task 6: Export and Final Verification

**Files:**
- Modify: `packages/spacecat-shared-http-utils/src/index.js`

- [ ] **Step 1: Add export to `index.js`**

Add the following export line to `src/index.js`, after the existing wrapper exports:

```js
export { compressResponse } from './compression-wrapper.js';
```

Place it after line 166 (the `enrichPathInfo` export), so the wrapper exports are grouped:

```js
export { authWrapper } from './auth/auth-wrapper.js';
export { s2sAuthWrapper } from './auth/s2s-wrapper.js';
export { enrichPathInfo } from './enrich-path-info-wrapper.js';
export { compressResponse } from './compression-wrapper.js';
export { hashWithSHA256 } from './auth/generate-hash.js';
```

- [ ] **Step 2: Run full test suite**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | tail -40`
Expected: All tests PASS, coverage meets thresholds (100% lines/statements, 97% branches)

- [ ] **Step 3: Run lint**

Run: `npm run lint -w packages/spacecat-shared-http-utils 2>&1 | tail -20`
Expected: No lint errors

- [ ] **Step 4: Commit**

```bash
git add packages/spacecat-shared-http-utils/src/index.js
git commit -m "feat(http-utils): export compressResponse wrapper"
```

---

### Task 7: Coverage Gap Check

- [ ] **Step 1: Review coverage report**

Run: `npm test -w packages/spacecat-shared-http-utils 2>&1 | grep -A 20 'compression-wrapper'`

Check for uncovered lines or branches. If coverage is below thresholds, identify the uncovered paths and add targeted tests.

Common gaps to watch for:
- The `default` branch in `compress()` switch (the `throw` path) - covered by the "unsupported encoding" test
- The `console` fallback in `compressResponse` when `context.log` is missing - covered by the "uses console as fallback" test
- The `DEFAULT_PREFERENCE` constant not being overridden - covered by the "custom preference" test

- [ ] **Step 2: Add any missing tests if needed**

If coverage gaps exist, add targeted tests and re-run.

- [ ] **Step 3: Final commit if tests were added**

```bash
git add packages/spacecat-shared-http-utils/test/compression-wrapper.test.js
git commit -m "test(http-utils): close coverage gaps for compression wrapper"
```
