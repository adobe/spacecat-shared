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
 * Creates a response with a JSON body. Defaults to 200 status.
 * @param {object} body - JSON body.
 * @param {number} status - Optional status code.
 * @param {object} headers - Optional headers.
 * @return {Response} Response.
 */
export function createResponse(body, status = 200, headers = {}) {
  return new Response(
    body === '' ? '' : JSON.stringify(body),
    {
      headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
      status,
    },
  );
}
export function ok(body = '') {
  return createResponse(body, 200);
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
