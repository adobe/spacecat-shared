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

import { promisify } from 'util';
import {
  gzip, brotliCompress, deflate, constants as zlibConstants,
} from 'zlib';
import { Headers, Response } from '@adobe/fetch';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);
const deflateAsync = promisify(deflate);

const DEFAULT_PREFERENCE = ['br', 'gzip', 'deflate'];

export function negotiateEncoding(header, preference = DEFAULT_PREFERENCE) {
  if (!header || typeof header !== 'string') {
    return 'identity';
  }

  const entries = header.split(',').map((entry) => {
    const parts = entry.trim().split(';');
    const encoding = parts[0].trim().toLowerCase();
    const qParam = parts.find((p) => p.trim().startsWith('q='));
    const rawQ = qParam ? parseFloat(qParam.trim().substring(2)) : 1.0;
    const quality = Number.isNaN(rawQ) ? 1.0 : rawQ;
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
    ({ encoding, quality }) => quality > 0 && (preference.includes(encoding) || encoding === 'identity'),
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
  if (existing.trim() === '*') return existing;
  const tokens = existing.split(',').map((t) => t.trim().toLowerCase());
  if (tokens.includes('accept-encoding')) return existing;
  return `${existing}, Accept-Encoding`;
}

export async function compress(encoding, buffer) {
  switch (encoding) {
    case 'br':
      // Quality 4 balances compression ratio vs CPU cost for Lambda
      // (default 11 is too slow for large payloads, causing timeouts)
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

const DEFAULT_MIN_SIZE = 1024;
const SKIP_STATUSES = new Set([204, 206, 304]);

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

    if (response.headers.get('content-range')) {
      return response;
    }

    if (response.headers.get('content-encoding')) {
      return response;
    }

    if (response.headers.get('cache-control')?.includes('no-transform')) {
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

    if (body.length < minSize) {
      return new Response(body, {
        status: response.status,
        headers: new Headers(response.headers),
      });
    }

    const log = context?.log ?? console;

    let compressed;
    try {
      compressed = await compress(encoding, body);
    } catch (err) {
      log.error(`[compression] failed to compress with ${encoding}: ${err.message}`);
      return new Response(body, {
        status: response.status,
        headers: new Headers(response.headers),
      });
    }

    log.debug(`[compression] encoding=${encoding} original=${body.length} compressed=${compressed.length}`);

    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-length');
    newHeaders.set('content-encoding', encoding);
    newHeaders.set('vary', mergeVary(newHeaders.get('vary')));

    // Weaken strong ETags - compressed body invalidates them (RFC 7232 S2.1)
    const etag = newHeaders.get('etag');
    if (etag && !etag.startsWith('W/')) {
      newHeaders.set('etag', `W/${etag}`);
    }

    return new Response(compressed, {
      status: response.status,
      headers: newHeaders,
    });
  };
}
