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
  isAuthorized,
  unauthorizedResponse,
  authError,
  UNAUTHENTICATED_BODY,
} from '../../mock/auth.js';

describe('mock auth', () => {
  describe('isAuthorized', () => {
    it('accepts a well-formed Bearer header', () => {
      expect(isAuthorized({ authorization: 'Bearer abc.def.ghi' })).to.equal(true);
    });

    it('is case-insensitive on the scheme', () => {
      expect(isAuthorized({ authorization: 'bearer token' })).to.equal(true);
    });

    it('is case-insensitive on the header name', () => {
      expect(isAuthorized({ Authorization: 'Bearer token' })).to.equal(true);
    });

    it('tolerates leading whitespace', () => {
      expect(isAuthorized({ authorization: '   Bearer token' })).to.equal(true);
    });

    it('rejects a missing Authorization header', () => {
      expect(isAuthorized({ 'content-type': 'application/json' })).to.equal(false);
    });

    it('rejects when no headers object is given (default param)', () => {
      expect(isAuthorized()).to.equal(false);
    });

    it('rejects an empty headers object', () => {
      expect(isAuthorized({})).to.equal(false);
    });

    it('rejects a null header value', () => {
      expect(isAuthorized({ authorization: null })).to.equal(false);
    });

    it('rejects the Bearer scheme with no token', () => {
      expect(isAuthorized({ authorization: 'Bearer ' })).to.equal(false);
    });

    it('rejects a non-Bearer scheme', () => {
      expect(isAuthorized({ authorization: 'Basic dXNlcjpwYXNz' })).to.equal(false);
    });

    it('rejects a bare token without a scheme', () => {
      expect(isAuthorized({ authorization: 'abc.def.ghi' })).to.equal(false);
    });
  });

  describe('unauthorizedResponse', () => {
    it('is the raw 401 the live gateway returns', () => {
      expect(unauthorizedResponse()).to.deep.equal({
        status: 401,
        body: { detail: 'Not authenticated' },
        contentType: 'application/json',
      });
    });

    it('returns a fresh body each call (not the frozen shared constant)', () => {
      expect(unauthorizedResponse().body).to.not.equal(UNAUTHENTICATED_BODY);
    });
  });

  describe('authError', () => {
    it('returns null when the request is authorized', () => {
      expect(authError({ authorization: 'Bearer token' })).to.equal(null);
    });

    it('returns the 401 raw response when unauthorized', () => {
      expect(authError({})).to.deep.equal({
        status: 401,
        body: { detail: 'Not authenticated' },
        contentType: 'application/json',
      });
    });
  });

  it('UNAUTHENTICATED_BODY is frozen', () => {
    expect(Object.isFrozen(UNAUTHENTICATED_BODY)).to.equal(true);
  });
});
