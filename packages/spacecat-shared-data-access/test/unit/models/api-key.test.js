/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { createApiKey } from '../../../src/models/api-key/api-key.js';

const validApiKey = {
  hashedApiKey: 'test',
  name: 'test-name',
  imsUserId: 'test-ims-user-id',
  imsOrgId: 'test-ims-org-id',
  expiresAt: '2024-05-29T14:26:00.000Z',
  revokedAt: '2024-05-29T14:26:00.000Z',
  scopes: [
    {
      name: 'imports.write',
      domains: ['https://www.test.com'],
    },
    {
      name: 'imports.delete',
    },
  ],
};

describe('ApiKey Model tests', () => {
  describe('Validation Tests', () => {
    it('throws an error if key is not a valid string', () => {
      expect(() => createApiKey({ ...validApiKey, hashedApiKey: 123 })).to.throw('Invalid Hashed API Key: 123');
    });

    it('throws an error if name is not a valid string', () => {
      expect(() => createApiKey({ ...validApiKey, name: 123 })).to.throw('Invalid Name: 123');
    });

    it('throws an error if createdAt is not a valid date', () => {
      expect(() => createApiKey({ ...validApiKey, createdAt: 'invalid-date' })).to.throw('createdAt should be a valid ISO 8601 string: invalid-date');
    });

    it('throws an error if expiresAt is not a valid date', () => {
      expect(() => createApiKey({
        ...validApiKey,
        expiresAt: 'invalid-date',
      })).to.throw('expiresAt should be a valid ISO 8601 string: invalid-date');
    });

    it('creates an ApiKey object with a createdAt date', () => {
      const apiKey = createApiKey({ ...validApiKey, createdAt: '' });
      expect(apiKey.getCreatedAt()).is.not.empty;
    });

    it('creates an ApiKey object for a user with scope - imports.all_domains', () => {
      const apiKey = createApiKey({ ...validApiKey, scopes: [{ name: 'imports.all_domains', domains: [] }, { name: 'imports.write', domains: [] }] });
      expect(apiKey.getScopes()).to.deep.equal([{ name: 'imports.all_domains', domains: [] }, { name: 'imports.write', domains: [] }]);
    });

    it('creates an ApiKey object for a user with scope - imports.write', () => {
      const apiKey = createApiKey({ ...validApiKey, scopes: [{ name: 'imports.write', domains: ['https://adobe.com', 'https://test.com'] }] });
      expect(apiKey.getScopes()).to.deep.equal([{ name: 'imports.write', domains: ['https://adobe.com', 'https://test.com'] }]);
    });

    it('creates an ApiKey object for a user with scope - imports.assistant', () => {
      const apiKey = createApiKey({ ...validApiKey, scopes: [{ name: 'imports.assistant' }] });
      expect(apiKey.getScopes()).to.deep.equal([{ name: 'imports.assistant' }]);
    });

    it('throws an error if revokedAt is not a valid date', () => {
      expect(() => createApiKey({ ...validApiKey, revokedAt: 'invalid-date' })).to.throw('revokedAt should be a valid ISO 8601 string: invalid-date');
    });

    it('throws an error if scopes is not an array', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: 'invalid-scopes' })).to.throw('Invalid scopes: invalid-scopes');
    });

    it('throws an error if scope is not an object', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: ['invalid-scope'] })).to.throw('Invalid scope: invalid-scope');
    });

    it('throws an error if scope does not have the name attribute', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: [{ domains: ['https://www.test.com'] }] })).to.throw('Invalid scope name: undefined');
    });

    it('throws an error if scope is not part of the predefined scopes', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: [{ name: 'invalid-scope', domains: ['https://www.test.com'] }] })).to.throw('Scope name is not part of the pre-defined scopes: invalid-scope');
    });

    it('throws an error if domains is not an array', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: [{ name: 'imports.write', domains: 'https://www.test.com' }] })).to.throw('Scope domains should be an array: https://www.test.com');
    });

    it('throws an error if domains does not have a valid url', () => {
      expect(() => createApiKey({ ...validApiKey, scopes: [{ name: 'imports.write', domains: ['random-domain'] }] })).to.throw('Invalid domain: random-domain');
    });
  });
  describe('ApiKey Functionality Tests', () => {
    let apiKey;
    beforeEach(() => {
      apiKey = createApiKey({ ...validApiKey });
    });

    it('gets hashed key', () => {
      expect(apiKey.getHashedApiKey()).to.equal('test');
    });

    it('gets name', () => {
      expect(apiKey.getName()).to.equal('test-name');
    });

    it('gets imsUserId', () => {
      expect(apiKey.getImsUserId()).to.equal('test-ims-user-id');
    });

    it('gets imsOrgId', () => {
      expect(apiKey.getImsOrgId()).to.equal('test-ims-org-id');
    });

    it('gets createdAt', () => {
      expect(apiKey.getCreatedAt()).is.not.empty;
    });

    it('gets expiresAt', () => {
      expect(apiKey.getExpiresAt()).to.equal('2024-05-29T14:26:00.000Z');
    });

    it('gets revokedAt', () => {
      expect(apiKey.getRevokedAt()).to.equal('2024-05-29T14:26:00.000Z');
    });

    it('gets scopes', () => {
      expect(apiKey.getScopes()).to.deep.equal([{
        name: 'imports.write',
        domains: ['https://www.test.com'],
      },
      {
        name: 'imports.delete',
      }]);
    });

    it('updates deletedAt', () => {
      apiKey.updateDeletedAt('2024-05-29T14:26:00.000Z');
      expect(apiKey.getDeletedAt()).to.equal('2024-05-29T14:26:00.000Z');
    });

    it('fails to update deletedAt with invalid date', () => {
      expect(() => apiKey.updateDeletedAt('invalid-date')).to.throw('Invalid deletedAt during update: invalid-date. Must be a valid ISO 8601 date string');
    });

    it('fails to update expiresAt with invalid date', () => {
      expect(() => apiKey.updateExpiresAt('invalid-date')).to.throw('Invalid expiresAt during update: invalid-date. Must be a valid ISO 8601 date string');
    });

    it('fails to update revokedAt with invalid date', () => {
      expect(() => apiKey.updateRevokedAt('invalid-date')).to.throw('Invalid revokedAt during update: invalid-date. Must be a valid ISO 8601 date string');
    });

    it('returns true if deletedAt, revokedAt, and expiresAt are not set', () => {
      apiKey.state.deletedAt = null;
      apiKey.state.revokedAt = null;
      apiKey.state.expiresAt = null;
      expect(apiKey.isValid()).to.be.true;
    });

    it('returns false if deletedAt is after the current time', () => {
      apiKey.updateDeletedAt('2024-05-29T14:26:00.000Z');
      expect(apiKey.isValid()).to.be.false;
    });

    it('returns false if revokedAt is after the current time', () => {
      apiKey.updateRevokedAt('2024-05-29T14:26:00.000Z');
      expect(apiKey.isValid()).to.be.false;
    });

    it('returns false if expiresAt is after the current time', () => {
      apiKey.updateExpiresAt('2024-05-29T14:26:00.000Z');
      expect(apiKey.isValid()).to.be.false;
    });

    it('returns true if deletedAt, revokedAt, and expiresAt are after the current time', () => {
      apiKey.updateDeletedAt('3025-05-27T14:26:00.000Z');
      apiKey.updateRevokedAt('3025-05-27T14:26:00.000Z');
      apiKey.updateExpiresAt('3025-05-27T14:26:00.000Z');
      expect(apiKey.isValid()).to.be.true;
    });

    it('returns false if deletedAt, revokedAt are after the current and expiresAt is before the current time', () => {
      apiKey.updateDeletedAt('3025-05-27T14:26:00.000Z');
      apiKey.updateRevokedAt('3025-05-27T14:26:00.000Z');
      apiKey.updateExpiresAt('2024-05-27T14:26:00.000Z');
      expect(apiKey.isValid()).to.be.false;
    });
  });
});
