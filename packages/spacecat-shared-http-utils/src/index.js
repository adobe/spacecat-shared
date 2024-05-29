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

/**
 * Creates a response with a JSON body if the content-type is JSON. Defaults to 200 status.
 * If a header is already defined and has a different content-type, it is handled accordingly.
 * @param {object} body - Response body.
 * @param {number} [status=200] - Optional status code.
 * @param {object} [headers={}] - Optional headers.
 * @return {Response} Response.
 */
export function createResponse(body, status = 200, headers = {}) {
  let responseBody = body;

  // Check if headers already contain a 'content-type' key
  if (!headers['content-type']) {
    // Set content-type to JSON if not already set
    Object.assign(headers, { 'content-type': 'application/json; charset=utf-8' });
  }

  // Stringify body if content-type is JSON
  if (headers['content-type'].includes('application/json')) {
    responseBody = body === '' ? '' : JSON.stringify(body);
  }

  return new Response(responseBody, {
    headers,
    status,
  });
}

export function ok(body = '') {
  return createResponse(body, 200);
}

export function created(body) {
  return createResponse(body, 201);
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
    'x-error': message,
    ...headers,
  });
}

export function notFound(message = 'not found', headers = {}) {
  return createResponse({ message }, 404, {
    'x-error': message,
    ...headers,
  });
}

export function internalServerError(message = 'internal server error', headers = {}) {
  return createResponse({ message }, 500, {
    'x-error': message,
    ...headers,
  });
}
