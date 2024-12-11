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

import ImportJob from '../../../../../src/v2/models/import-job/import-job.model.js';
import ImportJobSchema from '../../../../../src/v2/models/import-job/import-job.schema.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const { attributes } = new Entity(ImportJobSchema).model.schema;

describe('ImportJob', () => {
  let importJobInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockRecord;
  let mockLogger;

  beforeEach(() => {
    mockElectroService = {
      entities: {
        importJob: {
          model: {
            name: 'importJob',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['importJobId'],
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
      importJobId: 'sug12345',
      baseURL: 'https://example.com',
      duration: 0,
      endedAt: '2022-01-01T00:00:00.000Z',
      failedCount: 0,
      hasCustomHeaders: false,
      hasCustomImportJs: false,
      hashedApiKey: 'someHashedApiKey',
      importQueueId: 'iq12345',
      initiatedBy: {
        apiKeyName: 'someApiKeyName',
        imsOrgId: 'someImsOrgId',
        imsUserId: 'someImsUserId',
        userAgent: 'someUserAgent',
      },
      options: {
        someOption: 'someValue',
      },
      redirectCount: 0,
      status: 'RUNNING',
      startedAt: '2022-01-01T00:00:00.000Z',
      successCount: 0,
      urlCount: 0,
    };

    importJobInstance = new ImportJob(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the ImportJob instance correctly', () => {
      expect(importJobInstance).to.be.an('object');
      expect(importJobInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('importJobId', () => {
    it('gets importJobId', () => {
      expect(importJobInstance.getId()).to.equal('sug12345');
    });
  });

  describe('baseURL', () => {
    it('gets baseURL', () => {
      expect(importJobInstance.getBaseURL()).to.equal('https://example.com');
    });

    it('sets baseURL', () => {
      const newBaseURL = 'https://newexample.com';
      importJobInstance.setBaseURL(newBaseURL);
      expect(importJobInstance.getBaseURL()).to.equal(newBaseURL);
    });
  });

  describe('duration', () => {
    it('gets duration', () => {
      expect(importJobInstance.getDuration()).to.equal(0);
    });

    it('sets duration', () => {
      const newDuration = 100;
      importJobInstance.setDuration(newDuration);
      expect(importJobInstance.getDuration()).to.equal(newDuration);
    });
  });

  describe('endedAt', () => {
    it('gets endedAt', () => {
      expect(importJobInstance.getEndedAt()).to.equal('2022-01-01T00:00:00.000Z');
    });

    it('sets endedAt', () => {
      const newEndedAt = '2023-01-01T00:00:00.000Z';
      importJobInstance.setEndedAt(newEndedAt);
      expect(importJobInstance.getEndedAt()).to.equal(newEndedAt);
    });
  });

  describe('failedCount', () => {
    it('gets failedCount', () => {
      expect(importJobInstance.getFailedCount()).to.equal(0);
    });

    it('sets failedCount', () => {
      const newFailedCount = 1;
      importJobInstance.setFailedCount(newFailedCount);
      expect(importJobInstance.getFailedCount()).to.equal(newFailedCount);
    });
  });

  describe('hasCustomHeaders', () => {
    it('gets hasCustomHeaders', () => {
      expect(importJobInstance.getHasCustomHeaders()).to.equal(false);
    });

    it('sets hasCustomHeaders', () => {
      importJobInstance.setHasCustomHeaders(true);
      expect(importJobInstance.getHasCustomHeaders()).to.equal(true);
    });
  });

  describe('hasCustomImportJs', () => {
    it('gets hasCustomImportJs', () => {
      expect(importJobInstance.getHasCustomImportJs()).to.equal(false);
    });

    it('sets hasCustomImportJson', () => {
      importJobInstance.setHasCustomImportJs(true);
      expect(importJobInstance.getHasCustomImportJs()).to.equal(true);
    });
  });

  describe('hashedApiKey', () => {
    it('gets hashedApiKey', () => {
      expect(importJobInstance.getHashedApiKey()).to.equal('someHashedApiKey');
    });

    it('sets hashedApiKey', () => {
      const newHashedApiKey = 'someNewHashedApiKey';
      importJobInstance.setHashedApiKey(newHashedApiKey);
      expect(importJobInstance.getHashedApiKey()).to.equal(newHashedApiKey);
    });
  });

  describe('importQueueId', () => {
    it('gets importQueueId', () => {
      expect(importJobInstance.getImportQueueId()).to.equal('iq12345');
    });

    it('sets importQueueId', () => {
      const newImportQueueId = 'iq67890';
      importJobInstance.setImportQueueId(newImportQueueId);
      expect(importJobInstance.getImportQueueId()).to.equal(newImportQueueId);
    });
  });

  describe('initiatedBy', () => {
    it('gets initiatedBy', () => {
      expect(importJobInstance.getInitiatedBy()).to.deep.equal(mockRecord.initiatedBy);
    });

    it('sets initiatedBy', () => {
      const newInitiatedBy = {
        apiKeyName: 'newApiKeyName',
        imsOrgId: 'newImsOrgId',
        imsUserId: 'newImsUserId',
        userAgent: 'newUserAgent',
      };
      importJobInstance.setInitiatedBy(newInitiatedBy);
      expect(importJobInstance.getInitiatedBy()).to.deep.equal(newInitiatedBy);
    });
  });

  describe('options', () => {
    it('gets options', () => {
      expect(importJobInstance.getOptions()).to.deep.equal({ someOption: 'someValue' });
    });

    it('sets options', () => {
      const newOptions = { newOption: 'newValue' };
      importJobInstance.setOptions(newOptions);
      expect(importJobInstance.getOptions()).to.deep.equal(newOptions);
    });
  });

  describe('redirectCount', () => {
    it('gets redirectCount', () => {
      expect(importJobInstance.getRedirectCount()).to.equal(0);
    });

    it('sets redirectCount', () => {
      const newRedirectCount = 1;
      importJobInstance.setRedirectCount(newRedirectCount);
      expect(importJobInstance.getRedirectCount()).to.equal(newRedirectCount);
    });
  });

  describe('status', () => {
    it('gets status', () => {
      expect(importJobInstance.getStatus()).to.equal('RUNNING');
    });

    it('sets status', () => {
      const newStatus = 'COMPLETE';
      importJobInstance.setStatus(newStatus);
      expect(importJobInstance.getStatus()).to.equal(newStatus);
    });
  });

  describe('startedAt', () => {
    it('gets startedAt', () => {
      expect(importJobInstance.getStartedAt()).to.equal('2022-01-01T00:00:00.000Z');
    });
  });

  describe('successCount', () => {
    it('gets successCount', () => {
      expect(importJobInstance.getSuccessCount()).to.equal(0);
    });

    it('sets successCount', () => {
      const newSuccessCount = 1;
      importJobInstance.setSuccessCount(newSuccessCount);
      expect(importJobInstance.getSuccessCount()).to.equal(newSuccessCount);
    });
  });

  describe('urlCount', () => {
    it('gets urlCount', () => {
      expect(importJobInstance.getUrlCount()).to.equal(0);
    });

    it('sets urlCount', () => {
      const newUrlCount = 1;
      importJobInstance.setUrlCount(newUrlCount);
      expect(importJobInstance.getUrlCount()).to.equal(newUrlCount);
    });
  });
});
