/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { Response } from '@adobe/fetch';
import { gzipSync } from 'zlib';

import LegacyApiKeyHandler from './auth/handlers/legacy-api-key.js';
import AdobeImsHandler from './auth/handlers/ims.js';
import ScopedApiKeyHandler from './auth/handlers/scoped-api-key.js';
import JwtHandler from './auth/handlers/jwt.js';

const HEADER_ERROR = 'x-error';
const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CONTENT_ENCODING = 'Content-Encoding';
const CONTENT_TYPE_JSON = 'application/json';

/**
 * Case-insensitive getter for headers.
 */
function getHeader(headers, key) {
  const lowerKey = key.toLowerCase();
  const actualKey = Object.keys(headers).find((k) => k.toLowerCase() === lowerKey);
  return actualKey ? headers[actualKey] : undefined;
}

/**
 * Case-insensitive setter for headers.
 */
function setHeader(headers, key, value) {
  const lowerKey = key.toLowerCase();
  const actualKey = Object.keys(headers).find((k) => k.toLowerCase() === lowerKey);
  if (actualKey) {
    /* c8 ignore next 3 */
    // eslint-disable-next-line no-param-reassign
    headers[actualKey] = value;
  } else {
    // eslint-disable-next-line no-param-reassign
    headers[key] = value;
  }
}

/**
 * Creates a response with a JSON body if the content-type is JSON. Defaults to 200 status.
 * If a header is already defined and has a different content-type, it is handled accordingly.
 * If the content-encoding is set to 'gzip', the body will be gzipped.
 *
 * @param {object|string|Buffer} body - Response body.
 * @param {number} [status=200] - Optional status code.
 * @param {object} [headers={}] - Optional headers.
 * @return {Response} Response object.
 */
export function createResponse(body, status = 200, headers = {}) {
  let responseBody = body;

  const contentType = getHeader(headers, HEADER_CONTENT_TYPE);
  const contentEncoding = getHeader(headers, HEADER_CONTENT_ENCODING);
  const wantsGzip = contentEncoding?.toLowerCase() === 'gzip';

  // default to application/json if content-type not set
  if (!contentType) {
    setHeader(headers, HEADER_CONTENT_TYPE, `${CONTENT_TYPE_JSON}; charset=utf-8`);
  }

  const finalContentType = getHeader(headers, HEADER_CONTENT_TYPE);

  // if content-type is JSON, serialize and optionally gzip
  if (finalContentType?.toLowerCase().includes(CONTENT_TYPE_JSON)) {
    const jsonBody = body === '' ? '' : JSON.stringify(body);
    responseBody = wantsGzip ? gzipSync(Buffer.from(jsonBody)) : jsonBody;
  }

  return new Response(responseBody, {
    status,
    headers,
  });
}

export function ok(body = '', headers = {}) {
  return createResponse(body, 200, headers);
}

export function created(body, headers = {}) {
  return createResponse(body, 201, headers);
}

export function accepted(body, headers = {}) {
  return createResponse(body, 202, headers);
}

export function noContent(headers = {}) {
  return createResponse('', 204, headers);
}

export function found(location, body = '') {
  return createResponse(body, 302, {
    Location: location,
  });
}

export function badRequest(message = 'bad request', headers = {}) {
  return createResponse({ message }, 400, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export function unauthorized(message = 'unauthorized', headers = {}) {
  return createResponse({ message }, 401, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export function forbidden(message = 'forbidden', headers = {}) {
  return createResponse({ message }, 403, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export function notFound(message = 'not found', headers = {}) {
  return createResponse({ message }, 404, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export function methodNotAllowed(message = 'method not allowed', headers = {}) {
  return createResponse({ message }, 405, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export function internalServerError(message = 'internal server error', headers = {}) {
  return createResponse({ message }, 500, {
    [HEADER_ERROR]: message,
    ...headers,
  });
}

export { authWrapper } from './auth/auth-wrapper.js';
export { enrichPathInfo } from './enrich-path-info-wrapper.js';
export { hashWithSHA256 } from './auth/generate-hash.js';

export {
  AdobeImsHandler, ScopedApiKeyHandler, LegacyApiKeyHandler, JwtHandler,
};
