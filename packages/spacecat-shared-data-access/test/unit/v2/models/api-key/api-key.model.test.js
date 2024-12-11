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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import sinonChai from 'sinon-chai';

import ApiKey from '../../../../../src/v2/models/api-key/api-key.model.js';
import ApiKeySchema from '../../../../../src/v2/models/api-key/api-key.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ApiKeySchema).model.schema;

describe('ApiKey', () => {
  let apiKeyInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        apiKey: {
          model: {
            name: 'apiKey',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['apiKeyId'],
                },
              },
            },
          },
          patch: stub().returns({
            set: stub(),
          }),
        },
      },
    };

    mockModelFactory = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
    };

    mockRecord = {
      apiKeyId: 'sug12345',
      hashedApiKey: 'someHashedApiKey',
      imsUserId: 'someImsUserId',
      imsOrgId: 'someImsOrgId',
      name: 'someName',
      deletedAt: null,
      expiresAt: null,
      revokedAt: null,
      scopes: [
        {
          domains: ['someDomain'],
          actions: ['someAction'],
        },
      ],
    };

    apiKeyInstance = new ApiKey(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the ApiKey instance correctly', () => {
      expect(apiKeyInstance).to.be.an('object');
      expect(apiKeyInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('apiKeyId', () => {
    it('gets apiKeyId', () => {
      expect(apiKeyInstance.getId()).to.equal('sug12345');
    });
  });

  describe('hashedApiKey', () => {
    it('gets hashedApiKey', () => {
      expect(apiKeyInstance.getHashedApiKey()).to.equal('someHashedApiKey');
    });

    it('sets hashedApiKey', () => {
      const newHashedApiKey = 'newHashedApiKey';
      apiKeyInstance.setHashedApiKey(newHashedApiKey);
      expect(apiKeyInstance.getHashedApiKey()).to.equal(newHashedApiKey);
    });
  });

  describe('imsUserId', () => {
    it('gets imsUserId', () => {
      expect(apiKeyInstance.getImsUserId()).to.equal('someImsUserId');
    });

    it('sets imsUserId', () => {
      const newImsUserId = 'newImsUserId';
      apiKeyInstance.setImsUserId(newImsUserId);
      expect(apiKeyInstance.getImsUserId()).to.equal(newImsUserId);
    });
  });

  describe('imsOrgId', () => {
    it('gets imsOrgId', () => {
      expect(apiKeyInstance.getImsOrgId()).to.equal('someImsOrgId');
    });

    it('sets imsOrgId', () => {
      const newImsOrgId = 'newImsOrgId';
      apiKeyInstance.setImsOrgId(newImsOrgId);
      expect(apiKeyInstance.getImsOrgId()).to.equal(newImsOrgId);
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(apiKeyInstance.getName()).to.equal('someName');
    });

    it('sets name', () => {
      const newName = 'newName';
      apiKeyInstance.setName(newName);
      expect(apiKeyInstance.getName()).to.equal(newName);
    });
  });

  describe('scopes', () => {
    it('gets scopes', () => {
      expect(apiKeyInstance.getScopes()).to.deep.equal([
        {
          domains: ['someDomain'],
          actions: ['someAction'],
        },
      ]);
    });

    it('sets scopes', () => {
      const newScopes = [
        {
          domains: ['newDomain'],
          actions: ['newAction'],
        },
      ];
      apiKeyInstance.setScopes(newScopes);
      expect(apiKeyInstance.getScopes()).to.deep.equal(newScopes);
    });
  });

  describe('isValid', () => {
    it('returns true when the ApiKey is valid', () => {
      expect(apiKeyInstance.isValid()).to.equal(true);
    });

    it('returns false when the ApiKey is deleted', () => {
      apiKeyInstance.setDeletedAt('2022-01-01T00:00:00.000Z');
      expect(apiKeyInstance.isValid()).to.equal(false);
    });

    it('returns false when the ApiKey is revoked', () => {
      apiKeyInstance.setRevokedAt('2022-01-01T00:00:00.000Z');
      expect(apiKeyInstance.isValid()).to.equal(false);
    });

    it('returns false when the ApiKey is expired', () => {
      apiKeyInstance.setExpiresAt('2022-01-01T00:00:00.000Z');
      expect(apiKeyInstance.isValid()).to.equal(false);
    });
  });

  describe('deletedAt', () => {
    it('gets deletedAt', () => {
      expect(apiKeyInstance.getDeletedAt()).to.equal(null);
    });

    it('sets deletedAt', () => {
      const deletedAtIsoDate = '2024-01-01T00:00:00.000Z';
      apiKeyInstance.setDeletedAt(deletedAtIsoDate);
      expect(apiKeyInstance.getDeletedAt()).to.equal(deletedAtIsoDate);
    });
  });

  describe('expiresAt', () => {
    it('gets expiresAt', () => {
      expect(apiKeyInstance.getExpiresAt()).to.equal(null);
    });

    it('sets expiresAt', () => {
      const expiresAtIsoDate = '2024-01-01T00:00:00.000Z';
      apiKeyInstance.setExpiresAt(expiresAtIsoDate);
      expect(apiKeyInstance.getExpiresAt()).to.equal(expiresAtIsoDate);
    });
  });

  describe('revokedAt', () => {
    it('gets revokedAt', () => {
      expect(apiKeyInstance.getRevokedAt()).to.equal(null);
    });

    it('sets revokedAt', () => {
      const revokedAtIsoDate = '2024-01-01T00:00:00.000Z';
      apiKeyInstance.setRevokedAt(revokedAtIsoDate);
      expect(apiKeyInstance.getRevokedAt()).to.equal(revokedAtIsoDate);
    });
  });
});
