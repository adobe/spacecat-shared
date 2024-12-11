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

import ImportUrl from '../../../../../src/v2/models/import-url/import-url.model.js';
import ImportUrlSchema from '../../../../../src/v2/models/import-url/import-url.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ImportUrlSchema).model.schema;

describe('ImportUrl', () => {
  let importUrlInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        importUrl: {
          model: {
            name: 'importUrl',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['importUrlId'],
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
      importUrlId: 'sug12345',
      importJobId: 'ij12345',
      expiresAt: '2022-01-01T00:00:00.000Z',
      file: 'someFile',
      path: 'somePath',
      reason: 'someReason',
      status: 'PENDING',
      url: 'https://example.com',
    };

    importUrlInstance = new ImportUrl(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the ImportUrl instance correctly', () => {
      expect(importUrlInstance).to.be.an('object');
      expect(importUrlInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('importUrlId', () => {
    it('gets importUrlId', () => {
      expect(importUrlInstance.getId()).to.equal('sug12345');
    });
  });

  describe('importJobId', () => {
    it('gets importJobId', () => {
      expect(importUrlInstance.getImportJobId()).to.equal('ij12345');
    });

    it('sets importJobId', () => {
      importUrlInstance.setImportJobId('ij67890');
      expect(importUrlInstance.getImportJobId()).to.equal('ij67890');
    });
  });

  describe('expiresAt', () => {
    it('gets expiresAt', () => {
      expect(importUrlInstance.getExpiresAt()).to.equal('2022-01-01T00:00:00.000Z');
    });

    it('sets expiresAt', () => {
      importUrlInstance.setExpiresAt('2024-01-01T00:00:00.000Z');
      expect(importUrlInstance.getExpiresAt()).to.equal('2024-01-01T00:00:00.000Z');
    });
  });

  describe('file', () => {
    it('gets file', () => {
      expect(importUrlInstance.getFile()).to.equal('someFile');
    });

    it('sets file', () => {
      importUrlInstance.setFile('newFile');
      expect(importUrlInstance.getFile()).to.equal('newFile');
    });
  });

  describe('path', () => {
    it('gets path', () => {
      expect(importUrlInstance.getPath()).to.equal('somePath');
    });

    it('sets path', () => {
      importUrlInstance.setPath('newPath');
      expect(importUrlInstance.getPath()).to.equal('newPath');
    });
  });

  describe('reason', () => {
    it('gets reason', () => {
      expect(importUrlInstance.getReason()).to.equal('someReason');
    });

    it('sets reason', () => {
      importUrlInstance.setReason('newReason');
      expect(importUrlInstance.getReason()).to.equal('newReason');
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(importUrlInstance.getStatus()).to.equal('PENDING');
    });

    it('sets status', () => {
      importUrlInstance.setStatus('COMPLETE');
      expect(importUrlInstance.getStatus()).to.equal('COMPLETE');
    });
  });

  describe('url', () => {
    it('gets url', () => {
      expect(importUrlInstance.getUrl()).to.equal('https://example.com');
    });

    it('sets url', () => {
      importUrlInstance.setUrl('https://example.org');
      expect(importUrlInstance.getUrl()).to.equal('https://example.org');
    });
  });
});
