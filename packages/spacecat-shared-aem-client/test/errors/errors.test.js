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
import {
  AemClientError,
  AemConfigurationError,
  AemBadRequestError,
  AemRequestError,
  AemAuthenticationError,
  AemForbiddenError,
  AemConflictError,
  AemPreconditionFailedError,
  FragmentNotFoundError,
  FragmentStateError,
} from '../../src/index.js';

describe('AEM Client Errors', () => {
  describe('AemClientError', () => {
    it('should create error with default values', () => {
      const error = new AemClientError('Test error');

      expect(error.message).to.equal('Test error');
      expect(error.name).to.equal('AemClientError');
      expect(error.statusCode).to.equal(500);
      expect(error.errorCode).to.equal('AEM_CLIENT_ERROR');
    });

    it('should create error with custom statusCode and errorCode', () => {
      const error = new AemClientError('Custom error', 404, 'CUSTOM_ERROR');

      expect(error.statusCode).to.equal(404);
      expect(error.errorCode).to.equal('CUSTOM_ERROR');
    });

    it('should be instance of Error', () => {
      const error = new AemClientError('Test');
      expect(error).to.be.instanceOf(Error);
    });
  });

  describe('AemConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new AemConfigurationError('Missing config');

      expect(error.message).to.equal('Missing config');
      expect(error.name).to.equal('AemConfigurationError');
      expect(error.statusCode).to.equal(500);
      expect(error.errorCode).to.equal('AEM_CONFIGURATION_ERROR');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemConfigurationError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('AemBadRequestError', () => {
    it('should create bad request error', () => {
      const error = new AemBadRequestError('Invalid input');

      expect(error.message).to.equal('Invalid input');
      expect(error.name).to.equal('AemBadRequestError');
      expect(error.statusCode).to.equal(400);
      expect(error.errorCode).to.equal('BAD_REQUEST');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemBadRequestError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('AemRequestError', () => {
    it('should create request error with statusCode', () => {
      const error = new AemRequestError(500, 'Server error', 'response body');

      expect(error.message).to.equal('Server error');
      expect(error.name).to.equal('AemRequestError');
      expect(error.statusCode).to.equal(500);
      expect(error.errorCode).to.equal('AEM_HTTP_500');
      expect(error.responseBody).to.equal('response body');
    });

    it('should create request error with null responseBody by default', () => {
      const error = new AemRequestError(404, 'Not found');

      expect(error.responseBody).to.be.null;
    });

    describe('fromResponse', () => {
      it('should return AemBadRequestError for 400', () => {
        const error = AemRequestError.fromResponse(400, 'Bad Request');

        expect(error).to.be.instanceOf(AemBadRequestError);
        expect(error.message).to.equal('Bad Request');
      });

      it('should return AemAuthenticationError for 401', () => {
        const error = AemRequestError.fromResponse(401, 'Unauthorized');

        expect(error).to.be.instanceOf(AemAuthenticationError);
        expect(error.message).to.equal('Unauthorized');
      });

      it('should return AemForbiddenError for 403', () => {
        const error = AemRequestError.fromResponse(403, 'Forbidden', { resource: '/api/test' });

        expect(error).to.be.instanceOf(AemForbiddenError);
        expect(error.resource).to.equal('/api/test');
      });

      it('should return AemConflictError for 409', () => {
        const error = AemRequestError.fromResponse(409, 'Conflict', { resource: '/api/test' });

        expect(error).to.be.instanceOf(AemConflictError);
        expect(error.resource).to.equal('/api/test');
      });

      it('should return AemPreconditionFailedError for 412', () => {
        const error = AemRequestError.fromResponse(412, 'ETag mismatch', { resource: '/api/test' });

        expect(error).to.be.instanceOf(AemPreconditionFailedError);
        expect(error.resource).to.equal('/api/test');
      });

      it('should return AemRequestError for other status codes', () => {
        const error = AemRequestError.fromResponse(500, 'Internal error');

        expect(error).to.be.instanceOf(AemRequestError);
        expect(error.statusCode).to.equal(500);
      });

      it('should handle missing context', () => {
        const error = AemRequestError.fromResponse(403, 'Forbidden');

        expect(error).to.be.instanceOf(AemForbiddenError);
        // Resource is undefined when context is empty
        expect(error.resource).to.not.exist;
      });
    });
  });

  describe('AemAuthenticationError', () => {
    it('should create authentication error', () => {
      const error = new AemAuthenticationError('Invalid token');

      expect(error.message).to.equal('Invalid token');
      expect(error.name).to.equal('AemAuthenticationError');
      expect(error.statusCode).to.equal(401);
      expect(error.errorCode).to.equal('AEM_AUTHENTICATION_ERROR');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemAuthenticationError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('AemForbiddenError', () => {
    it('should create forbidden error with resource', () => {
      const error = new AemForbiddenError('Access denied', '/api/protected');

      expect(error.message).to.equal('Access denied');
      expect(error.name).to.equal('AemForbiddenError');
      expect(error.statusCode).to.equal(403);
      expect(error.errorCode).to.equal('AEM_FORBIDDEN');
      expect(error.resource).to.equal('/api/protected');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemForbiddenError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('AemConflictError', () => {
    it('should create conflict error with resource', () => {
      const error = new AemConflictError('Resource conflict', '/api/resource');

      expect(error.message).to.equal('Resource conflict');
      expect(error.name).to.equal('AemConflictError');
      expect(error.statusCode).to.equal(409);
      expect(error.errorCode).to.equal('AEM_CONFLICT');
      expect(error.resource).to.equal('/api/resource');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemConflictError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('AemPreconditionFailedError', () => {
    it('should create precondition failed error with resource', () => {
      const error = new AemPreconditionFailedError('ETag mismatch', '/api/resource');

      expect(error.message).to.equal('ETag mismatch');
      expect(error.name).to.equal('AemPreconditionFailedError');
      expect(error.statusCode).to.equal(412);
      expect(error.errorCode).to.equal('AEM_PRECONDITION_FAILED');
      expect(error.resource).to.equal('/api/resource');
    });

    it('should be instance of AemClientError', () => {
      const error = new AemPreconditionFailedError('Test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('FragmentNotFoundError', () => {
    it('should create fragment not found error', () => {
      const error = new FragmentNotFoundError('/content/dam/test');

      expect(error.message).to.equal('Fragment not found at path: /content/dam/test');
      expect(error.name).to.equal('FragmentNotFoundError');
      expect(error.statusCode).to.equal(404);
      expect(error.errorCode).to.equal('FRAGMENT_NOT_FOUND');
      expect(error.fragmentPath).to.equal('/content/dam/test');
    });

    it('should be instance of AemClientError', () => {
      const error = new FragmentNotFoundError('/test');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });

  describe('FragmentStateError', () => {
    it('should create fragment state error with reason', () => {
      const error = new FragmentStateError('/content/dam/test', 'missing ETag');

      expect(error.message).to.equal('Fragment state error for /content/dam/test: missing ETag');
      expect(error.name).to.equal('FragmentStateError');
      expect(error.statusCode).to.equal(422);
      expect(error.errorCode).to.equal('FRAGMENT_STATE_ERROR');
      expect(error.fragmentPath).to.equal('/content/dam/test');
      expect(error.reason).to.equal('missing ETag');
    });

    it('should be instance of AemClientError', () => {
      const error = new FragmentStateError('/test', 'reason');
      expect(error).to.be.instanceOf(AemClientError);
    });
  });
});
