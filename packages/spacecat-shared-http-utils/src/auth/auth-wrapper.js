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

import { isObject } from '@adobe/spacecat-shared-utils';
import AuthenticationManager from './authentication-manager.js';
import { checkScopes } from './check-scopes.js';

/**
 * Routes that bypass authentication entirely.
 *
 * SECURITY CONTRACT (VULN-39365): an entry here means this library performs NO authentication
 * for that route, so the consuming service MUST authenticate it by other means. For
 * `POST /slack/events` that means verifying the Slack request signature (`X-Slack-Signature` +
 * `X-Slack-Request-Timestamp`) before the payload reaches any handler. spacecat-api-service does
 * this in `slackSignatureWrapper`, which is mounted OUTSIDE this wrapper so it runs first.
 *
 * Historically this list also contained `GET /slack/events`. That was removed because Slack only
 * ever POSTs events and interactive payloads, and a GET carries no body to sign — so a GET could
 * never be signature-verified and existed purely as an unauthenticated entry point.
 *
 * Do NOT add entries here. A service that needs an unauthenticated route should pass its own
 * `anonymousEndpoints` (see below) rather than widening the default for every consumer.
 */
const ANONYMOUS_ENDPOINTS = [
  'POST /slack/events',
];

/**
 * Wraps a function with authentication.
 *
 * @param {UniversalFunction} fn - the function to wrap.
 * @param {object} [opts] - options.
 * @param {Array} [opts.authHandlers] - the authentication handler classes to try, in order.
 * @param {string[]} [opts.anonymousEndpoints] - overrides the default set of routes that bypass
 *   authentication, as `'METHOD /path'` strings. Pass `[]` to disable the bypass entirely. A
 *   service that does not verify Slack request signatures SHOULD pass `[]`, otherwise it
 *   inherits an unauthenticated `POST /slack/events` it may not be defending.
 *
 *   Supplying a value that is not an array of strings THROWS at wrapper-construction time
 *   rather than falling back to the default. This is security-sensitive configuration: a typo
 *   by a service trying to *disable* the bypass must not silently re-enable it.
 * @returns {UniversalFunction} the wrapped function.
 * @throws {Error} when `opts.anonymousEndpoints` is present but not an array of strings.
 */
export function authWrapper(fn, opts = {}) {
  let authenticationManager;
  let anonymousEndpoints = ANONYMOUS_ENDPOINTS;

  if (opts.anonymousEndpoints !== undefined) {
    if (!Array.isArray(opts.anonymousEndpoints)
      || opts.anonymousEndpoints.some((route) => typeof route !== 'string')) {
      throw new Error('authWrapper: anonymousEndpoints must be an array of "METHOD /path" strings');
    }
    anonymousEndpoints = opts.anonymousEndpoints;
  }

  return async (request, context) => {
    const { log, pathInfo: { method, suffix } } = context;

    const route = `${method.toUpperCase()} ${suffix}`;

    if (anonymousEndpoints.includes(route)
        || route.startsWith('POST /hooks/site-detection/')
        || method.toUpperCase() === 'OPTIONS') {
      return fn(request, context);
    }

    if (!authenticationManager) {
      if (!Array.isArray(opts.authHandlers)) {
        log.error('Invalid auth handlers');
        return new Response('Server error', { status: 500 });
      }

      authenticationManager = AuthenticationManager.create(opts.authHandlers, log);
    }

    try {
      const authInfo = await authenticationManager.authenticate(request, context);

      // Add a helper function to the context for checking scoped API keys.
      // authInfo is available at context.attributes.authInfo.
      if (!isObject(context.auth)) {
        context.auth = {
          checkScopes: (scopes) => checkScopes(scopes, authInfo, log),
        };
      }
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }

    return fn(request, context);
  };
}
